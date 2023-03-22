// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Currency} from "./PriceConventer.sol";

interface IJobOfferFactory {
    enum OfferType {
        HOURLY,
        SALARY
    }

    function fundJobOffer(uint256 amount, address employerAddress, bool keeperCompatible) external;

    function createJobOffer(
        OfferType contractType,
        uint256 paymentAmount,
        address employeeAddress,
        uint256 paymentRate,
        Currency currency
    ) external returns (address);
}
