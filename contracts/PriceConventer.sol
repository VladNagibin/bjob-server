// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

enum Currency {
    ETH,
    USD,
    EUR
}

library PriceConventer {
    function getPrice(AggregatorV3Interface priceFeed) internal view returns (uint256, uint8) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        uint8 decimals = priceFeed.decimals();
        return (uint256(price), decimals);
    }

    function getCurrencyAmount(
        uint256 ethAmount,
        AggregatorV3Interface priceFeedUSDtoETH,
        AggregatorV3Interface priceFeedUSDtoEUR,
        Currency currency
    ) internal view returns (uint256) {
        if (currency == Currency.ETH) {
            return ethAmount;
        } else if (currency == Currency.USD) {
            (uint256 ethPrice, uint8 priceDecimals) = getPrice(priceFeedUSDtoETH);
            uint256 amountInCurrency = (ethPrice * ethAmount) / (10 ** priceDecimals);
            return amountInCurrency;
        } else {
            (uint256 ethPrice, uint8 priceDecimals) = getPrice(priceFeedUSDtoETH);
            (uint256 eurPrice, ) = getPrice(priceFeedUSDtoEUR);
            uint256 rate = (ethPrice * (10 ** priceDecimals)) / eurPrice;
            uint256 amountInCurrency = (ethAmount / (10 ** priceDecimals)) * rate;
            return amountInCurrency;
        }
    }

    function getEthAmount(
        uint256 amountInCurrency,
        AggregatorV3Interface priceFeedUSDtoETH,
        AggregatorV3Interface priceFeedUSDtoEUR,
        Currency currency
    ) internal view returns (uint256) {
        if (currency == Currency.ETH) {
            return amountInCurrency;
        } else if (currency == Currency.USD) {
            (uint256 ethPrice, uint8 priceDecimals) = getPrice(priceFeedUSDtoETH);
            uint256 ethAmount = amountInCurrency / ethPrice;
            return ethAmount * (10 ** priceDecimals);
        } else {
            (uint256 ethPrice, uint8 priceDecimals) = getPrice(priceFeedUSDtoETH);
            (uint256 eurPrice, ) = getPrice(priceFeedUSDtoEUR);
            uint256 rate = (ethPrice * (10 ** priceDecimals)) / eurPrice;
            uint256 ethAmount = amountInCurrency / rate;
            return ethAmount * (10 ** priceDecimals);
        }
    }
}
