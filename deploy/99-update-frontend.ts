import { readFileSync, writeFileSync } from "fs";
import { ethers, network } from "hardhat";
import JobOfferCompiled from "../artifacts/contracts/JobOffer.sol/JobOffer.json";

const FRONTEND_LOCATION_ADDRESSES_FILE = "../client/constants/contractAddresses.json";
const FRONTEND_FACTORY_ABI_FILE = "../client/constants/factory/abi.json";
const FRONTEND_OFFER_ABI_FILE = "../client/constants/offer/abi.json";
const updateFrontend = async () => {
    await Promise.all([updateContractAddresses(), updateABI()]);
};

const updateABI = async () => {
    const factory = await ethers.getContract("JobOfferFactory");
    writeFileSync(
        FRONTEND_FACTORY_ABI_FILE,
        factory.interface.format(ethers.utils.FormatTypes.json) as string
    );
    // const offer = await ethers.getContract("JobOffer");
    writeFileSync(FRONTEND_OFFER_ABI_FILE, JSON.stringify(JobOfferCompiled.abi));
};

const updateContractAddresses = async () => {
    const raffle = await ethers.getContract("JobOfferFactory");
    const chainId = network.config.chainId!.toString();
    const currentAddresses = JSON.parse(readFileSync(FRONTEND_LOCATION_ADDRESSES_FILE, "utf-8"));
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.address)) {
            currentAddresses[chainId].push(raffle.address);
        }
    } else {
        currentAddresses[chainId] = [raffle.address];
    }
    writeFileSync(FRONTEND_LOCATION_ADDRESSES_FILE, JSON.stringify(currentAddresses));
};
export default updateFrontend;

updateFrontend.tags = ["all", "frontend"];
