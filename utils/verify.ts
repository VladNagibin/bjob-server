import { run } from "hardhat";

export async function verify(contractAddress: string, args?: Object) {
    console.log(`Verifying contract...`);
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch ({ message }) {
        if ((message as string).toLowerCase().includes("already verified")) {
            console.log("already verified");
        }
        console.log(message);
    }
}
