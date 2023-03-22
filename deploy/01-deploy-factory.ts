import { HardhatRuntimeEnvironment } from "hardhat/types";
import { network } from "hardhat";
import { developmentChains, networkConfig } from "../helper-hardhat-config";
import { verify } from "../utils/verify";

const deployJobOfferFactory = async ({
    getNamedAccounts,
    deployments,
}: HardhatRuntimeEnvironment) => {
    console.log("deploying....");
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId!;
    const priceFeedUSDtoETHAddress = networkConfig[chainId].usdEthPriceFeed;
    const priceFeedEURtoUSDAddress = networkConfig[chainId].usdEurPriceFeed;
    const args = [priceFeedUSDtoETHAddress, priceFeedEURtoUSDAddress];
    const offerFactoryDeployment = await deploy("JobOfferFactory", {
        from: deployer,
        args,
        log: true,
        waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
    });
    log(offerFactoryDeployment.address);
    if (!developmentChains.includes(network.name)) {
        await verify(offerFactoryDeployment.address, [
            priceFeedUSDtoETHAddress,
            priceFeedEURtoUSDAddress,
        ]);
    }
    log("-------------------------------");
};
export default deployJobOfferFactory;
deployJobOfferFactory.tags = ["all", "factory"];
