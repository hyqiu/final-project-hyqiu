const BikeSharing = artifacts.require('../contracts/BikeSharing.sol');

function increaseTime(duration) {
	const id = Date.now();

	return new Promise((resolve, reject) => {
		web3.currentProvider.sendAsync({
			jsonrpc: '2.0',
			method: 'evm_increaseTime',
			params: [duration],
			id: id,
		}, err1 => {
			if (err1) return reject(err1)

			web3.currentProvider.sendAsync({
				jsonrpc: '2.0',
				method: 'evm_mine',
				id: id + 1,
			}, (err2, res) => {
				return err2 ? reject(err2) : resolve(res)
			})
		})
	})
}

function assertJump(error) {
	assert.isAbove(error.message.search('invalid opcode'), -1, 'Invalid opcode error must be returned');
}

contract('BikeSharing', function(accounts) {

	let bikeInUse;
	let bikeShop;
	let totalGoodRides;
	let totalRides;
	let clientCount; 
	let balance;
	let returnedToUser;

	const idBike0 = 0;
	const idBike1 = 1;

	const bikeAdmin = accounts[0];
	const careful_renter = accounts[1];
	const carefree_renter = accounts[2];

	const deposit = web3.utils.toWei('1', 'ether');

	beforeEach(async() => {
		bikeShop = await BikeSharing.deployed();
        assert.equal(await bikeShop.owner.call({from: accounts[1]}), accounts[0]);
	})

	it("should mark bike users as enrolled but not the admin", async () => {

		await bikeShop.rentBike(idBike0, {from: careful_renter, value: deposit});
		const userEnrolled = await bikeShop.isClient(careful_renter, {from: careful_renter});
		assert.isTrue(userEnrolled, 'The user has not been correctly enrolled');

		try {
			await bikeShop.rentBike(idBike1, {from: bikeAdmin, value: deposit});
			assert.fail('should have reverted before');
		} catch(error) {
			assertJump(error);
		}
		
	});

	it("should correctly count the number of rides (good or bad) with the appropriate status", async () => {

		await bikeShop.rentBike(idBike0, {from: careful_renter, value: deposit});
		bikeInUse = await bikeShop.checkBikeStatus(bike_id, {from: bikeAdmin});
		assert.isTrue(bikeInUse, 'The bike was not properly rented');

		await bikeShop.rentBike(idBike1, {from: carefree_renter, value: deposit});
		bikeInUse = await bikeShop.checkBikeStatus(bike_id, {from: bikeAdmin});
		assert.isTrue(bikeInUse, 'The bike was not properly rented');

		// There should be 2 clients
		clientCount = await bikeShop.getClientCount({from: bikeAdmin});
		assert.isEqual(clientCount, 2, 'Wrong count of clients');

		// Test if it was counted properly for the careful user
		await bikeShop.surrenderBike(idBike0, true, {from: careful_renter});
		totalRides = await bikeShop.getTotalRides(careful_renter, {from: bikeAdmin});
		totalGoodRides = await bikeShop.getGoodRides(careful_renter, {from: bikeAdmin});
		bike_newStatus = await bikeShop.getBikeStatus(idBike1, {from: bikeAdmin});

		assert.equal(totalRides, 1, "Not good count for total rides for the careful rider");
		assert.equal(totalGoodRides, 1, "Not good count for good rides for the careful rider");
		assert.equal(bike_newStatus, 1, "Wrong status for good shape bike");

		// Test if it was counted properly for the carefree user
		await bikeShop.surrenderBike(idBike1, false, {from: carefree_renter});
		totalRides = await bikeShop.getTotalRides(carefree_renter, {from: bikeAdmin});
		totalGoodRides = await bikeShop.getGoodRides(carefree_renter, {from: bikeAdmin});
		bike_newStatus = await bikeShop.getBikeStatus(idBike1, {from: bikeAdmin});
		
		assert.equal(totalRides, 1, "Not good count for total rides for the carefree rider");
		assert.equal(totalGoodRides, 0, "Not good count for good rides for the carefree rider");
		assert.equal(bike_newStatus, 0, "Wrong status for bad shape bike");

	});

	// Test the amount that is given and taken 
	it("should return the right amount received by bike shop", async() => {
		
		await bikeShop.rentBike(idBike0, {from: careful_renter, value: deposit});
		await bikeShop.rentBike(idBike1, {from: carefree_renter, value: deposit});

		// There should be 2 clients
		clientCount = await bikeShop.getClientCount({from: bikeAdmin});
		assert.isEqual(clientCount, 2, 'Wrong count of clients');

		// Test if the contract bears 2 ethers
		const totalReceived = web3.eth.getBalance(bikeShop.address);
		assert.equal(totalReceived.toString(10), (2 * deposit).toString(10), "Did not receive the proper amount");

		// Handle time in tests ? 
		const time_elapsed = 60 * 30;
		await increaseTime(time_elapsed);
		const feeDue = await bikeShop.calculateFee(time_elapsed);
		await bikeShop.surrenderBike(idBike0, true, {from: careful_renter});

		const maximumReturned = deposit - feeDue;
		returnedToUser = bikeShop.getReturned(careful_renter);
		assert.isAtMost(returnedToUser, feeDue, 'The Fee Due above the theoretical limit');

		await bikeShop.surrenderBike(idBike1, false, {from: carefree_renter});
		returnedToUser = bikeShop.getReturned(carefree_renter);
		assert.isEqual(returnedToUser, 0, 'The carefree user was paid back');

	});

	it("should be impossible for a biker in ride to rent another bike while riding", async() => {

		await bikeShop.rentBike(idBike0, {from: careful_renter, value: deposit});

		try {
			await bikeShop.rentBike(idBike1, {from: careful_renter, value: deposit});
		} catch (error) {
			return true;
		}
		throw new Error ("This should not be seen !");

	});

	it("should be impossible to rent a bike that is currently in use", async() => {
		
		await bikeShop.rentBike(idBike0, {from: careful_renter, value: deposit});

		try {
			await bikeShop.rentBike(idBike0, {from: carefree_renter, value: deposit});
		} catch (error) {
			return true;
		}
		throw new Error ("This should not be seen !");
		
	});

	// A banned client cannot rent a bike any more. 

	
})