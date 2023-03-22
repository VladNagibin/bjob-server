import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { developmentChains } from "../../helper-hardhat-config";
import { ECurrency, EJobOfferState, EJobOfferType, KEEPER_COMPATIBLE_FEE } from "../../types";

const createSalaryJobOffer = async (
    factory: Contract,
    employee: SignerWithAddress,
    employer: SignerWithAddress
): Promise<Contract> => {
    const amount = 1000;
    const connectedFactory = factory.connect(employer);
    const requiredAmountFundedEUR: BigNumber = await connectedFactory.countRequiredFund(
        ethers.utils.parseEther(amount.toString()),
        ECurrency.EUR,
        EJobOfferType.SALARY,
        true
    );
    await connectedFactory.fund({ value: requiredAmountFundedEUR.mul(3) });
    const JobOfferTransaction = await connectedFactory.createJobOffer(
        EJobOfferType.SALARY,
        ethers.utils.parseEther(amount.toString()),
        employee.address,
        (60 * 60 * 24 * 30).toString(),
        ECurrency.EUR,
        true
    );
    const answer = await JobOfferTransaction.wait(1);
    return await ethers.getContractAt("JobOffer", answer.events[0].args[0]);
};

const createHourlyJobOffer = async (
    factory: Contract,
    employee: SignerWithAddress,
    employer: SignerWithAddress
): Promise<Contract> => {
    const amount = 50;
    const connectedFactory = factory.connect(employer);
    const requiredAmountFundedEUR: BigNumber = await connectedFactory.countRequiredFund(
        ethers.utils.parseEther(amount.toString()),
        ECurrency.EUR,
        EJobOfferType.HOURLY,
        true
    );
    await connectedFactory.fund({ value: requiredAmountFundedEUR.mul(3) });
    const JobOfferTransaction = await connectedFactory.createJobOffer(
        EJobOfferType.HOURLY,
        ethers.utils.parseEther(amount.toString()),
        employee.address,
        (60 * 60 * 24 * 30).toString(),
        ECurrency.EUR,
        true
    );
    const answer = await JobOfferTransaction.wait(1);
    return await ethers.getContractAt("JobOffer", answer.events[0].args[0]);
};

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("JobOffer tests", () => {
        let factory: Contract,
            deployer: string,
            employer: SignerWithAddress,
            randomUser: SignerWithAddress,
            employee: SignerWithAddress;
        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer;
            const namedAccounts = await ethers.getSigners();
            employer = namedAccounts[1];
            employee = namedAccounts[2];
            randomUser = namedAccounts[3];
            await deployments.fixture(["all"]);
            factory = await ethers.getContract("JobOfferFactory", deployer);
        });
        describe("basic tests", () => {
            let jobOffer: Contract;
            beforeEach(async () => {
                jobOffer = await createSalaryJobOffer(factory, employee, employer);
            });

            it("should be signed only by employee", async () => {
                const connectedJobOffer = jobOffer.connect(employer);
                await expect(connectedJobOffer.sign()).to.be.reverted;
            });

            it("should be active after sign by employee and emit event", async () => {
                const connectedJobOffer = jobOffer.connect(employee);
                await new Promise<void>(async (resolve, reject) => {
                    jobOffer.once("ContractSigned", async (employeeAddress) => {
                        try {
                            assert.equal(employeeAddress, employee.address);
                            const state = await jobOffer.getState();
                            assert.equal(state, EJobOfferState.ACTIVE);
                        } catch (e) {
                            reject(e);
                        }
                        resolve();
                    });
                    const tx = await connectedJobOffer.sign();
                    await tx.wait(1);
                });
            });

            it("should be able to close only be employee or employer", async () => {
                const connectedJobOffer = jobOffer.connect(randomUser);
                await expect(connectedJobOffer.close()).to.be.reverted;
            });

            it("should be closed after closing by employee and emit event", async () => {
                const connectedJobOffer = jobOffer.connect(employee);
                await new Promise<void>(async (resolve, reject) => {
                    jobOffer.once("ContractClosed", async (state, employeeAddress) => {
                        try {
                            assert.equal(employeeAddress, employee.address);
                            assert.equal(state, EJobOfferState.CLOSED);
                        } catch (e) {
                            reject(e);
                        }
                        resolve();
                    });
                    const tx = await connectedJobOffer.close();
                    await tx.wait(1);
                });
            });

            it("should be closed after closing by employer and emit event", async () => {
                const connectedJobOffer = jobOffer.connect(employer);
                await new Promise<void>(async (resolve, reject) => {
                    jobOffer.once("ContractClosed", async (state, employerAddress) => {
                        try {
                            assert.equal(employerAddress, employer.address);
                            assert.equal(state, EJobOfferState.CLOSED);
                        } catch (e) {
                            reject(e);
                        }
                        resolve();
                    });
                    const tx = await connectedJobOffer.close();
                    await tx.wait(1);
                });
            });

            it("only employer should be able to use withdraw", async () => {
                const employeeJobOffer = jobOffer.connect(employee);
                let tx = await employeeJobOffer.close();
                await tx.wait(1);
                await expect(employeeJobOffer.withdraw()).to.be.reverted;
            });

            it("withdraw should be able only on closed contract", async () => {
                const employerJobOffer = jobOffer.connect(employer);
                await expect(employerJobOffer.withdraw()).to.be.reverted;
            });
        });
        describe("Salary job offer tests", () => {
            let jobOffer: Contract;
            beforeEach(async () => {
                jobOffer = await createSalaryJobOffer(factory, employee, employer);
            });
            it("should not be able to pay in unsigned contract", async () => {
                const connectedJobOffer = jobOffer.connect(employer);
                await expect(connectedJobOffer.payMonthly()).to.be.reverted;
            });

            it("should not be able to pay by NOT employer", async () => {
                const connectedJobOffer = jobOffer.connect(employee);
                const tx = await connectedJobOffer.sign();
                await tx.wait(1);
                await expect(connectedJobOffer.payMonthly()).to.be.reverted;
            });

            it("should pay monthly to employee after submit by employer", async () => {
                const employeeJobOffer = jobOffer.connect(employee);
                const tx = await employeeJobOffer.sign();
                await tx.wait(1);
                const startingOfferBalance = await jobOffer.provider.getBalance(jobOffer.address);
                const startingFactoryBalance = await factory.provider.getBalance(factory.address);

                const startingEmployeeBalance = await employee.getBalance();

                const connectedJobOffer = jobOffer.connect(employer);

                await new Promise<void>(async (resolve, reject) => {
                    jobOffer.once("SalaryPaid", async (employeeAddress, paymentAmount) => {
                        try {
                            assert.equal(employeeAddress, employee.address);
                            const endingEmployeeBalance = await employee.getBalance();
                            assert.equal(
                                startingEmployeeBalance.add(paymentAmount).toString(),
                                endingEmployeeBalance.toString()
                            );

                            const endingOfferBalance = await jobOffer.provider.getBalance(
                                jobOffer.address
                            );
                            const endingFactoryBalance = await factory.provider.getBalance(
                                factory.address
                            );
                            assert.equal(
                                startingOfferBalance.toString(),
                                endingOfferBalance.toString()
                            );
                            assert.equal(
                                startingFactoryBalance.toString(),
                                endingFactoryBalance
                                    .add(paymentAmount)
                                    .add(KEEPER_COMPATIBLE_FEE)
                                    .toString()
                            );
                        } catch (e) {
                            reject(e);
                        }
                        resolve();
                    });
                    const tx = await connectedJobOffer.payMonthly();
                    await tx.wait(1);
                });
            });

            it("should throw error if user try", async () => {
                const employeeJobOffer = jobOffer.connect(employee);
                const tx = await employeeJobOffer.sign();
                await tx.wait(1);
                const startingOfferBalance = await jobOffer.provider.getBalance(jobOffer.address);
                const startingFactoryBalance = await factory.provider.getBalance(factory.address);

                const startingEmployeeBalance = await employee.getBalance();

                const connectedJobOffer = jobOffer.connect(employer);

                await new Promise<void>(async (resolve, reject) => {
                    jobOffer.once("SalaryPaid", async (employeeAddress, paymentAmount) => {
                        try {
                            assert.equal(employeeAddress, employee.address);
                            const endingEmployeeBalance = await employee.getBalance();
                            assert.equal(
                                startingEmployeeBalance.add(paymentAmount).toString(),
                                endingEmployeeBalance.toString()
                            );

                            const endingOfferBalance = await jobOffer.provider.getBalance(
                                jobOffer.address
                            );
                            const endingFactoryBalance = await factory.provider.getBalance(
                                factory.address
                            );
                            assert.equal(
                                startingOfferBalance.toString(),
                                endingOfferBalance.toString()
                            );
                            assert.equal(
                                startingFactoryBalance.toString(),
                                endingFactoryBalance
                                    .add(paymentAmount)
                                    .add(KEEPER_COMPATIBLE_FEE)
                                    .toString()
                            );
                        } catch (e) {
                            reject(e);
                        }
                        resolve();
                    });
                    const tx = await connectedJobOffer.payMonthly();
                    await tx.wait(1);
                });
            });

            it("should not be able to set worked hours", async () => {
                const employeeJobOffer = jobOffer.connect(employee);
                const tx = await employeeJobOffer.sign();
                await tx.wait(1);
                await expect(employeeJobOffer.setWorkedHours(8)).to.be.reverted;
            });

            it("should not be able to pay for worked hours", async () => {
                const employeeJobOffer = jobOffer.connect(employee);
                const tx = await employeeJobOffer.sign();
                await tx.wait(1);
                await expect(employeeJobOffer.payWorkedHours()).to.be.reverted;
            });

            it("should withdraw all funds from closed contract", async () => {
                const employerJobOffer = jobOffer.connect(employer);
                let tx = await employerJobOffer.close();
                await tx.wait(1);
                const startedEmployerBalance = await employer.getBalance();
                const startedContractBalance = await employerJobOffer.provider.getBalance(
                    employerJobOffer.address
                );
                tx = await employerJobOffer.withdraw();
                const { gasUsed, effectiveGasPrice } = await tx.wait(1);
                const totalGasPrice: BigNumber = gasUsed.mul(effectiveGasPrice);
                const endingEmployerBalance = await employer.getBalance();
                const endingContractBalance = await employerJobOffer.provider.getBalance(
                    employerJobOffer.address
                );
                assert.equal(endingContractBalance.toString(), "0");
                assert.equal(
                    startedEmployerBalance.add(startedContractBalance).toString(),
                    endingEmployerBalance.add(totalGasPrice).toString()
                );
            });
        });

        describe("Hourly job offer tests", () => {
            let jobOffer: Contract;
            beforeEach(async () => {
                jobOffer = await createHourlyJobOffer(factory, employee, employer);
            });

            it("should not be able to pay monthly", async () => {
                const employeeJobOffer = jobOffer.connect(employee);
                const tx = await employeeJobOffer.sign();
                await tx.wait(1);
                await expect(employeeJobOffer.payMonthly()).to.be.reverted;
            });

            it("should not be able to set worked hours if unsigned", async () => {
                const employeeJobOffer = jobOffer.connect(employee);
                await expect(employeeJobOffer.setWorkedHours(8)).to.be.reverted;
            });

            it("should not be able to set worked hours if closed", async () => {
                const employeeJobOffer = jobOffer.connect(employee);
                let tx = await employeeJobOffer.sign();
                await tx.wait(1);
                tx = await employeeJobOffer.close();
                await tx.wait(1);
                await expect(employeeJobOffer.setWorkedHours(8)).to.be.reverted;
            });

            it("should be able to set worked hours", async () => {
                const addedWorkedHours = 8;
                const employeeJobOffer = jobOffer.connect(employee);
                let tx = await employeeJobOffer.sign();
                await tx.wait(1);
                const startingWorkingHours = await jobOffer.getWorkedHours();
                tx = await employeeJobOffer.setWorkedHours(addedWorkedHours);
                await tx.wait(1);
                const endingWorkingHours = await jobOffer.getWorkedHours();

                assert.equal(
                    startingWorkingHours.add(addedWorkedHours).toString(),
                    endingWorkingHours.toString()
                );
            });

            it("should pay worked hours", async () => {
                const addedWorkedHours = 8;
                const employeeJobOffer = jobOffer.connect(employee);
                let tx = await employeeJobOffer.sign();
                await tx.wait(1);
                tx = await employeeJobOffer.setWorkedHours(addedWorkedHours);
                await tx.wait(1);

                await new Promise<void>(async (resolve, reject) => {
                    jobOffer.once("SalaryPaid", async (employeeAddress, paymentAmount) => {
                        try {
                            assert.equal(employeeAddress, employee.address);
                            const endingEmployeeBalance = await employee.getBalance();
                            assert.equal(
                                startingEmployeeBalance.add(paymentAmount).toString(),
                                endingEmployeeBalance.add(totalGasPrice).toString()
                            );
                            const ethAmount = await employeeJobOffer.getEthAmount();
                            assert.equal(
                                ethAmount.mul(addedWorkedHours).toString(),
                                paymentAmount.toString()
                            );

                            const workedHours = await employeeJobOffer.getWorkedHours();
                            assert.equal(workedHours.toString(), "0");
                        } catch (e) {
                            reject(e);
                        }
                        resolve();
                    });
                    const startingEmployeeBalance = await employee.getBalance();
                    const tx = await employeeJobOffer.payWorkedHours();
                    const txReceipt = await tx.wait(1);
                    const totalGasPrice: BigNumber = txReceipt.gasUsed.mul(
                        txReceipt.effectiveGasPrice
                    );
                });
            });

            it("should be able to pay non paid hours after closing", async () => {
                const addedWorkedHours = 8;
                const employeeJobOffer = jobOffer.connect(employee);
                let tx = await employeeJobOffer.sign();
                await tx.wait(1);
                tx = await employeeJobOffer.setWorkedHours(addedWorkedHours);
                await tx.wait(1);
                tx = await employeeJobOffer.close();
                await tx.wait(1);
                await new Promise<void>(async (resolve, reject) => {
                    jobOffer.once("SalaryPaid", async (employeeAddress, paymentAmount) => {
                        try {
                            const endingEmployeeBalance = await employee.getBalance();
                            assert.equal(
                                startingEmployeeBalance.add(paymentAmount).toString(),
                                endingEmployeeBalance.add(totalGasPrice).toString()
                            );
                        } catch (e) {
                            reject(e);
                        }
                        resolve();
                    });
                    const startingEmployeeBalance = await employee.getBalance();
                    const tx = await employeeJobOffer.payWorkedHours();
                    const txReceipt = await tx.wait(1);
                    const totalGasPrice: BigNumber = txReceipt.gasUsed.mul(
                        txReceipt.effectiveGasPrice
                    );
                });
            });

            it("should not be able to withdraw until have non paid hours", async () => {
                const addedWorkedHours = 8;
                const employeeJobOffer = jobOffer.connect(employee);
                let tx = await employeeJobOffer.sign();
                await tx.wait(1);
                tx = await employeeJobOffer.setWorkedHours(addedWorkedHours);
                await tx.wait(1);

                const paymentAmount = await employeeJobOffer.getEthAmount();
                const employerJobOffer = jobOffer.connect(employer);
                tx = await employerJobOffer.close();
                await tx.wait(1);
                await expect(employerJobOffer.withdraw()).to.be.reverted;

            });
        });
    });
