const BikeSharing = artifacts.require('../contracts/BikeSharing.sol');

function increaseTime(duration) {
  const id = Date.now()

  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) return reject(err1)

      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id+1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res)
      })
    })
  })
}

contract('BikeSharing', function(accounts) {

	let bikeInUse;
	let bikeShop;
	let totalGoodRides;
	let totalRides;
	let clientCount; 
	let balance;
	let returnedToUser;
	let bikeStatus;

	let idBike;
	let idBike0;
	let idBike1;

	const bikeAdmin = accounts[0];
	const test_renter = accounts[1];
	const careful_renter = accounts[2];
	const carefree_renter = accounts[3];

	const deposit = web3.utils.toWei('1', 'ether');

	beforeEach('setup contract for each test', async() => {
		bikeShop = await BikeSharing.deployed();
	})

	// 1. Mark user as enrolled
	// 2. Make sure user is the last user of bike
	// 3. Make user have correct count of bike uses and good rides
	// 4. Make sure the user is returned the correct amount
	// 5. Make sure the states are consistent
	// 6. A banned user should not be a client anymore

	it("should mark bike users as enrolled", async () => {
		idBike = 0;
		await bikeShop.rentBike(idBike, {from: test_renter, value: deposit});
		const userEnrolled = await bikeShop.isClient(test_renter, {from: test_renter});
		assert.isTrue(userEnrolled, 'The user has not been correctly enrolled');
		await bikeShop.surrenderBike(idBike, true, {from: test_renter});		
	});

	it("should memorize last bike usage", async () => {

		idBike = 0;

		bikeStatus = await bikeShop.checkBike(idBike, {from: test_renter});
		assert.equal(bikeStatus[0], test_renter, 'Last rider identity not well recorded');
		assert.isTrue(bikeStatus[1], 'Last ride ended in good condition');
		assert.isFalse(bikeStatus[2], 'Bike is not currently being used');
		assert.equal(bikeStatus[4], 1, 'Bike status is supposed to be available');

	});

	it("should handle two simultaneous users", async () => {
		idBike0 = idBike + 1;
		idBike1 = idBike + 2;

		await bikeShop.rentBike(idBike0, {from: careful_renter, value: deposit});
		bikeInUse = await bikeShop.checkBikeStatus(idBike0, {from: careful_renter});
		assert.isTrue(bikeInUse, 'Bike 1 was not properly rented');

		await bikeShop.rentBike(idBike1, {from: carefree_renter, value: deposit});
		bikeInUse = await bikeShop.checkBikeStatus(idBike1, {from: carefree_renter});
		assert.isTrue(bikeInUse, 'Bike 2 was not properly rented');

		// There should be 3 registered clients so far
		clientCount = await bikeShop.getClientCount({from: bikeAdmin});
		assert.equal(clientCount, 3, 'Wrong count of clients');

		// The contract should have received 2 ethers in total
		const totalReceived = await web3.eth.getBalance(bikeShop.address);
		assert.equal(totalReceived.toString(10), (2 * deposit).toString(10), "Did not receive the proper amount");
	
	});

	it("should correctly count rides and fees for the careful user", async () => {
		
		// Elapsed time 		
		const time_elapsed = 60 * 30;
		await increaseTime(time_elapsed);
		const feeDue = await bikeShop.calculateFee(time_elapsed);
		
		// Surrender bike
		await bikeShop.surrenderBike(idBike0, true, {from: careful_renter});

		// Check ride counts
		totalRides = await bikeShop.getTotalRides(careful_renter, {from: careful_renter});
		assert.equal(totalRides, 1, "Wrong count for total rides for the careful rider");
		totalGoodRides = await bikeShop.getGoodRides(careful_renter, {from: careful_renter});
		assert.equal(totalGoodRides, 1, "Wrong count for good rides for the careful rider");
		bike_newStatus = await bikeShop.checkBikeStatus(idBike1, {from: careful_renter});
		assert.equal(bike_newStatus, 1, "Wrong status for good shape bike");

		// Make sure the fees are consistent
		const maximumReturned = deposit - feeDue;
		returnedToUser = await bikeShop.getReturned(careful_renter);
		assert.isAtMost(parseInt(returnedToUser), parseInt(maximumReturned), 'The due fee is above the theoretical limit');

	});

	it("should correctly count rides and fees for the carefree user", async () => {

		// Surrender bike
		await bikeShop.surrenderBike(idBike1, false, {from: carefree_renter});
		
		// Check ride counts
		totalRides = await bikeShop.getTotalRides(carefree_renter, {from: carefree_renter});
		assert.equal(totalRides, 1, "Not good count for total rides for the carefree rider");
		totalGoodRides = await bikeShop.getGoodRides(carefree_renter, {from: carefree_renter});
		assert.equal(totalGoodRides, 0, "Not good count for good rides for the carefree rider");
		bike_newStatus = await bikeShop.checkBikeStatus(idBike1, {from: carefree_renter});
		assert.equal(bike_newStatus, 0, "Wrong status for bad shape bike");

		// Make sure the carefree renter isn't paid back anything
		returnedToUser = await bikeShop.getReturned(carefree_renter);
		assert.equal(returnedToUser, 0, 'The carefree user was paid back');


	});

	// A banned client cannot rent a bike any more. 

	
})