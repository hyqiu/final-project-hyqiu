# On-demand Insurance scheme for Bike Sharing shop

This is the submission repository for the Consensys Academy Developer's Program 2019.

## Project Motivation

### Executive summary

This project simulates a bike renting shop, whose business model is characterized by charging users according to the time they spent on a ride. The shop's offer is bundled with an on-demand insurance scheme that covers the claim fees due when a user returns a bike in bad condition. Users' risk profiles are determined according to each user's claims history (i.e. the number of rides at the end of which the bike was returned in bad condition), and the insurance premium they pay is proportional to the claims history. Each user is given the chance to demonstrate good riding behaviour, in exchange of having the right to adjust the premium they have to pay.

### Setting

The bike shop functions as follows :
- 1000 bikes are available for rent. A customer rents a bike, rides it for a certain amount of time and returns it.
- At rental time, the customer pays a deposit corresponding to the bike's face value. When they return the bike, they are charged according to the time (in minutes) spent riding the bike.
- When returned, a bike can be in good or bad condition.
	* If the bike is in good condition, the deposit is returned to the user, minus the fee corresponding to the time spent riding the bike.
	* If the bike is in bad condition, the deposit is not returned to the user.
	* If the bike has been ridden for more than 24 hours, the deposit is not returned to the user.

The insurance scheme proposed on top of the renting process functions as follows:
- Users can choose to underwrite insurance, so that their deposit can be reimbursed in part if they damage the bike.
- Users pay an insurance premium :
	* At underwriting time (i.e. user chooses to buy insurance), the user must pay the first premium upfront.
	* Subsequently, the premium works as "pay-as-you-ride" : the user only pays as much premium as the number of rides that he or she has made.
- Provided the user bought insurance, at the end of a ride :
	* If the bike is returned in good condition, an ERC20 token is minted for the user, as reward for "good riding behaviour".
	* If the bike is returned in bad condition, the deposit is paid back to the user, minus a retention.
- The premium amount is conditioned on the number of claims (i.e. times they returned a bike in bad condition), so that "The more claims a user made in the past, the more he/she is going to pay".
- A user can redeem tokens they earned as "good riders" to decrease their claims history.

### Project Documentation

A detailed proposal, accompanied with user stories, can be found here : https://docs.google.com/document/d/1zwJ7NHm3kzYCB-VVPoxrDVtCFVXr2wuTwtEQvOV5g7c/edit?usp=sharing

## Application proposal

The solution is presented in the form of a dApp (decentralized Application), that a user may interact with.

The app is deployed on GitHub : https://hyqiu.github.io/ca_react_dapp/

It can also be run locally (see below).

### What does the dApp do ?

The dApp allows the user to :
- Rent a bike, and then return it by indicating the state (good / bad condition) in which the bike is returned.
- Purchase insurance, pay the due premia, whose level depend on the number of claims.
- Gain tokens which can be redeemed in exchange for wiping out a certain number of claims

Four major functionalities can be carried out with the dApp :
1. Rent and return a bike
2. Underwrite insurance
3. Regularize premia payments
4. Redeem Tokens

Details are provided in the `App Use Cases` of the documentation : https://docs.google.com/document/d/1zwJ7NHm3kzYCB-VVPoxrDVtCFVXr2wuTwtEQvOV5g7c/edit?usp=sharing

### Illustrated tutorial

A detailed walkthrough can be found at the following link (GSlides) : https://docs.google.com/presentation/d/1Vy7sgw3CK5oGi2UX00JY4Sm9sXU_NCc8OJjHkjsT99Q/edit?usp=sharing

## Local dApp deployment

The app can be run locally, using a localhost. Please follow the below instructions.

### Prerequisites

* Truffle v5.0.0 (core: 5.0.0)
* Solidity v0.5.0 (solc-js)
* Node v8.10.0
* Web3 ^1.0.0-beta.35
* Ganache-CLI v6.2.5
* "openzeppelin-solidity": "2.1.2"

### Setup

First clone the repository and initalize it using npm :
```bash
git clone https://github.com/dev-bootcamp-2019/final-project-hyqiu.git
cd final-project-hyqiu
npm install
```

Navigate to the "client" folder and initalize it :
```bash
cd client
npm install
```

Make sure the Metamask plugin is installed on your browser. If you do not have one already, create an account and write down the mnemonic (12 words) associated to your account.

In your Terminal, initialize `ganache-cli` with your mnemonic.
```bash
ganache-cli -m "your mnemonic"
```

Ganache points to port 8545, so set the MetaMask network to `Localhost:8545`.

### Unit testing

The unit tests are located in the `test` folder and carry out the necessary checkups for bike rental, insurance payouts and token distribution.

Go to the project root and carry out the `migrate` step, then run tests.
```bash
truffle migrate --reset --all
truffle test
```

NOTE : Please refer to the first slide of the illustrated tutorial - due to React app limitations and contract build destination issues, please copy the `./build/contracts` folder into `./client/src/` and replace the old `contracts` folder.

### Local dev server

Go to the `client` foler and start the local server.
```bash
cd client
npm run start
```

Then follow the instructions illustrated by the tutorial : https://docs.google.com/presentation/d/1Vy7sgw3CK5oGi2UX00JY4Sm9sXU_NCc8OJjHkjsT99Q/edit?usp=sharing


## Files of interest

* `deployed_addresses.txt`: File listing the deployed contracts on Rinkeby testnet (id: 4) that can be on https://rinkeby.etherscan.io/
* `avoiding_common_attacks.md`: File listing 4 risks associated to the contracts as deployed.
* `design_patterns.md`: File listing the design patterns involved in the project
