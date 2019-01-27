pragma solidity >=0.4.22 <0.6.0;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./BehaviourToken.sol";
import "./BikeSharing.sol";

/** @title Insurance contract for the Bike Shop. */

contract Insurance is Ownable {

    using SafeMath for uint256;

    /*
                Constants regarding the Insurance company 
            
    Premium = the money you pay the insurer to buy the "promise" to be paid back if an incident occurs with the bike
    Retention = portion of the payback that is not paid back to the user
    Claim/token ratio = how many tokens does one need to redeem in order to decrease one's claim count ?
    Token_reward = how many tokens will one good ride give you ? 
    */ 

    uint256 constant public INSURANCE_RETENTION = 100 finney;
    uint256 constant public CLAIM_TOKEN_RATIO = 5;
    uint256 constant public PREMIUM_RATE = 10 finney;
    uint256 constant public TOKEN_REWARD = 1;

    /* Global Storage Variables */ 
    address insurer;                    // insurer's address
    uint256 premiumRate;                // premium rate 
    uint256 retentionAmount;            // amount to be deducted of paybacks
    address[] insuredList;              // list of insurance clients addresses
    uint256 tokenRewardFactor;          // token reward factor (1 good ride = how many tokens ?)
    uint256 claimTokenRatio;            // claim/token ratio (how many tokens can do -1 claim in history ?)
    bool internal stopSwitch;           // Emergency switch to stop all functioning
    
    // Mappings
    mapping(address => bool) isClientInsured; // Mapping to keep track of a client's insurance status
    mapping(address => InsuranceClient) insuranceMapping; // Mapping to a client's insurance data

    // Insurance client data struct
    struct InsuranceClient {
        uint256 insuredListPointer;     // Number of client in list
        uint256 totalPremiumPaid;       // Total of the premia paid by insurer
        uint256 totalRides;             // Total ride count
        uint256 grossClaims;            // Real counter of claims (total)
        uint256 netClaims;              // Net claims (after token redemptions by client)
        uint256 grossTokens;            // Total number of tokens earned so far
        uint256 nbTokensOwned;          // How many tokens the client actually has
        uint256 nbPaybacks;             // Count of paybacks given to user
        uint256 paybackAmount;          // Total amount paid back to user
    }

    /* Instances from other contracts */
    BikeSharing bikeSharing;            // The bikeshop instance
    BehaviourToken behaviourToken;      // The token instance (will be deployed by this contract)

    /*
    ================================================================
                                Events
    ================================================================
    */

    /// @dev Is the bike shop contract correctly referred to ? 
    /// @param bikeShopAddress The address of the BikeShop contract
    event BikeShopLinked(address indexed bikeShopAddress);
    /// @dev Is the token contract correctly deployed ? 
    /// @param newTokenAddress The address of the deployed token contract
    event TokenCreated(address indexed newTokenAddress);
    /// @dev A new insurance client should be created
    /// @param insAdr The account address of the new client
    event InsuranceClientCreated(address indexed insAdr);    
    
    /// @dev How many new rides did the user make ?
    /// @param client The client's address
    /// @param newValue The new ride count of the client
    /// @param byHowMuch The variation from old value (newValue - byHowMuch = oldValue)
    event RidesCountUpdate(address indexed client, uint256 newValue, uint256 byHowMuch);

    /// @dev How much is the total payback amount ? 
    event TotalPaybackAmountUpdate(address indexed client, uint256 newValue, uint256 byHowMuch);
    /// @dev How much is the claims count ? 
    event ClaimsUpdate(address indexed client, uint256 newValue, uint256 byHowMuch);
    /// @dev How much is the net claims count ? 
    event NetClaimsUpdate(address indexed client, uint256 newValue, uint256 byHowMuch);
    /// @dev How much is the total premium amount paid by the user ?
    event PremiumAmountUpdate(address indexed client, uint256 newValue, uint256 byHowMuch);
    /// @dev How much is the payback count after update ?
    event TotalPaybacksUpdate(address indexed client, uint256 newValue, uint256 byHowMuch);
    /// @dev How many claims have been repaid ? 
    event ClaimsRepaid(uint256 count, uint256 totalAmount);
    /// @dev How many tokens has the client earned so far ? 
    event TokenUpdate(address indexed client, uint256 newValue, uint256 byHowMuch);
    /// @dev How many tokens does the client have ? 
    event OwnedTokenUpdate(address indexed client, uint256 newValue, uint256 byHowMuch);

    /// @dev Approval for a rider for an amount of tokens
    event TokenApproved(address indexed _riderAddress, uint256 _rewardAmount);
    /// @dev The amount of tokens due was paid
    event TokenPaid(address indexed insuredAddress, uint256 amount);
    /// @dev The how many tokens redeemed how many claims
    event TokensClaimExchange (address indexed from, uint256 nbTokens, uint256 claimsInvolved);
    
    /// @dev Deposit occurred
    event Deposit(address indexed sender, uint256 value);
    /// @dev The switch changed
    event StopSwitchChanged(bool currentStatus);

    /*
    ================================================================
                                Modifiers
    ================================================================
    */

    /// @dev Is the client insured ? 
    /// @param _address The client's address
    modifier insuredClient (address _address) {
        require(isClientInsured[_address] == true);
        _;
    }

    /// @dev Is the function's input non-nil ?
    /// @param _input The function's argument that is tested
    modifier positiveInput (uint256 _input) {
        require(_input > 0);
        _;
    }
    
    /// @dev Emergency switch to prevent a function from executing
    modifier emergencyStop() {
        require(!stopSwitch);
        _;
    }

    /*
    ================================================================
                                Constructor
    ================================================================
    */

    /** @dev Build insurance contract after linking it to the bike contract, and deploy the reward token.
      * @param _shopAddress The bike shop's address.
      * @param _name The token's name
      * @param _tokenSymbol The token's symbol
      */

    constructor(address payable _shopAddress, string memory _name, string memory _tokenSymbol)
        public 
        Ownable()
    {
        insurer = msg.sender;
        claimTokenRatio = CLAIM_TOKEN_RATIO;
        premiumRate = PREMIUM_RATE;
        retentionAmount = INSURANCE_RETENTION;
        tokenRewardFactor = TOKEN_REWARD; 
        
        behaviourToken = new BehaviourToken(_name, _tokenSymbol);
        emit TokenCreated(address(behaviourToken));

        bikeSharing = BikeSharing(_shopAddress);
        emit BikeShopLinked(address(bikeSharing));
    }


    /*
    ================================================================
                        Insurance functions
    ================================================================
    */

    /** @dev Underwrite (=deliver an insurance contract) to a client
      * @return success The client should be insured
    */

    function underwriteInsurance()
        external
        payable
        emergencyStop
        returns (bool success)
    {
        
        require(isClientInsured[msg.sender]==false);  // The client must not be a client already      
        require(msg.value == premiumRate);            // The client must pay the 1st premium upfront

        // Create a user status
        insuranceMapping[msg.sender] = InsuranceClient(
            {
                insuredListPointer: insuredList.push(msg.sender) - 1,
                totalPremiumPaid: msg.value,
                totalRides: 0,
                grossClaims: 0,
                netClaims: 0,
                grossTokens: 0,
                nbTokensOwned: 0,
                nbPaybacks: 0,
                paybackAmount: 0
            }
        );
        
        isClientInsured[msg.sender] = true;           // Finally, include client in the mapping
        emit InsuranceClientCreated(msg.sender);      // Emit an event

        return isClientInsured[msg.sender];
    }

    /** @dev The "main" function that allows customers to pay their premia, update their claims count, get their paybacks and receive their rewards
      * @return success The function successfully regularized all payments
    */

    function regularizePayments ()
        external
        payable
        insuredClient(msg.sender)
        emergencyStop
        returns (bool success)
    {
        uint256 newRides = getNewRides(msg.sender);               // First get the number of new rides
        if (newRides == 0) return true;                           // If no new rides were performed, function returns

        uint256 pendingPremia = getPendingPremia(msg.sender);     // Get pending premia for people with new rides
        require (msg.value == pendingPremia);                     // The value paid by user must correspond to the due premia

        updateRides(msg.sender);                                  // The rides count must be updated
        updatePremiumPaid(pendingPremia, msg.sender);             // The premium count must be updated

        uint256 pendingBadRides = getPendingBadRides(msg.sender); // Get count of new claims
        require(pendingBadRides <= newRides);

        if (pendingBadRides != 0) {
            // The claims count is updated
            updateClaims(pendingBadRides, msg.sender);
            uint256 paybackAmount = pendingBadRides.mul(getClaimAmount(bikeSharing.getBikeValue(), retentionAmount));
            // The payback is updated if it is non-nil
            if (paybackAmount != 0) {
                updatePayback(paybackAmount, pendingBadRides, msg.sender);
                msg.sender.call.value(paybackAmount);
                emit ClaimsRepaid(pendingBadRides, paybackAmount);
            }
        }

        // Check consistency with claims number and paybacks
        InsuranceClient memory insured = insuranceMapping[msg.sender]; 
        require(insured.grossClaims - insured.nbPaybacks == 0);
        
        // Distribute rewards
        uint256 pendingTokens = getPendingTokens(msg.sender); 
        require(insured.grossTokens + pendingTokens == bikeSharing.getGoodRides(msg.sender));
        
        if (pendingTokens > 0) {
            emit TokenApproved(msg.sender, pendingTokens);
            // Mint a token for the user
            behaviourToken.mint(msg.sender, pendingTokens);
            emit TokenPaid(msg.sender, pendingTokens);
            // Finally, upate the token count
            updateTokenCount(pendingTokens, msg.sender);
        }
        
        return true;
    }

    /** @dev Function allowing the insurance client to redeem a few tokens against a reduction in claims history
      * @param nbTokens The number of tokens the client wants to redeem
      * @return success The function successfully burnt the redeemed tokens
    */
    function tokenClaimReducer(uint256 nbTokens)
        external
        insuredClient(msg.sender)
        positiveInput(nbTokens)
        returns (bool success)
    {
        require(nbTokens >= claimTokenRatio);

        InsuranceClient storage insured = insuranceMapping[msg.sender];
        require(insured.nbTokensOwned >= nbTokens);
        require(insured.netClaims > 0);

        (uint256 claimsToDecrease, uint256 exchangedTokens) = tokenAccounting(nbTokens);
        // Burn tokens 
        behaviourToken.burn(msg.sender, exchangedTokens);
        // Keep accounting
        insured.nbTokensOwned -= exchangedTokens;
        insured.netClaims -= claimsToDecrease;
    
        emit TokensClaimExchange(msg.sender, nbTokens, claimsToDecrease);
    
        return true;

    }

    /*
    ================================================================
                            View functions
    ================================================================
    */

    /** @dev Check the premium applicable to one address
      * @param insuranceTaker The address of the insurance buyer
      * @return premium The premium eligible to the address (depending on the customer's past claims)
    */    
    function calculatePremium(address insuranceTaker) 
        internal
        view
        insuredClient(insuranceTaker)
        returns (uint256 premium)
    {
        InsuranceClient memory customer = insuranceMapping[insuranceTaker];
        return (customer.netClaims + 1).mul(premiumRate);
    }

    /// @dev View the Premium that is owed to Insurer
    /// @param insuredAddress The address of the user
    /// @return pendingPremia The premia that are still due for the rides.
    function getPendingPremia (address insuredAddress)
        view
        public
        returns (uint256 pendingPremia)
    {   
        uint256 newRides = getNewRides(insuredAddress);
        return newRides.mul(calculatePremium(insuredAddress));
    }

    /// @dev Retrive the claim amount that will be paid back to the client
    /// @param grossAmount The value of the claim to repay the client.
    /// @param retention The retention (portion of value not reimbursed to client).
    /// @return claimAount The amount that will be paid back to user
    function getClaimAmount(uint256 grossAmount, uint256 retention)
        pure
        internal
        returns (uint256 claimAmount)
    {
        return grossAmount.sub(retention);
    }

    /// @dev Reads the number of rides (difference between insurance and bike data) 
    /// @param insuredAddress The address of the user
    /// @return countNewRides The new rides done by the user
    function getNewRides (address insuredAddress)
        internal
        view
        returns (uint256 countNewRides) 
    {
        InsuranceClient memory insured = insuranceMapping[insuredAddress];
        uint256 ridesCount = bikeSharing.getTotalRides(insuredAddress);

        if (ridesCount > insured.totalRides) {
            uint256 newRides = ridesCount.sub(insured.totalRides);
            return newRides;
        } else {
            return 0;
        }
    }

    /// @dev Get the number of bad rides that is not yet taken into account by insurer 
    /// @param insuredAddress The address of the user
    /// @return countBadRides The "bad" rides done by the user
    function getPendingBadRides (address insuredAddress)
        internal
        view
        returns (uint256 countBadRides)
    {
        InsuranceClient memory insured = insuranceMapping[insuredAddress];
        uint256 numberBadRides = bikeSharing.getTotalRides(insuredAddress).sub(bikeSharing.getGoodRides(insuredAddress));
        return numberBadRides.sub(insured.nbPaybacks);
    }

    /// @dev Get number of tokens the user is eligible to but hasn't received yet
    /// @param insuredAddress The address of the user
    /// @return pendingTokens The tokens owed to the user
    function getPendingTokens (address insuredAddress)
        private
        view
        returns (uint256 pendingTokens)
    {
        //address insuredAddress = msg.sender;
        InsuranceClient memory insured = insuranceMapping[insuredAddress];
        uint256 tokenEligibleRides = bikeSharing.getGoodRides(insuredAddress);
        return (tokenEligibleRides.sub(insured.grossTokens)).mul(tokenRewardFactor);
    }

    /// @dev A number of tokens is being evaluated to define how many claims it can decrease
    /// @param nbTokens The number of tokens one wishes to redeem
    /// @return claimsToDecrease The claims that can be decreased with nbTokens
    /// @return exchangedTokens The tokens that will be exchanged to decrease the claims.
    function tokenAccounting(uint256 nbTokens)
        internal
        view
        positiveInput(nbTokens)
        returns (uint256 claimsToDecrease, uint256 exchangedTokens)
    {
        claimsToDecrease = nbTokens.div(claimTokenRatio);
        uint256 surplus = nbTokens.mod(claimTokenRatio);
        exchangedTokens = nbTokens.sub(surplus);

        return (claimsToDecrease, exchangedTokens);
    }

    /// @dev Get the data history that insurer has on a client
    /// @param insuredAddress The address of the user
    /// @return insuredListPointer The rank in terms of subscription of a client
    /// @return totalPremiumPaid The total premium received by the insurer from the client
    /// @return totalRides The total count of rides done by user
    /// @return grossClaims The history of claims
    /// @return netClaims The claims count according to which the premium is calculated
    /// @return grossTokens The history of received tokens
    /// @return nbTokensOwned The tokens effectively owned by the user
    /// @return nbPaybacks The paybackts count for a user
    /// @return paybackAmount How much did I pay in payback to this user
    function viewInsuranceStatus (address insuredAddress)
        external
        view
        returns (uint256 insuredListPointer, uint256 totalPremiumPaid, 
        uint256 totalRides, uint256 grossClaims, uint256 netClaims,
        uint256 grossTokens, uint256 nbTokensOwned, uint256 nbPaybacks, uint256 paybackAmount)
    {
        InsuranceClient memory client = insuranceMapping[insuredAddress];
        return (client.insuredListPointer, client.totalPremiumPaid, client.totalRides, 
        client.grossClaims, client.netClaims, client.grossTokens, client.nbTokensOwned, 
        client.nbPaybacks, client.paybackAmount);
    }
    
    /*
    ================================================================
                            Updating functions
    ================================================================
    */

    /// @dev The payback data in client's struct is updated
    /// @param paybackAmount The amount that is paid back to the user
    /// @param pendingBadRides The bad rides that are accounted for, that have to be paid back
    /// @param insuredAddress The client's address
    function updatePayback (uint256 paybackAmount, uint256 pendingBadRides, address insuredAddress)
        internal
        positiveInput(paybackAmount)
        positiveInput(pendingBadRides)
    {
        InsuranceClient storage insured = insuranceMapping[insuredAddress];
        insured.nbPaybacks += pendingBadRides;
        emit TotalPaybacksUpdate(insuredAddress, insured.nbPaybacks, pendingBadRides);
        insured.paybackAmount += paybackAmount;
        emit TotalPaybackAmountUpdate(insuredAddress, insured.paybackAmount, paybackAmount);        
    }

    /// @dev The number of rides of a client is updated
    /// @param insuredAddress The client's address
    function updateRides (address insuredAddress)
        internal
    {
        uint256 newRides = getNewRides(insuredAddress);
        InsuranceClient storage insured = insuranceMapping[insuredAddress];
        insured.totalRides += newRides;
        emit RidesCountUpdate(insuredAddress, insured.totalRides, newRides);
    }


    /// @dev The total premium paid by user is updated
    /// @param premiumAmount The amount that is paid back to the user
    /// @param insuredAddress The client's address
    function updatePremiumPaid (uint256 premiumAmount, address insuredAddress)
        internal
        positiveInput(premiumAmount)
    {
        InsuranceClient storage insured = insuranceMapping[insuredAddress];
        insured.totalPremiumPaid += premiumAmount;
        emit PremiumAmountUpdate(insuredAddress, insured.totalPremiumPaid, premiumAmount);
    }

    /// @dev The claims data is reconciled with the number of bad rides read from BikeShop contract
    /// @param pendingBadRides The bad rides that are accounted for, that have to be paid back
    /// @param insuredAddress The client's address
    function updateClaims (uint256 pendingBadRides, address insuredAddress) 
        internal
        positiveInput(pendingBadRides)
    {
        InsuranceClient storage insured = insuranceMapping[insuredAddress];
        insured.grossClaims += pendingBadRides;
        emit ClaimsUpdate(insuredAddress, insured.grossClaims, pendingBadRides);
        insured.netClaims += pendingBadRides;
        emit NetClaimsUpdate(insuredAddress, insured.netClaims, pendingBadRides);
    }

    /// @dev The count of tokens gained by the user is updated
    /// @param pendingTokens The tokens that are owed to the client
    /// @param insuredAddress The client's address
    function updateTokenCount (uint256 pendingTokens, address insuredAddress)
        internal
        positiveInput(pendingTokens)
    {
        InsuranceClient storage insured = insuranceMapping[insuredAddress];
        insured.grossTokens += pendingTokens;
        emit TokenUpdate(insuredAddress, insured.grossTokens, pendingTokens);
        insured.nbTokensOwned += pendingTokens;
        emit TokenUpdate(insuredAddress, insured.nbTokensOwned, pendingTokens);
    }
      
    /* 
    ================================================================
                            Getter functions
    ================================================================
    */
    
    /** @dev Allow for external user (or test script) to check if a client is insured
      * @param clientAdr The user's address
      * @return isIndeed Boolean for a client's insured status
      */
    function isInsured(address clientAdr) 
        external 
        view 
        returns (bool isIndeed)
    {
        return isClientInsured[clientAdr] == true;
    }

    /** @dev Allow for external user (or test script) to count the clients
      * @return clientCount Count (integer) of total users
    */
    function insuredClientsCount()
        external
        view
        returns (uint256 clientCount)
    {
        return insuredList.length;
    }

   /** @dev Allow external user (or test script) to know the premium rate
      * @return rate The applicable rate (at underwriting and for pay-as-you-drive payments)
    */ 
    function getPremiumRate()
        external
        view
        returns (uint256 rate)
    {
        return premiumRate;
    }

   /** @dev Allow external user (or test script) to know the claimTokenRatio
      * @return ratio The applicable ratio
    */ 
    function getClaimTokenRatio()
        external
        view
        returns (uint256 ratio)
    {
        return claimTokenRatio;
    }


    /* 
    ================================================================
                            Fallback function
    ================================================================
    */

   /** @dev Fallback function to allow only the owner of the Insurance contract to deposit value 
    */ 
    function ()
        external
        payable
        onlyOwner()
    {
        if (msg.value > 0) {
            emit Deposit(msg.sender, msg.value);
        }
    }

    /* 
    ================================================================
                            Emergency switch
    ================================================================
    */

   /** @dev Emergency switch
    * @return alarmOn A boolean that blocks function execution if true.
    */ 

    function emergencySwitch()
        external
        onlyOwner()
        returns (bool alarmOn)
    {
        if (stopSwitch == false) {
            stopSwitch = true;
        } else {
            stopSwitch = false;
        }
        
        emit StopSwitchChanged(stopSwitch);
        
        return stopSwitch;
    }

}