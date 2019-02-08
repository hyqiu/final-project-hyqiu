import React, { Component } from "react";
import BikeSharing from "./build/contracts/BikeSharing.json";
import Insurance from "./build/contracts/Insurance.json";
import getWeb3 from "./utils/getWeb3";

import "./App.css";

class App extends Component {
  
  constructor(props) {
    super(props);
    this.state = {
      storageValue: 0, web3: null, accounts: null,
      accountNumber: 0,
      activeAccount: '',
      activeAccountBalance: 0,
      defaultIntInput: 0,
      
      // Bike
      bikeContractRunning: true,
      depositValue: 0,
      bikeCondition: true, 
      returnedAmount: 0,

      // Bike user
      inRide: 0,
      ridesCount: 0,
      goodRidesCount: 0,
      currentBikeId:'',
      lastBikeId: '',
      ridesCompleted: 0,

      // Insurance
      boughtInsurance: false,
      premiumRate : 0,
      pendingPremia: 0,
      countClaims: 0,
      insuredRides: 0,
      applicablePremium: 0,
      
      // Tokens
      tokenName: 'BehaviourToken',
      symbol: 'BHT',
      tokensOwned: 0,
      tokensRedeemed: 0,
      ratioClaimToken: 0,
    };
  }; 
  /*Function that handles account changes in Metamask*/
  handleAccountChange = async () => {
    const {web3, activeAccount} = this.state;
    const refreshedAccounts = await web3.eth.getAccounts();
    if (refreshedAccounts[0] !== activeAccount) {
      this.setState({
        accounts: refreshedAccounts,
        activeAccount: refreshedAccounts[0]
      });
      alert("Main account has changed");
    }
  };

  inputChangeHandler = (event) => {
    this.setState({[event.target.id]: event.target.value});
  };

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
      const insuranceAddress = insuranceInstance.options.address;

      // Set state 
      this.setState({
        web3, 
        accounts,
        bikeContract: bikeInstance,
        insuranceContract: insuranceInstance,
        insuranceAddress: insuranceAddress,
        activeAccount: accounts[0],
      });

      // Get my balance
      const userBalance = await web3.eth.getBalance(this.state.activeAccount);
      this.setState({
        activeAccountBalance: userBalance,
      })

      // Get my history as user
      const bikeUserData = bikeInstance.methods.checkUser(accounts[0]);
      await bikeUserData.call({from: accounts[0]})
      .then((receipt) => {
        console.log(receipt);
        this.setState({
          inRide: receipt[0],
          ridesCount: receipt[3],
          ridesCompleted: receipt[3],
          goodRidesCount: receipt[4]
        });
      });

      // Is the user insured ? 
      const checkInsured = insuranceInstance.methods.isInsured(accounts[0]);
      await checkInsured.call({from: accounts[0]})
      .then((receipt) => {
        //console.log(receipt);
        this.setState({
          boughtInsurance: receipt
        })
      });

      // Check the insured's status
      const checkInsuredStatus = insuranceInstance.methods.viewInsuranceStatus(accounts[0]);
      await checkInsuredStatus.call({from: accounts[0]})
      .then((receipt) => {
        this.setState({
          insuredRides: parseInt(receipt[2]),
          tokensOwned: parseInt(receipt[6]),
        })
      })

      // Set constants : Deposit / Premium rate / Claim_Token ratio
      const setDeposit = bikeInstance.methods.getBikeValue();
      await setDeposit.call({from: accounts[0]})
      .then((receipt) => {
        this.setState({
          depositValue: receipt
        });
      });
      
      const setPremium = insuranceInstance.methods.getPremiumRate();
      await setPremium.call({from: accounts[0]})
      .then((receipt) => {
        this.setState({
          premiumRate: receipt
        });
      });

