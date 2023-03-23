
# JobOfferFactory

Smart contract for creating job offers

Hardhat deploy, verify and test enviroment


## Deployed on

- [Sepolia](https://sepolia.etherscan.io/address/0x7400c70EB8e3Ab51D671f87D271E2eBb8Bd5f4Eb)
- [Goerli](https://goerli.etherscan.io/address/0x0a114E3062FaF6f4AAa61A185e7370828e50dC11)
- [Mumbai](https://mumbai.polygonscan.com/address/0x2525664C7Ed3cB16BE1aC11f5285D94f3D068B98)

## Ready to be deployed on

- Arbitrum
- Optimism
- Ethereum
- Avalanche


## FAQ

#### How to create job offer?
    1)Fund JobOfferFactory on some amount of ETH
    2)use createJobOffer function to create job offer
#### Which parameters takes createJobOffer function?
    1) OfferType(0-HOURLY, 1-SALARY)
    Salary - each payment gives employee setted amount
    Hourly - employee can set his worked hours
    each payment gives setted amount * worked hours
    
    2) PaymentAmount(uint256) 
    Payment amount of job offer
    
    3) employeeAddress(address)
    Address of the employee
    
    4) paymentRate(uint256)
    Time is seconds that should pass between each payment
    
    5) Currency(0-native currency of chain, 1 - usd, 2 - eur)
    Each payment is gonna be paid in native currency of chain,
    but if currency is setted to usd or eur, payment amount is gonna
    be counted by currency/native currency rate
    
    6) keeperCompatible if true, every month contract will be 
    checked and if payment is available, will run it automatically

##### Created contract
    1)Will have an UNSIGNED state, payment is unavailable until employee sign it 

#### How to make contract active?
    To become active, employee should call "sign" function
    It will emits event "ContractSigned"
#### How much do I need to fund?
    Each jobOffer requires start fund on 3 * amount for the SALARY
    type and for 528 * amount for the HOURLY type, you can count
    it with countRequiredFund function

#### How payment works?
    1)if currency is not native, contract counts payment amount
    in native currency
    
    2)if type is HOURLY, payment amount is multiplying by nonPaidWorkedHours 

    3)contract sends payment amount to employee

    4)contract tries to take paymentAmount from balance of employer 
    in JobOfferFactory contract

    5)if there is not enough balance, contract emits event
    "ContractNeedsToBeFunded"

    6)contract set lastPaymentTimestamp to current timestamp
    
    7)contract emits event "SalaryPaid"

#### Who should initiate payment?
    In SALARY contract payment initiates by employer
    In HOURLY contract payment initiates by employee

#### How to initiate payment?
##### SALARY
    Employer should call "payMonthly" function
##### HOURLY 
    Employee should add his worked hours with "setWorkedHours" 
    function
    
    Then employee should call "payWorkedHours" function

#### How to close contract?
    To close contract, employee or employer should call "close" function
    It will emits event "ContractClosed"

#### What do I need to do with funds in closed contract? 
##### SALARY 
    Employer can call "withdraw" function to withdraw all remaining funds 
    from the closed contract
##### HOURLY
    Employee can call "payWorkedHours" function to pay his remaining hours, 
    but he can't call "setWorkedHours" anymore
    After all hours has been paid, employer can withdraw all remaining funds

#### How can I withdraw funds from JobOfferFactory?
    If all your contracts closed, you can call "withdraw" function to withdraw your funds



