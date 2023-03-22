// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./PriceConventer.sol";
import {IJobOfferFactory} from "./IJobOfferFactoryInterface.sol";

error JobOffer_not_enough_amount(uint256 requiredAmount, Currency currency);
error JobOffer_not_employee();
error JobOffer_not_employer();
error JobOffer_invalid_sender();
error JobOffer_transaction_not_successful();
error JobOffer_payment_not_needed();
error JobOffer_wrong_offer_type();
error JobOffer_is_not_keeper_compatible();
error JobOffer_not_closed();
error JobOffer_wrong_state();
error JobOffer_not_all_hours_paided();

enum OfferType {
    HOURLY,
    SALARY
}

struct OfferBetween {
    address employeeAddress;
    address employerAddress;
}

struct PriceFeeds {
    AggregatorV3Interface priceFeedUSDtoETH;
    AggregatorV3Interface priceFeedUSDtoEUR;
}

struct Settings {
    uint256 paymentAmount;
    uint256 paymentRate;
    Currency currency;
    uint256 requiredSalariesFunded;
    OfferType offerType;
    bool keeperCompatible;
}
enum JobOfferState {
    UNSIGNED,
    ACTIVE,
    CLOSED
}

contract JobOffer {
    using PriceConventer for uint256;

    event ContractSigned(address indexed employee, uint256 timestamp);
    event SalaryPaid(address indexed employee, uint256 ethAmount, uint256 timestamp);
    event ContractClosed(JobOfferState indexed state, address indexed closedBy, uint256 timestamp);
    event ContractNeedsToBeFunded(address indexed contractAddress, uint256 ethAmount);

    uint256 private immutable i_paymentAmount;
    address private immutable i_companyAddress;
    address private immutable i_employeeAddress;
    IJobOfferFactory private immutable i_jobOfferFactory;
    Currency private immutable i_currency;
    uint256 private immutable i_paymentRate;
    OfferType private immutable i_offerType;
    bool private immutable i_keeperCompatible;

    uint256 private s_nonPaidWorkedHours;
    AggregatorV3Interface private s_priceFeedUSDtoETH;
    AggregatorV3Interface private s_priceFeedUSDtoEUR;
    uint256 private s_lastPaymentTimestamp;
    JobOfferState private s_state;

    modifier onlyEmployer() {
        if (msg.sender != i_companyAddress) {
            revert JobOffer_not_employer();
        }
        _;
    }

    modifier onlyEmployee() {
        if (msg.sender != i_employeeAddress) {
            revert JobOffer_not_employee();
        }
        _;
    }

    modifier payment() {
        if (s_lastPaymentTimestamp + i_paymentRate > block.timestamp) {
            revert JobOffer_payment_not_needed();
        }
        _;
    }

    modifier active() {
        if (s_state != JobOfferState.ACTIVE) {
            revert JobOffer_wrong_state();
        }
        _;
    }

    modifier hourly() {
        if (i_offerType == OfferType.SALARY) {
            revert JobOffer_wrong_offer_type();
        }
        _;
    }

    modifier salary() {
        if (i_offerType == OfferType.HOURLY) {
            revert JobOffer_wrong_offer_type();
        }
        _;
    }

    constructor(
        OfferBetween memory offerBetween,
        PriceFeeds memory priceFeeds,
        Settings memory settings
    ) payable {
        i_currency = settings.currency;
        s_priceFeedUSDtoETH = priceFeeds.priceFeedUSDtoETH;
        s_priceFeedUSDtoEUR = priceFeeds.priceFeedUSDtoEUR;
        uint256 requiredAmountFunded = (settings.paymentAmount *
            settings.requiredSalariesFunded *
            95) / 100;
        if (i_currency != Currency.ETH) {
            if (
                msg.value.getCurrencyAmount(s_priceFeedUSDtoETH, s_priceFeedUSDtoEUR, i_currency) <
                requiredAmountFunded
            ) {
                revert JobOffer_not_enough_amount(requiredAmountFunded, settings.currency);
            }
        } else if (msg.value < requiredAmountFunded) {
            revert JobOffer_not_enough_amount(requiredAmountFunded, settings.currency);
        }
        i_keeperCompatible = settings.keeperCompatible;
        i_offerType = settings.offerType;
        i_paymentAmount = settings.paymentAmount;
        i_paymentRate = settings.paymentRate;
        i_employeeAddress = offerBetween.employeeAddress;
        i_companyAddress = offerBetween.employerAddress;
        s_state = JobOfferState.UNSIGNED;
        s_lastPaymentTimestamp = 0;
        i_jobOfferFactory = IJobOfferFactory(msg.sender);
    }

    function sign() public onlyEmployee returns (JobOfferState) {
        if (s_state != JobOfferState.UNSIGNED) {
            revert JobOffer_wrong_state();
        }
        s_state = JobOfferState.ACTIVE;
        emit ContractSigned(i_employeeAddress, block.timestamp);
        return s_state;
    }

    function close() public returns (JobOfferState) {
        if (msg.sender == i_companyAddress || msg.sender == i_employeeAddress) {
            s_state = JobOfferState.CLOSED;
            emit ContractClosed(s_state, msg.sender, block.timestamp);
            return s_state;
        }
        revert JobOffer_invalid_sender();
    }

    function pay() internal returns (uint256) {
        uint256 paymentAmount = i_paymentAmount;
        if (i_currency != Currency.ETH) {
            paymentAmount = paymentAmount.getEthAmount(
                s_priceFeedUSDtoETH,
                s_priceFeedUSDtoEUR,
                i_currency
            );
        }
        if (i_offerType == OfferType.HOURLY) {
            paymentAmount *= s_nonPaidWorkedHours;
        }
        (bool success, ) = i_employeeAddress.call{value: paymentAmount}("");
        if (!success) {
            revert JobOffer_transaction_not_successful();
        }
        try
            i_jobOfferFactory.fundJobOffer(paymentAmount, i_companyAddress, i_keeperCompatible)
        {} catch {
            emit ContractNeedsToBeFunded(address(this), paymentAmount);
        }
        s_lastPaymentTimestamp = block.timestamp;
        emit SalaryPaid(i_employeeAddress, paymentAmount, block.timestamp);
        s_nonPaidWorkedHours = 0;
        return paymentAmount;
    }

    function setWorkedHours(
        uint256 workedHours
    ) public onlyEmployee active hourly returns (uint256) {
        s_nonPaidWorkedHours += workedHours;
        return s_nonPaidWorkedHours;
    }

    function payWorkedHours() public onlyEmployee payment hourly returns (uint256) {
        return pay();
    }

    function payMonthly() public onlyEmployer payment salary active returns (uint256) {
        return pay();
    }

    function performUpkeep() public payment active returns (uint256) {
        if (!i_keeperCompatible) {
            revert JobOffer_is_not_keeper_compatible();
        }
        return pay();
    }

    function withdraw() public onlyEmployer {
        if (s_state != JobOfferState.CLOSED) {
            revert JobOffer_not_closed();
        }

        if (i_offerType == OfferType.HOURLY && s_nonPaidWorkedHours != 0) {
            revert JobOffer_not_all_hours_paided();
        }
        (bool success, ) = payable(i_companyAddress).call{value: address(this).balance}("");
        if (!success) {
            revert JobOffer_transaction_not_successful();
        }
    }

    fallback() external payable {}

    receive() external payable {}

    function getWorkedHours() public view returns (uint256) {
        return s_nonPaidWorkedHours;
    }

    function getOfferType() public view returns (OfferType) {
        return i_offerType;
    }

    function getLastPaymentTimestamp() external view returns (uint256) {
        return s_lastPaymentTimestamp;
    }

    function getPaymentRate() external view returns (uint256) {
        return i_paymentRate;
    }

    function getPaymentAmount() external view returns (uint256) {
        return i_paymentAmount;
    }

    function getState() external view returns (JobOfferState) {
        return s_state;
    }

    function getCurrency() external view returns (Currency) {
        return i_currency;
    }

    function getEthAmount() external view returns (uint256) {
        return i_paymentAmount.getEthAmount(s_priceFeedUSDtoETH, s_priceFeedUSDtoEUR, i_currency);
    }

    function getEmployeeAddress() external view returns (address) {
        return i_employeeAddress;
    }

    function getEmployerAddress() external view returns (address) {
        return i_companyAddress;
    }

    function isKeeperCompatible() external view returns (bool) {
        return i_keeperCompatible;
    }
}