      const setRatio = insuranceInstance.methods.getClaimTokenRatio();
      await setRatio.call({from: accounts[0]})
      .then((receipt) => {
        //console.log(receipt);
        this.setState({
          ratioClaimToken: receipt
        });
      });

    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`,
      );
      console.error(error);
    }
  };


// Event for renting the bike
  handleRentBike = async (event) => {
    event.preventDefault();
    await this.handleAccountChange();
    const {accounts, bikeContract, currentBikeId, depositValue, ridesCount}  = this.state;
          
    const rentBike = bikeContract.methods.rentBike(currentBikeId);
    await rentBike.send({from: accounts[0], value: depositValue})
    .once('receipt', (receipt) => {
      //console.log(receipt);
      this.setState({
        ridesCount: ridesCount + 1,
        inRide: 1,
      })
    })
    .on('error', console.error);
  };

// Event for surrendering the bike
  handleSurrenderBike = async (event) => {
    event.preventDefault();
    await this.handleAccountChange();
    const {accounts, bikeContract, currentBikeId, bikeCondition, ridesCompleted, boughtInsurance, insuredRides, tokensOwned, applicablePremium, countClaims}  = this.state;
    
    const surrenderBike = bikeContract.methods.surrenderBike(currentBikeId, bikeCondition);
    await surrenderBike.send({from: accounts[0]})
    .once('receipt', (receipt) => {
      //console.log(receipt);
      const getReturned = bikeContract.methods.getReturned(accounts[0]);
      getReturned.call({from: accounts[0]})
      .then((receipt) => {
        //console.log(receipt);
        this.setState({
          returnedAmount : receipt,
          lastBikeId: currentBikeId,
          inRide: 0,
          ridesCompleted: ridesCompleted + 1,
          insuredRides: boughtInsurance ? insuredRides + 1 : 0,
          tokensOwned: bikeCondition && boughtInsurance ? tokensOwned + 1 : tokensOwned,
          applicablePremium: boughtInsurance ? applicablePremium : 0,
          countClaims: !bikeCondition && boughtInsurance ? countClaims + 1 : countClaims,
        });
      });
    })
    .on('error', console.error);
  };

  handleUnderwriting = async (event) => {
    event.preventDefault();
    await this.handleAccountChange();
    const {accounts, insuranceContract, premiumRate} = this.state;
    const underwriteInsurance = insuranceContract.methods.underwriteInsurance();
    await underwriteInsurance.send({from: accounts[0], value: this.state.premiumRate})
    .once('receipt', (receipt) => {
      //console.log(receipt);
      this.setState({
        boughtInsurance: true,
      })
    })
    .on('error', console.error);
  };

// Handle radio button calls
  radioHandler = (event) => {
    if(event.target.value === "BadCondition"){
      this.setState({
        bikeCondition: false
      })
    }
    else if(event.target.value === "GoodCondition"){
      const {goodRidesCount} = this.state;
      this.setState({
        bikeCondition: true,
        goodRidesCount: goodRidesCount + 1
      })      
    }
  };

  handleIntInput = (event) => {
    const intInput = (event.target.validity.valid) ? event.target.value : this.state.defaultIntInput;
    this.setState({ defaultIntInput: intInput });
  };

  handleRegularizePayments = async (event) => {
    event.preventDefault();
    await this.handleAccountChange();
    const {accounts, insuranceContract} = this.state;

    const pendingPayments = insuranceContract.methods.getPendingPremia(accounts[0]);
    await pendingPayments.call({from: accounts[0]})
    .then((receipt) => {
      //console.log(receipt);
      this.setState({
        pendingPremia: receipt
      });
      const regularize = insuranceContract.methods.regularizePayments();
      regularize.send({from: accounts[0], value: this.state.pendingPremia})
      .once('receipt', (receipt) => {
        //console.log(receipt);
        const getInsuredStatus = insuranceContract.methods.viewInsuranceStatus(accounts[0]);
        getInsuredStatus.call({from: accounts[0]})
        .then((receipt) => {
          this.setState({
            countClaims: parseInt(receipt[4]),
            tokensOwned: parseInt(receipt[6])
          });
        });
      })
      .on('error', console.error);
    });
  };

  handleRedeemTokens = async (event) => {
    event.preventDefault();
    await this.handleAccountChange();
    const {accounts, insuranceContract, ratioClaimToken, tokensOwned, tokensRedeemed, countClaims} = this.state;

    if(tokensRedeemed > tokensOwned || tokensRedeemed < ratioClaimToken || countClaims === 0){
      this.setState({
        tokensRedeemed: 0
      });
    }
    else {
      const tokenArithmetic = insuranceContract.methods.tokenAccounting(tokensRedeemed);
      await tokenArithmetic.call({from: accounts[0]})
      .then((receipt) => {
        const newClaims = countClaims - receipt[0];
        const newTokenCount = tokensOwned - receipt[1];        
        const claimReducer = insuranceContract.methods.tokenClaimReducer(tokensRedeemed);
        claimReducer.send({from: accounts[0]})
        .once('receipt', (receipt) => {
          //console.log(receipt);
          this.setState({
            'countClaims': newClaims,
            'tokensOwned': newTokenCount,
          });
        })
        .on('error', console.error);
      });
    }
  }

  render() {
    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (

      <div className="App">
       
        <div className="py-3">
          {/*See current account*/} 
          <p className="font-weight-bold">Current User: {this.state.activeAccount}</p>
          <p className="font-weight-bold">Currently in ride : {(this.state.inRide === 1) ? 'true' : 'false'}</p>
        </div>

          {/*Check your balance
            1) Your account address is x
            2) Your balance is y
          */}

          {/* Rent your bike - input : bikeId
            1) You rented bike number x
            2) You paid a deposit for the bike
          */}

          {/* Return your bike - input : bikeId and condition
            1) You returned bike number x
            2) Your usage fee was
            3) You were paid back
          */}

          {/*First display the bike store, with 2 buttons : rent and return bike*/}    
      <div>
        <h2 className="font-weight-bold py-2"> BIKE STORE </h2>          
          <h4 className="font-weight-normal">Rent Bike</h4> {/*Bike Rental*/}

          <form onSubmit={this.handleRentBike}> {/*In this form, you only need to input the bike ID*/}
            <div className="form-row"> 
              <div className="col"></div>
              <div className="col-3">
                <label htmlFor="inputBikeID" className="col-form-label">Bike ID</label>
              </div>
              <div className="col-4">
                <input 
                  type="text"
                  pattern="[0-9]*"
                  className="form-control form-control-sm" 
                  id="currentBikeId"
                  onInput={this.handleIntInput.bind(this)}
                  onChange = {this.inputChangeHandler}
                />
              </div>
              <div className="col"></div>
            </div>
            <button type="submit">Rent Bike</button>
          </form>
          {
           this.state.ridesCount == 0
           ? <p>This is your first ride !</p>
           : <p>You last rented bike no. {this.state.currentBikeId} and paid {this.state.depositValue} wei in deposit </p>
          }
          <h4 className="font-weight-normal">Surrender Bike</h4> {/*Bike Surrendering*/}
          <form onSubmit={this.handleSurrenderBike}>
            
            <div className="form-row"> {/*The new condition*/}
              <div className="col"></div>
              <div className="col-3">
                <label htmlFor="inputNewCondition" className="col-form-label">Returned bike condition ?</label>
              </div>
              <div className="col-4">
                <input 
                  type="radio" 
                  className="form-control radio" 
                  name="radio-condition"
                  value="BadCondition"
                  onChange={this.radioHandler}
                />
                <label className="k-radio-label">Bad condition</label>
                
                <input 
                  type="radio" 
                  className="form-control radio" 
                  name="radio-condition"
                  value="GoodCondition" 
                  onChange={this.radioHandler}
                />
                <label className="k-radio-label">Good condition</label>
              </div>
              <div className="col"></div>
            </div>
            <button type="submit">Return Bike</button>
          </form>
          {
            this.state.ridesCompleted < this.state.ridesCount
            ? <p>Waiting for the ride to be completed</p>
            : <p>You returned bike no. {this.state.lastBikeId} in good state : {(this.state.bikeCondition === true) ? 'true' : 'false'}, so you were returned {this.state.returnedAmount} wei</p>
          }

      </div> {/*Bike store ends*/}

    {/*Then display the insurance corner, with 3 buttons : buy insurance, regularize payments, ask to redeem */}
      
      <div> {/*Insurance corner starts*/}

        <h2 className="font-weight-bold py-2"> INSURANCE CORNER </h2>
          
          {/* Underwrite your Insurance - how much you paid */}

          <h4 className="font-weight-normal">Underwrite insurance</h4>  {/*Underwrite*/}
          <div>
            <button type="submit" onClick={this.handleUnderwriting}>Underwrite</button>
            {
              this.state.boughtInsurance
              ? <p>You underwrote insurance contract with company {this.state.insuranceAddress} and paid {this.state.premiumRate} wei as upfront premium</p>
              : <p>You have no insurance</p>
            }
          </div>

        <h4 className="font-weight-normal">Regularize payments</h4>  {/*Regularize*/}

        <div>
          <button type="submit" onClick={this.handleRegularizePayments}>Regularize</button>
          {
            this.state.boughtInsurance
            ? <p>You paid {this.state.pendingPremia} wei for {this.state.insuredRides} insured rides, your net claim count is {this.state.countClaims}</p>
            : <p>You have no insurance</p>
          }
        </div>

        {/* Redeem your tokens -
        1) Historically you earned x tokens in total
        2) You redeemed y tokens, which decreases your claim count by z
        3) You now own xx tokens
        */}
        
        <h4 className="font-weight-normal">Redeem Tokens</h4>  {/*Redeem*/}
        {
          this.state.boughtInsurance
          ? <p>You own {this.state.tokensOwned} {this.state.tokenName} ({this.state.symbol})</p>
          : <p>You have no insurance</p>
        }        
        <p>The redemption rate is {this.state.ratioClaimToken}, hence {this.state.ratioClaimToken} is the minimum accepted amount of tokens</p>
            <form onSubmit={this.handleRedeemTokens}>
              <div className="form-row"> {/*The bike ID*/}
                <div className="col"></div>
                <div className="col-3">
                  <label htmlFor="nbTokens" className="col-form-label">Tokens to redeem</label>
                </div>
                <div className="col-4">
                  <input 
                    type="text"
                    pattern="[0-9]*"
                    className="form-control form-control-sm" 
                    id="tokensRedeemed"
                    onInput={this.handleIntInput.bind(this)}
                    onChange={this.inputChangeHandler}
                  />
                </div>
                <div className="col"></div>
              </div>

              <button type="submit">Redeem Tokens</button>
            </form>
            {
              /*
              <p>You own {this.state.tokensOwned} {this.state.tokenName} ({this.state.symbol})</p>
              <p>You redeemed {this.state.tokensRedeemed} tokens</p>
              <p>You now own {this.state.tokensOwned} tokens</p>
              <p>Your current claims count is {this.state.countClaims}</p>
              */
            }

      </div> 
    </div> 
    );
  }
}

export default App;


  