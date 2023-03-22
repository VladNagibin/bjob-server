// SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

import {PriceConventer, Currency} from "./PriceConventer.sol";
import {JobOffer, OfferType, Settings, OfferBetween, PriceFeeds, JobOfferState} from "./JobOffer.sol";

error JobOfferFactory_transaction_not_successful();
error JobOfferFactory_not_enough_eth_funded(uint256 requiredEthAmount, uint256 balance);
error JobOfferFactory_not_valid_offer(address offerAddress);
error JobOfferFactory_employer_does_not_have_enough_balance();
error JobOfferFactory_not_all_offers_closed();
error JobOfferFactory_zero_balance();

contract JobOfferFactory is KeeperCompatibleInterface {
    using PriceConventer for uint256;

    struct Employer {
        uint256 balance;
        Offer[] offers;
    }

    struct Employee {
        Offer[] offers;
    }

    struct Offer {
        address offerAddress;
        OfferType offerType;
    }

    event OfferCreated(
        address indexed offerAddress,
        OfferType offerType,
        address employer,
        address employee
    );

    uint256 private constant REQUIRED_HOURS_FUNDED = 72 * 8;
    uint256 private constant REQUIRED_SALARIES_FUNDED = 3;
    uint256 public constant KEEPER_COMPATIBLE_FEE = 5000000000000000;

    AggregatorV3Interface private priceFeedUSDtoETH;
    AggregatorV3Interface private priceFeedUSDtoEUR;
    address private immutable owner;

    mapping(address => Employer) private employerData;
    mapping(address => Employee) private employeeData;

    address[] private validOffers;

    constructor(address priceFeedUSDtoETHAddress, address priceFeedEURtoUSDAddress) {
        priceFeedUSDtoETH = AggregatorV3Interface(priceFeedUSDtoETHAddress);
        priceFeedUSDtoEUR = AggregatorV3Interface(priceFeedEURtoUSDAddress);
        owner = msg.sender;
    }

    function fund() public payable {
        employerData[msg.sender].balance += msg.value;
    }

    fallback() external payable {
        fund();
    }

    receive() external payable {
        fund();
    }

    function createJobOffer(
        OfferType contractType,
        uint256 paymentAmount,
        address employeeAddress,
        uint256 paymentRate,
        Currency currency,
        bool keeperCompatible
    ) external returns (address) {
        uint256 requiredSalariesFunded = REQUIRED_SALARIES_FUNDED;
        if (contractType == OfferType.HOURLY) {
            requiredSalariesFunded = REQUIRED_HOURS_FUNDED;
        }
        uint256 fee = 0;
        if (keeperCompatible) {
            fee = KEEPER_COMPATIBLE_FEE;
        }
        uint256 requiredEthAmount = paymentAmount.getEthAmount(
            priceFeedUSDtoETH,
            priceFeedUSDtoEUR,
            currency
        ) *
            requiredSalariesFunded +
            fee;
        if (requiredEthAmount > employerData[msg.sender].balance) {
            revert JobOfferFactory_not_enough_eth_funded(
                requiredEthAmount,
                employerData[msg.sender].balance
            );
        }
        JobOffer offer = new JobOffer{value: requiredEthAmount - fee}(
            OfferBetween(employeeAddress, msg.sender),
            PriceFeeds(priceFeedUSDtoETH, priceFeedUSDtoEUR),
            Settings(
                paymentAmount,
                paymentRate,
                currency,
                requiredSalariesFunded,
                contractType,
                keeperCompatible
            )
        );
        employerData[msg.sender].balance -= requiredEthAmount;
        if (keeperCompatible) {
            payKeeperCompatibleFee();
        }
        employerData[msg.sender].offers.push(Offer((address(offer)), contractType));
        employeeData[employeeAddress].offers.push(Offer((address(offer)), contractType));
        validOffers.push(address(offer));
        emit OfferCreated(address(offer), contractType, msg.sender, employeeAddress);
        return address(offer);
    }

    function fundJobOffer(uint256 amount, address employerAddress, bool keeperCompatible) external {
        if (!isValidOffer(msg.sender)) {
            revert JobOfferFactory_not_valid_offer(msg.sender);
        }
        uint256 fee = 0;
        if (keeperCompatible) {
            fee = KEEPER_COMPATIBLE_FEE;
            payKeeperCompatibleFee();
        }
        if (employerData[employerAddress].balance < amount + fee) {
            revert JobOfferFactory_employer_does_not_have_enough_balance();
        }
        employerData[employerAddress].balance -= amount + fee;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert JobOfferFactory_transaction_not_successful();
        }
    }

    function isValidOffer(address offerAddress) internal view returns (bool) {
        for (uint8 i = 0; i < validOffers.length; i++) {
            if (validOffers[i] == offerAddress) {
                return true;
            }
        }
        return false;
    }

    function countRequiredFund(
        uint256 amount,
        Currency currency,
        OfferType offerType,
        bool keeperCompatible
    ) external view returns (uint256) {
        uint256 requiredSalariesFunded = REQUIRED_SALARIES_FUNDED;
        if (offerType == OfferType.HOURLY) {
            requiredSalariesFunded = REQUIRED_HOURS_FUNDED;
        }
        uint256 fee = 0;
        if (keeperCompatible) {
            fee = KEEPER_COMPATIBLE_FEE;
        }
        return
            amount.getEthAmount(priceFeedUSDtoETH, priceFeedUSDtoEUR, currency) *
            requiredSalariesFunded +
            fee;
    }

    function parseEthToCurrency(uint256 amount, Currency currency) external view returns (uint256) {
        return amount.getCurrencyAmount(priceFeedUSDtoETH, priceFeedUSDtoEUR, currency);
    }

    function checkUpkeep(
        bytes memory /*checkData*/
    ) public pure override returns (bool upkeepNeeded, bytes memory /*performData*/) {
        upkeepNeeded = true;
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        for (uint8 i = 0; i < validOffers.length; i++) {
            JobOffer offer = JobOffer(payable(validOffers[i]));
            if (!offer.isKeeperCompatible()) {
                continue;
            }
            offer.performUpkeep();
        }
    }

    function payKeeperCompatibleFee() internal {
        (bool success, ) = payable(owner).call{value: KEEPER_COMPATIBLE_FEE}("");
        if (!success) {
            revert JobOfferFactory_transaction_not_successful();
        }
    }

    function isAllOffersClosed(address employer) internal view returns (bool) {
        for (uint8 i = 0; i < employerData[employer].offers.length; i++) {
            if (
                JobOffer(payable(employerData[employer].offers[i].offerAddress)).getState() !=
                JobOfferState.CLOSED
            ) {
                return false;
            }
        }
        return true;
    }

    function withdraw() public {
        if (employerData[msg.sender].balance == 0) {
            revert JobOfferFactory_zero_balance();
        }
        if (!isAllOffersClosed(msg.sender)) {
            revert JobOfferFactory_not_all_offers_closed();
        }
        (bool success, ) = payable(msg.sender).call{value: employerData[msg.sender].balance}("");
        employerData[msg.sender].balance = 0;
        if (!success) {
            revert JobOfferFactory_transaction_not_successful();
        }
    }

    function getEmployerData() external view returns (Employer memory) {
        return employerData[msg.sender];
    }

    function getEmployeeData() external view returns (Employee memory) {
        return employeeData[msg.sender];
    }

    function getKeeperCompatibleFee() external pure returns (uint256) {
        return KEEPER_COMPATIBLE_FEE;
    }
}
