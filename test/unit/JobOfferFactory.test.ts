import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { developmentChains, networkConfig } from "../../helper-hardhat-config";
import { ECurrency, EJobOfferState, EJobOfferType, KEEPER_COMPATIBLE_FEE } from "../../types";

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("JobOfferFactory tests", () => {
          let factory: Contract,
              deployer: string,
              employer: SignerWithAddress,
              employee: SignerWithAddress;
          const chainId = network.config.chainId;
          let priceFeedEURtoUSDAddress: string;
          let priceFeedUSDtoETHAddress: string;
          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer;
              const namedAccounts = await ethers.getSigners();
              employee = namedAccounts[1];
              employer = namedAccounts[2];
              await deployments.fixture(["all"]);
              factory = await ethers.getContract("JobOfferFactory", employer.address);
              priceFeedEURtoUSDAddress = networkConfig[chainId!].usdEurPriceFeed;
              priceFeedUSDtoETHAddress = networkConfig[chainId!].usdEthPriceFeed;
          });

          it("should make conversion to eth operations correctly", async () => {
              const salaryAmount = 3000;
              const requiredAmountFundedUSD: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(salaryAmount.toString()),
                  ECurrency.USD,
                  EJobOfferType.SALARY,
                  false
              );
              const requiredAmountFundedEUR: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(salaryAmount.toString()),
                  ECurrency.EUR,
                  EJobOfferType.SALARY,
                  false
              );
              const requiredAmountFundedEURHourly: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(salaryAmount.toString()),
                  ECurrency.EUR,
                  EJobOfferType.HOURLY,
                  false
              );
              const requiredAmountFundedETH: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(salaryAmount.toString()),
                  ECurrency.ETH,
                  EJobOfferType.SALARY,
                  false
              );
              const USDPriceFeed = await ethers.getContractAt(
                  "AggregatorV3Interface",
                  priceFeedUSDtoETHAddress
              );
              const EURPriceFeed = await ethers.getContractAt(
                  "AggregatorV3Interface",
                  priceFeedEURtoUSDAddress
              );
              const decimals = await USDPriceFeed.decimals();
              const usdRate = (await USDPriceFeed.latestRoundData())[1].toNumber() / 10 ** decimals;
              const eurRate = (await EURPriceFeed.latestRoundData())[1].toNumber() / 10 ** decimals;
              const usdPrice = (salaryAmount * 3) / usdRate;
              const eurPrice = (eurRate * salaryAmount * 3) / usdRate;
              const eurPriceHourly = (eurRate * salaryAmount * 72 * 8) / usdRate;
              const ethPrice = salaryAmount * 3;

              expect(
                  parseFloat(ethers.utils.formatEther(requiredAmountFundedUSD)).toFixed(2)
              ).to.be.equal(usdPrice.toFixed(2));
              expect(
                  parseFloat(ethers.utils.formatEther(requiredAmountFundedEUR)).toFixed(2)
              ).to.be.equal(eurPrice.toFixed(2));
              expect(
                  parseFloat(ethers.utils.formatEther(requiredAmountFundedEURHourly)).toFixed(2)
              ).to.be.equal(eurPriceHourly.toFixed(2));
              expect(
                  parseFloat(ethers.utils.formatEther(requiredAmountFundedETH)).toFixed(2)
              ).to.be.equal(ethPrice.toFixed(2));
          });

          it("should make conversion to currency operations correctly", async () => {
              const amount = 5;
              const requiredAmountFundedUSD: BigNumber = await factory.parseEthToCurrency(
                  ethers.utils.parseEther(amount.toString()),
                  ECurrency.USD
              );
              const requiredAmountFundedEUR: BigNumber = await factory.parseEthToCurrency(
                  ethers.utils.parseEther(amount.toString()),
                  ECurrency.EUR
              );
              const requiredAmountFundedETH: BigNumber = await factory.parseEthToCurrency(
                  ethers.utils.parseEther(amount.toString()),
                  ECurrency.ETH
              );
              const USDPriceFeed = await ethers.getContractAt(
                  "AggregatorV3Interface",
                  priceFeedUSDtoETHAddress
              );
              const EURPriceFeed = await ethers.getContractAt(
                  "AggregatorV3Interface",
                  priceFeedEURtoUSDAddress
              );
              const decimals = await USDPriceFeed.decimals();
              const usdRate = (await USDPriceFeed.latestRoundData())[1].toNumber() / 10 ** decimals;
              const eurRate = (await EURPriceFeed.latestRoundData())[1].toNumber() / 10 ** decimals;
              const usdPrice = amount * usdRate;
              const eurprice = (amount * usdRate) / eurRate;
              const ethPrice = amount;

              expect(
                  parseFloat(ethers.utils.formatEther(requiredAmountFundedUSD)).toFixed(2)
              ).to.be.equal(usdPrice.toFixed(2));
              expect(
                  parseFloat(ethers.utils.formatEther(requiredAmountFundedEUR)).toFixed(2)
              ).to.be.equal(eurprice.toFixed(2));
              expect(
                  parseFloat(ethers.utils.formatEther(requiredAmountFundedETH)).toFixed(2)
              ).to.be.equal(ethPrice.toFixed(2));
          });

          it("should require fund before creating job offer", async () => {
              await expect(
                  factory.createJobOffer(
                      EJobOfferType.SALARY,
                      ethers.utils.parseEther("1000"),
                      employee.address,
                      (60 * 60 * 24 * 30).toString(),
                      ECurrency.EUR,
                      false
                  )
              ).to.be.reverted;
          });

          it("should create job offer", async () => {
              const amount = 1000;
              const startingProviderBalance = await factory.provider.getBalance(deployer);
              const requiredAmountFundedEUR: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(amount.toString()),
                  ECurrency.EUR,
                  EJobOfferType.SALARY,
                  true
              );
              await factory.fund({ value: requiredAmountFundedEUR });
              const JobOfferTransaction = await factory.createJobOffer(
                  EJobOfferType.SALARY,
                  ethers.utils.parseEther(amount.toString()),
                  employee.address,
                  (60 * 60 * 24 * 30).toString(),
                  ECurrency.EUR,
                  true
              );
              const answer = await JobOfferTransaction.wait(1);
              const JobOffer = await ethers.getContractAt("JobOffer", answer.events[0].args[0]);
              const state = await JobOffer.getState();
              const employerData = await factory.getEmployerData();
              const employeeFactory = factory.connect(employee);
              const employeeData = await employeeFactory.getEmployeeData();
              const endingProviderBalance = await factory.provider.getBalance(deployer);
              assert.equal(
                  startingProviderBalance.add(KEEPER_COMPATIBLE_FEE).toString(),
                  endingProviderBalance.toString()
              );
              assert.equal(employeeData.offers[0].offerAddress, JobOffer.address);
              assert.equal(employerData.offers[0].offerAddress, JobOffer.address);
              assert.equal(state, EJobOfferState.UNSIGNED);
          });

          it("should run payment in contracts on performUpkeep", async () => {
              const amount = 1000;
              const startingProviderBalance = await factory.provider.getBalance(deployer);
              const requiredAmountFundedEUR: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(amount.toString()),
                  ECurrency.EUR,
                  EJobOfferType.SALARY,
                  true
              );
              await factory.fund({ value: requiredAmountFundedEUR.mul(3) });
              const JobOfferTransaction = await factory.createJobOffer(
                  EJobOfferType.SALARY,
                  ethers.utils.parseEther(amount.toString()),
                  employee.address,
                  (60 * 60 * 24 * 30).toString(),
                  ECurrency.EUR,
                  true
              );
              const answer = await JobOfferTransaction.wait(1);
              const JobOffer = await ethers.getContractAt("JobOffer", answer.events[0].args[0]);
              const connectedJobOffer = JobOffer.connect(employee);
              const startingPaymentTimestamp = await JobOffer.getLastPaymentTimestamp();
              let tx = await connectedJobOffer.sign();
              let txReceipt = await tx.wait(1);

              const contractSignedEvent = txReceipt.events[0];
              assert.equal(contractSignedEvent.args[0], employee.address);

              const state = await JobOffer.getState();
              assert.equal(state, EJobOfferState.ACTIVE);

              const startingEmployeeBalance = await employee.getBalance();
              const upKeep = await factory.checkUpkeep([]);
              assert(upKeep);
              await new Promise<void>(async (resolve, reject) => {
                  JobOffer.once("SalaryPaid", async () => {
                      try {
                          const endingEmployeeBalance = await employee.getBalance();

                          const amountFunded = await connectedJobOffer.getEthAmount();
                          const endingPaymentTimestamp =
                              await connectedJobOffer.getLastPaymentTimestamp();
                          assert(startingPaymentTimestamp < endingPaymentTimestamp);
                          assert.equal(
                              startingEmployeeBalance.add(amountFunded).toString(),
                              endingEmployeeBalance.toString()
                          );
                          const endingProviderBalance = await factory.provider.getBalance(deployer);
                          assert.equal(
                              startingProviderBalance
                                  .add(BigNumber.from(KEEPER_COMPATIBLE_FEE).mul(2))
                                  .toString(),
                              endingProviderBalance.toString()
                          );
                      } catch (e) {
                          reject(e);
                      }
                      resolve();
                  });
                  tx = await factory.performUpkeep([]);
                  txReceipt = await tx.wait(1);
              });
          });

          it("should NOT run payment in non keeper compatible contracts on performUpkeep", async () => {
              const amount = 1000;
              const requiredAmountFundedEUR: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(amount.toString()),
                  ECurrency.EUR,
                  EJobOfferType.SALARY,
                  false
              );
              await factory.fund({ value: requiredAmountFundedEUR.mul(3) });
              const JobOfferTransaction = await factory.createJobOffer(
                  EJobOfferType.SALARY,
                  ethers.utils.parseEther(amount.toString()),
                  employee.address,
                  (60 * 60 * 24 * 30).toString(),
                  ECurrency.EUR,
                  false
              );
              const answer = await JobOfferTransaction.wait(1);
              const JobOffer = await ethers.getContractAt("JobOffer", answer.events[0].args[0]);
              const connectedJobOffer = JobOffer.connect(employee);
              const startingPaymentTimestamp: BigNumber = await JobOffer.getLastPaymentTimestamp();
              let tx = await connectedJobOffer.sign();
              let txReceipt = await tx.wait(1);

              const startingEmployeeBalance = await employee.getBalance();
              const upKeep = await factory.checkUpkeep([]);
              tx = await factory.performUpkeep([]);
              txReceipt = await tx.wait(1);

              const endingEmployeeBalance = await employee.getBalance();

              const endingPaymentTimestamp: BigNumber =
                  await connectedJobOffer.getLastPaymentTimestamp();
              const state = await JobOffer.getState();
              assert(upKeep);
              assert(startingPaymentTimestamp.eq(endingPaymentTimestamp));
              assert.equal(startingEmployeeBalance.toString(), endingEmployeeBalance.toString());
              assert.equal(state, EJobOfferState.ACTIVE);
          });

          it("should emit event if employer doesn't have enough eth to auto fund", async () => {
              const amount = 1000;
              const requiredAmountFundedEUR: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(amount.toString()),
                  ECurrency.EUR,
                  EJobOfferType.SALARY,
                  true
              );
              await factory.fund({ value: requiredAmountFundedEUR });
              const JobOfferTransaction = await factory.createJobOffer(
                  EJobOfferType.SALARY,
                  ethers.utils.parseEther(amount.toString()),
                  employee.address,
                  (60 * 60 * 24 * 30).toString(),
                  ECurrency.EUR,
                  true
              );
              const answer = await JobOfferTransaction.wait(1);
              const JobOffer = await ethers.getContractAt("JobOffer", answer.events[0].args[0]);
              const connectedJobOffer = JobOffer.connect(employee);
              let tx = await connectedJobOffer.sign();
              let txReceipt = await tx.wait(1);
              const paymentEthAmount = await JobOffer.getEthAmount();
              await new Promise<void>(async (resolve, reject) => {
                  JobOffer.once("ContractNeedsToBeFunded", async (contractAddress, amount) => {
                      try {
                          assert.equal(contractAddress, JobOffer.address);
                          assert.equal(amount.toString(), paymentEthAmount.toString());
                      } catch (e) {
                          reject(e);
                      }
                      resolve();
                  });
                  tx = await factory.performUpkeep([]);
                  txReceipt = await tx.wait(1);
              });
          });

          it("should NOT fund non valid offer", async () => {
              await expect(
                  factory.fundJobOffer(ethers.utils.parseEther("1"), employee.address, false)
              ).to.be.reverted;
          });

          it("should throw error if employer without funds try to withdraw", async () => {
              await expect(factory.withdraw()).to.be.reverted;
          });

          it("should throw error if employer with non closed offer try to withdraw", async () => {
              const amount = 1000;
              const requiredAmountFundedEUR: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(amount.toString()),
                  ECurrency.EUR,
                  EJobOfferType.SALARY,
                  true
              );
              await factory.fund({ value: requiredAmountFundedEUR.mul(3) });
              const JobOfferTransaction = await factory.createJobOffer(
                  EJobOfferType.SALARY,
                  ethers.utils.parseEther(amount.toString()),
                  employee.address,
                  (60 * 60 * 24 * 30).toString(),
                  ECurrency.EUR,
                  true
              );
              await JobOfferTransaction.wait(1);
              await expect(factory.withdraw()).to.be.reverted;
          });

          it("should withdraw employer balance if all offers are closed", async () => {
              const amount = 1000;
              const requiredAmountFundedEUR: BigNumber = await factory.countRequiredFund(
                  ethers.utils.parseEther(amount.toString()),
                  ECurrency.EUR,
                  EJobOfferType.SALARY,
                  true
              );
              await factory.fund({ value: requiredAmountFundedEUR.mul(3) });
              const JobOfferTransaction = await factory.createJobOffer(
                  EJobOfferType.SALARY,
                  ethers.utils.parseEther(amount.toString()),
                  employee.address,
                  (60 * 60 * 24 * 30).toString(),
                  ECurrency.EUR,
                  true
              );
              await JobOfferTransaction.wait(1);
              const answer = await JobOfferTransaction.wait(1);
              const JobOffer = await ethers.getContractAt("JobOffer", answer.events[0].args[0]);
              const connectedJobOffer = JobOffer.connect(employer);
              let tx = await connectedJobOffer.close();
              await tx.wait(1);
              const employerFactoryBalance = (await factory.getEmployerData()).balance;
              const startingEmployerBalance = await employer.getBalance();
              tx = await factory.withdraw();
              const { gasUsed, effectiveGasPrice } = await tx.wait(1);
              const totalGasPrice: BigNumber = gasUsed.mul(effectiveGasPrice);
              const endingEmployerBalance = await employer.getBalance();
              assert.equal(
                  startingEmployerBalance.add(employerFactoryBalance).toString(),
                  endingEmployerBalance.add(totalGasPrice).toString()
              );
          });
      });
