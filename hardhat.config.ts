import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-deploy";
import "solidity-coverage";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "dotenv/config";

export default {
    solidity: {
        compilers: [{ version: "0.8.17" }, { version: "0.8.0" }],
        settings: {
            optimizer: {
                enabled: true,
            },
        },
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
            forking: {
                url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_TOKEN}`,
            },
            allowUnlimitedContractSize: true,
        },
        goerli: {
            chainId: 5,
            blockConfirmations: 6,
            url: `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_TOKEN}`,
            accounts: [process.env.ACCOUNT_PRIVATE_KEY],
        },
        sepolia: {
            chainId: 11155111,
            blockConfirmations: 6,
            url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_TOKEN}`,
            accounts: [process.env.ACCOUNT_PRIVATE_KEY],
        },
        mumbai: {
            chainId: 80001,
            blockConfirmations: 6,
            url: "https://matic-mumbai.chainstacklabs.com",
            accounts: [process.env.ACCOUNT_PRIVATE_KEY],
        },
        localhost: {
            chainId: 31337,
            blockConfirmations: 1,
        },
    },
    gasReporter: {
        enabled: true,
        outputFile: "gas-report.txt",
        noColors: true,
        currency: "USD",
        coinmarketcap: process.env.COINMARKETCAP_TOKEN,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
    mocha: {
        timeout: 200000,
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_TOKEN, //process.env.POLYGONSCAN_TOKEN,
        //if you deploy on polygon chain you need to change token here
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: true,
        strict: true,
    },
};
