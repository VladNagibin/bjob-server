export const networkConfig: Record<
    number,
    {
        name: string;
        usdEthPriceFeed: string;
        usdEurPriceFeed: string;
    }
> = {
    31337: {
        name: "hardhat",
        usdEthPriceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
        usdEurPriceFeed: "0xb49f677943BC038e9857d61E7d053CaA2C1734C1",
    },
    11155111: {
        name: "sepolia",
        usdEthPriceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
        usdEurPriceFeed: "0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910",
    },
    42161: {
        name: "arbitrum",
        usdEthPriceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
        usdEurPriceFeed: "0xA14d53bC1F1c0F31B4aA3BD109344E5009051a84",
    },
    10: {
        name: "optimism",
        usdEthPriceFeed: "0x13e3Ee699D1909E989722E753853AE30b17e08c5",
        usdEurPriceFeed: "0x3626369857A10CcC6cc3A6e4f5C2f5984a519F20",
    },
    1: {
        name: "ethereum",
        usdEthPriceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
        usdEurPriceFeed: "0xb49f677943BC038e9857d61E7d053CaA2C1734C1",
    },
    43114: {
        name: "avalanche",
        usdEthPriceFeed: "0x0A77230d17318075983913bC2145DB16C7366156",
        usdEurPriceFeed: "0x192f2DBA961Bb0277520C082d6bfa87D5961333E",
    },
    5: {
        name: "goerli",
        usdEthPriceFeed: "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
        usdEurPriceFeed: "0x44390589104C9164407A0E0562a9DBe6C24A0E05",
    },
    80001: {
        name: "mumbai",
        usdEthPriceFeed: "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada",
        usdEurPriceFeed: "0x7d7356bF6Ee5CDeC22B216581E48eCC700D0497A",
    },
};
export const developmentChains = ["hardhat", "localhost"];
