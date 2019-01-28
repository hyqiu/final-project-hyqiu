# final-project-hyqiu

## Project Documentation

* Project description : 
* dApp functioning process : 

### Prerequisites

* Truffle v5.0.0 (core: 5.0.0)
* Solidity v0.5.0 (solc-js)
* Node v8.10.0
* Web3 ^1.0.0-beta.35
* Ganache-CLI v6.2.5

### Local Run

#### Setup 

* Clone the repository and initialize npm, 
```bash
npm install
```
* Navigate to client folder and initialize npm 
```bash
cd client
npm install
```
* Initialize ganache-cli, preferably with your metamask accounts, on port 8545
```bash
ganache-cli -m "your mnemonic"
```

#### Unit testing
* Go to project root and migrate with truffle
```bash
truffle migrate --reset --all
```
* Run tests
```bash
truffle test
```

#### dApp
* Go to `client` folder and run 
```bash
npm run start
```
* Follow the instructions in the documentation


### Used libraries

* "openzeppelin-solidity": "2.1.2"

### Files of interest


