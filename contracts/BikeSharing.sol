pragma solidity >=0.4.22 <0.6.0;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

/** @title The Bike rental Shop contract */

contract BikeSharing is Ownable {

    using SafeMath for uint256;

    /*
                Constants regarding the Bike shop 
            
    MAX_BIKE_COUNT = the number of bikes that the shop owns. A bike Id cannot be greater than this value
    BIKE_VALUE = the value of a bike, that will be asked as deposit at renting inception
    TIME_LIMIT = number of minutes in a day. If the renting time goes above this limit, the user's deposit won't be reimbursed
    MINUTE_FACTOR = convert into seconds (default time unit in Solidity)
    RENT_FEE = How much does a minute of riding cost ? 
    */ 

    uint256 constant public MAX_BIKE_COUNT = 1000;
    uint256 constant public BIKE_VALUE = 1 ether;
    uint256 constant public TIME_LIMIT = 1440; // in minutes
    uint256 constant public MINUTE_FACTOR = 60;
    uint256 constant public RENT_FEE = 500 szabo;

    /* Global Storage Variables */ 

    address bikeAdmin;                                  // The bike shop's admin
    uint256 requiredDeposit;                            // The required deposit when renting
    uint256 fee;                                        // The minute fee asked
    bool internal stopSwitch;                           // The emergency stop variable

    // Mappings
    mapping(address => Client) public clientMapping;    // Mapping from address to client data storage
    mapping(uint256 => Bike) bikeMapping;               // Mapping from bike index to bike data
    mapping(uint256 => bool) isBikeActive;              // Mapping to check if bike has been activated for the 1st time
    mapping(address => bool) isBikeClient;              // Mapping to check if a user is client of the bike shop

    // ClientLists for counting 
    address[] clientList;

    /*
    ================================================================
                            Data structures
    ================================================================
    */ 

    enum BikeState {DEACTIVATED, AVAILABLE, IN_USE}
    enum ClientState {GOOD_TO_GO, IN_RIDE}

    struct Bike {
        address lastRenter;                             // Keep address of the last renter
        bool condition;                                 // Bike's condition : true = good, false = bad
        bool currentlyInUse;                            // Boolean acting as a quick-verifier (is the bike being used currently)
        uint256 usageTime;                              // Unix timestamp (to calculate the duration of a ride)
        BikeState state;                                // One of the 3 states enumerated
    }
    
    struct Client {
        uint256 clientListPointer;                      // The order in which the clients became client of the shop
        ClientState state;                              // One of the 2 states : in ride or good to go
        uint256 received;                               // For the last ride, how much received (normally = deposit)
        uint256 returned;                               // For the last ride, how much was returned
        uint256 numberRides;                            // Count of total number of rides
        uint256 goodRides;                              // Count of total number of good rides (bike was returned in good condition)
    }

    /*
    ================================================================
                            Modifiers
    ================================================================
    */ 

    /// @dev Only a person who is client of the bike shop can access
    modifier bikeClientOnly(address clientAddress) {
        require(isBikeClient[clientAddress] == true);
        _;
    }

    /// @dev Is the bike identifier within the bounds of bike inventory
    modifier validParametersBike(uint256 bikeId) {
        require(bikeId >= 0 && bikeId < MAX_BIKE_COUNT);
        _;
    }

    /// @dev Is bike during a ride
    modifier bikeInRide (uint256 bikeId) {
        require(bikeMapping[bikeId].state == BikeState.IN_USE);
        _;
    }

    /// @dev Does the bike belong to the one who rented it
    modifier bikeUser (uint256 bikeId, address clientAdr) {
        require(bikeMapping[bikeId].lastRenter == clientAdr);
        _;
    }

    /// @dev Is the client during a trip
    modifier clientInRide (address clientAdr) {
        require(clientMapping[clientAdr].state == ClientState.IN_RIDE);
        _;
    }

    /// @dev emergency stop
    modifier emergencyStop() {
        require(!stopSwitch);
        _;
    }

    /*
    ================================================================
                            Events
    ================================================================
    */ 

    /// @dev A bike has been rent, by a renter
    event LogBikeRent(uint256 bikeId, address indexed renter, bool status);
    /// @dev Deposit was received by the contract
    event LogReceivedFunds(address indexed sender, uint256 amount);
    /// @dev Funds were paid back to the user
    event LogReturnedFunds(address indexed recipient, uint256 amount);

    /// @dev Fallback event (value was sent to the contract)
    event Deposit(address indexed sender, uint256 value);

    /// @dev Client creation
    event ClientCreated(address indexed clientAddress);

    /// @dev Bike is initiated / deactivated
    event BikeInitiated(uint256 bikeId);
    event BikeDeactivated(uint256 bikeId);

    /// @dev The Bike / the client is good to go
    event BikeAvailable(uint256 bikeId);
    event ClientGoodToGo(address indexed clientAddress);

    /// @dev Record the start/stop time of the trip
    event TripStarted(address indexed clientAddress, uint256 bikeId, uint256 time);
    event TripFinished(address indexed clientAddress, uint256 bikeId, uint256 time);

    /// @dev the Stop switch is activated / deactivated
    event StopSwitchChanged(bool currentStatus);

    /*
    ================================================================
                            Constructor
    ================================================================
    */ 

    /// @dev Contract constructor sets the bike Admin address, the fee (by minute) and the necessary deposit
    constructor() public Ownable() {
        bikeAdmin = msg.sender;
        requiredDeposit = BIKE_VALUE;
        fee = RENT_FEE;
    }

    /*
    ================================================================
                            Bike housekeeping
    ================================================================
    */ 

    /// @dev Check if the bike is being used for the first time
    /// @param bikeId the ID of a bike
    /// @return isFirstTime True if the bike has never been used, False otherwise
    function isBikeFirstUse(uint256 bikeId) 
        public 
        view 
        returns(bool isFirstTime) 
    {   
        return isBikeActive[bikeId] == false;
    }

    /// @dev Count the number of clients 
    /// @return Number of clients
    function getClientCount()
        public 
        view 
        returns(uint256 clientCount)
    {
        return clientList.length;
    }

    /// @dev Check if some address is related to a client
    /// @param clientAdr the address of a client
    /// @return True if the address is a client address
    function isClient(address clientAdr) 
        public 
        view 
        returns (bool isIndeed)
    {
        return isBikeClient[clientAdr] == true;
    }

    /// @dev Check the fee amount for a certain duration (in minutes) for renting the bike
    /// @param duration length 
    /// @return Fee due 
    function calculateFee(uint256 duration) 
        public 
        view 
        returns (uint256) 
    {
        uint256 num_minutes = duration.div(MINUTE_FACTOR);
         
        if(num_minutes > TIME_LIMIT){
            return requiredDeposit;
        }
        uint256 toPay = num_minutes.mul(fee);
        return toPay;
    }

    /* 
    ================================================================
                        Rent and surrender bikes
    ================================================================
    */

    /// @dev Someone can rent a bike
    /// @param bikeId The client must input the bike id
    /// @return success Did the renting process succeed ? 
    function rentBike(uint256 bikeId) 
        external 
        payable
        validParametersBike(bikeId)
        emergencyStop
        returns (bool success) 
    {

        // Require that the user pays the right amount for the bike
        require(msg.value == requiredDeposit);

        // Check if the bike is activated
        if(isBikeFirstUse(bikeId)) {
            // If it's the first use, create the data struct
            bikeMapping[bikeId] = Bike(
                {
                    lastRenter: address(0),
                    condition: true,
                    currentlyInUse: false,
                    usageTime: 0,
                    state: BikeState.DEACTIVATED
                }
            );

            isBikeActive[bikeId] = true;
            emit BikeInitiated(bikeId);

            bikeMapping[bikeId].state = BikeState.AVAILABLE;
            emit BikeAvailable(bikeId);

        } else {
            // The bike must be unused, in good condition, activated, and not in ride already
            require(bikeMapping[bikeId].currentlyInUse == false);
            require(bikeMapping[bikeId].condition == true);
            require(bikeMapping[bikeId].state == BikeState.AVAILABLE);
        }

        // Check if the address is a client, if not create a struct 
        if(!isClient(msg.sender)){

            clientMapping[msg.sender] = Client(
                {
                    clientListPointer: clientList.push(msg.sender) - 1,
                    state: ClientState.GOOD_TO_GO,
                    received: 0,
                    returned: 0,
                    numberRides: 0,
                    goodRides: 0
                }
            );

            // The client profile is created    
            isBikeClient[msg.sender] = true;
            emit ClientCreated(msg.sender);

        } else {
            // The client must not be already using a bike
            require(clientMapping[msg.sender].state == ClientState.GOOD_TO_GO);
            // Reset the count for how much the user received and returned (as a trip is starting)
            clientMapping[msg.sender].received = 0;
            clientMapping[msg.sender].returned = 0;
        }

        // Account for the transfer being made
        clientMapping[msg.sender].received += requiredDeposit;
        emit LogReceivedFunds(msg.sender, msg.value);

        // Change bike situation and state
        bikeMapping[bikeId].lastRenter = msg.sender;
        bikeMapping[bikeId].currentlyInUse = true;
        bikeMapping[bikeId].usageTime = now;
        bikeMapping[bikeId].state = BikeState.IN_USE;        

        // Change client state and number of rides
        clientMapping[msg.sender].state = ClientState.IN_RIDE;
        clientMapping[msg.sender].numberRides += 1;

        emit TripStarted(msg.sender, bikeId, bikeMapping[bikeId].usageTime);

        return bikeMapping[bikeId].currentlyInUse;

    }
    
    /// @dev Someone can stop bike usage
    /// @param bikeId The client must input the bike id 
    /// @return Did it succeed ? 
    function surrenderBike(uint256 bikeId, bool newCondition) 
        external 
        bikeClientOnly(msg.sender)
        validParametersBike(bikeId)
        bikeInRide(bikeId)
        clientInRide(msg.sender)
        bikeUser(bikeId, msg.sender)
        emergencyStop
        returns (bool success)
    {
        emit TripFinished(msg.sender, bikeId, now);
        uint256 feeCharged = calculateFee(now.sub(bikeMapping[bikeId].usageTime));
        uint256 owedToClient = clientMapping[msg.sender].received.sub(feeCharged);

        if (newCondition == false) {
            owedToClient = 0;
            bikeMapping[bikeId].state = BikeState.DEACTIVATED;
            emit BikeDeactivated(bikeId);
            clientMapping[msg.sender].state = ClientState.GOOD_TO_GO;
            emit ClientGoodToGo(msg.sender);
        } else {
            clientMapping[msg.sender].goodRides += 1;
            clientMapping[msg.sender].returned += owedToClient;
            clientMapping[msg.sender].state = ClientState.GOOD_TO_GO;
            emit ClientGoodToGo(msg.sender);
            msg.sender.transfer(owedToClient);
            emit LogReturnedFunds(msg.sender, clientMapping[msg.sender].returned);                
            bikeMapping[bikeId].state = BikeState.AVAILABLE;
            emit BikeAvailable(bikeId);
        }
        // Make the client good to go and the bike not in use
        bikeMapping[bikeId].currentlyInUse = false;
        
        return true;
    }


    /* 
    ================================================================
                            Getter functions
    ================================================================
    */

    /// @dev Get the total rides of a client
    /// @param clientAdr The client's address
    /// @return totalRidesCount The client's ride count
    function getTotalRides(address clientAdr)
        external
        view
        returns (uint256 totalRidesCount)
    {
        Client memory client = clientMapping[clientAdr];
        return client.numberRides;
    }

    /// @dev Get the rides after which the bike was in good condition
    /// @param clientAdr The client's address
    /// @return goodRidesCount The client's good rides count
    function getGoodRides(address clientAdr)
        external
        view
        returns (uint256 goodRidesCount)
    {
        Client memory client = clientMapping[clientAdr];
        return client.goodRides;
    }

    /// @dev Get the total value returned to the client 
    /// @param clientAdr The client's address
    /// @return returnedAmount The client's total returned amount
    function getReturned(address clientAdr)
        external 
        view
        returns (uint256 returnedAmount)
    {
        Client memory client = clientMapping[clientAdr];
        return client.returned;
    }

    /// @dev Get the bike's value
    /// @return bikeValue The deposit's bike value
    function getBikeValue()
        external
        view
        returns (uint256 bikeValue)
    {
        return requiredDeposit;
    }

    /// @dev Get the bike's usage status
    /// @param bikeId The bike's identifier
    /// @return inUse Boolean to tell if the bike is being used or not
   function checkBikeStatus (uint256 bikeId)
        external
        view
        returns (bool inUse)
    {
        Bike memory bike = bikeMapping[bikeId];
        return bike.currentlyInUse;
    }

    /// @dev Function to check on a bike's data
    /// @param bikeId The bike's identifier
    /// @return lastRenter The last user to have used the bike
    /// @return condition The condition of the bike
    /// @return currentlyInUse The usage status of the bike
    /// @return usageTime The timestamp of last usage start
    /// @return state The bike's state 
    function checkBike (uint256 bikeId)
        external
        view
        returns (address lastRenter, bool condition, bool currentlyInUse, uint256 usageTime, BikeState state)
    {
        Bike memory bike = bikeMapping[bikeId];
        return (bike.lastRenter, bike.condition, bike.currentlyInUse, bike.usageTime, bike.state);
    }

    /// @dev Function to check on a client's data
    /// @param clientAdr The client's address
    /// @return state The client's state (in ride or else)
    /// @return received The amount the client deposited during his last trip
    /// @return returned The amount the client received back after his last trip
    /// @return numberRides Trips count 
    /// @return goodRides Good trips count
    function checkUser (address clientAdr)
        external
        view
        returns (ClientState state, uint256 received, uint256 returned, uint256 numberRides, uint256 goodRides)
    {
        Client memory client = clientMapping[clientAdr];
        return (client.state, client.received, client.returned, client.numberRides, client.goodRides);
    }

    /* 
    ================================================================
                            Fallback function
    ================================================================
    */

    /// @dev Fallback function - only the owner can deposit value on it.
    function ()
        external
        onlyOwner
        payable
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