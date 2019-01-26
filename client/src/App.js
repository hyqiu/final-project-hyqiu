import React, { Component } from "react";
import BikeSharing from "../../build/contracts/BikeSharing.json";
import Insurance from "../../build/contracts/Insurance.json";
import getWeb3 from "./utils/getWeb3";

import "./App.css";

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      storageValue: 0, web3: null, accounts: null,
      accountNumber: 0,
      activeAccount: '',
      
      // Bike
      bikeClientsList : [],
      clientCount: 0,
      depositValue: 0,
      ridesCount: 0,
      goodRidesCount: 0,

      // Insurance
      insuranceClientsList : [],
      premiumRate : 0,
      pendingPremia: 0,
      countClaims: 0,
      claimTokenRatio: 0,
      
      // Tokens
      tokenName: 'BehaviourToken',
      symbol: 'BHT'
    };
  }

  /*Function that handles account changes in Metamask*/
  handleAccountChange = async () => {
    const {web3, activeAccount} = this.state;
    const refreshedAccounts = await web3.eth.getAccounts();
    if (refreshedAccounts[0] != activeAccount) {
      this.setState({
        activeAccount: refreshedAccounts[0]
      });
      alert("Main account has changed");
    }
  }

  /*
  handleAccountChange : OK
  handleRegularizePayments
  handleUnderwriting
  handleSurrenderTokens
  handle
  */



  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();

      // Get the contracts instances.
      const networkId = await web3.eth.net.getId();
      const bike_deployedNetwork = BikeSharing.networks[networkId];
      const bikeInstance = new web3.eth.Contract(
        BikeSharing.abi,
        bike_deployedNetwork && bike_deployedNetwork.address,
      );
      const insurance_deployedNetwork = Insurance.networks[networkId];
      const insuranceInstance = new web3.eth.Contract(
        Insurance.abi,
        insurance_deployedNetwork && insurance_deployedNetwork.address,
      );

      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      this.setState({ web3, accounts, contract: instance }, this.runExample);
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`,
      );
      console.error(error);
    }
  };

  runExample = async () => {
    const { accounts, contract } = this.state;

    // Stores a given value, 5 by default.
    await contract.methods.set(5).send({ from: accounts[0] });

    // Get the value from the contract to prove it worked.
    const response = await contract.methods.get().call();

    // Update state with the result.
    this.setState({ storageValue: response });
  };

  render() {
    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (
      <div className="App">
        <h1>Good to Go!</h1>
        <p>Your Truffle Box is installed and ready.</p>
        <h2>Smart Contract Example</h2>
        <p>
          If your contracts compiled and migrated successfully, below will show
          a stored value of 5 (by default).
        </p>
        <p>
          Try changing the value stored on <strong>line 40</strong> of App.js.
        </p>
        <div>The stored value is: {this.state.storageValue}</div>
      </div>
    );
  }
}

export default App;
