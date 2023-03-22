import { networkConfig } from "../helper-hardhat-config";
import { verify } from "../utils/verify";

//use this to verify contract manually

async function verifyScript() {
    const chainId = 1;
    const address = "0x";

    const priceFeedUSDtoETHAddress = networkConfig[chainId].usdEthPriceFeed;
    const priceFeedEURtoUSDAddress = networkConfig[chainId].usdEurPriceFeed;
    await verify(address, [priceFeedUSDtoETHAddress, priceFeedEURtoUSDAddress]);
}
verifyScript();
