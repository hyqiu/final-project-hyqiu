const BikeSharing = artifacts.require('../contracts/BikeSharing.sol');
const Insurance = artifacts.require('../contracts/Insurance.sol');

contract('Insurance', function(accounts) {

	let bikeShop;
	let insuranceCompany;
	const premium = web3.utils.toWei('10', 'finney');
	let result;

	let pendingPremia;
	const myUser = accounts[4];
	const myBikeId = 10;
	const deposit = web3.utils.toWei('1', 'ether');
	const retention = web3.utils.toWei('100', 'finney');
	const claim_token_ratio = 5;

	beforeEach("should deploy both contracts", async() => {
		bikeShop = await BikeSharing.deployed();
		insuranceCompany = await Insurance.deployed();
	})


	it("should return proper insurance rate", async() => {
		const premiumRate = await insuranceCompany.getPremiumRate();
		assert.equal(premiumRate, premium, 'Not equal');
	});

	it("should allow the user to underwrite an insurance contract", async() => {
		await insuranceCompany.underwriteInsurance({from: myUser, value: premium});
		const insuredConfirmation = await insuranceCompany.isInsured(myUser);
		assert.isTrue(insuredConfirmation, 'Should be insured after underwriting');
		const insuranceClientsCount = await insuranceCompany.insuredClientsCount();
		assert.equal(insuranceClientsCount, 1, 'Exactly one client should be registered');
	});

	it("should allow user to rent a bike, return it, and pay the premium due to bike usage", async () => {

		// Rent bike for the 1st time, returned in good condition
		await bikeShop.rentBike(myBikeId, {from: myUser, value: deposit});
		await bikeShop.surrenderBike(myBikeId, true, {from: myUser});

		// The payments must be regularized
		pendingPremia = await insuranceCompany.getPendingPremia(myUser, {from: myUser});
		await insuranceCompany.regularizePayments({from: myUser, value: pendingPremia});

		result = await insuranceCompany.viewInsuranceStatus(myUser);
		assert.equal(result[1].toString(10), (2 * premium).toString(10), 'Not equal');
		assert.equal(result[2], 1, 'Problem with number of rides');
		assert.equal(result[3], 0, 'Problem with number of claims made');
		assert.equal(result[5], 1, 'Problem with tokens count');
		assert.equal(result[6], 1, 'Problem with tokens owned');
		assert.equal(result[7], 0, 'Problem with number of paybacks');

	});

	it("should allow user to have insurance repayment when returning bike in bad condition", async () => {

		const userBalanceBeforeRide = await web3.eth.getBalance(myUser);

		await bikeShop.rentBike(myBikeId, {from: myUser, value: deposit});
		await bikeShop.surrenderBike(myBikeId, false, {from: myUser});

		const userBalanceBeforePayback = await web3.eth.getBalance(myUser);		
		assert.isAtMost(parseInt(userBalanceBeforePayback), 
			parseInt(userBalanceBeforeRide - deposit), 'Too big balance before payback');

		pendingPremia = await insuranceCompany.getPendingPremia(myUser, {from: myUser});
		await insuranceCompany.regularizePayments({from: myUser, value: pendingPremia});
		const userBalanceAfter = await web3.eth.getBalance(myUser);
		assert.isAtMost(parseInt(userBalanceAfter), 
			parseInt(userBalanceBeforePayback) - parseInt(pendingPremia) + parseInt(deposit) - parseInt(retention), 
			'Difference between two balances must be above the payback');

		result = await insuranceCompany.viewInsuranceStatus(myUser);
		assert.equal(result[3], 1, 'Problem with the claims count');

	});

	it("should allow user to redeem tokens against claim counts", async () => {

		result = await insuranceCompany.viewInsuranceStatus(myUser);
		const myBikeId2 = myBikeId + 1;
		const ridesLeft = claim_token_ratio - (result[2] - result[3]);

		for (var ride = 0; ride < ridesLeft; ride++){
			await bikeShop.rentBike(myBikeId2, {from: myUser, value: deposit});
			await bikeShop.surrenderBike(myBikeId2, true, {from: myUser});
		}

		pendingPremia = await insuranceCompany.getPendingPremia(myUser, {from: myUser});
		await insuranceCompany.regularizePayments({from: myUser, value: pendingPremia});
		
		result = await insuranceCompany.viewInsuranceStatus(myUser);
		assert.equal(result[6], claim_token_ratio, 'Not enough tokens');

		await insuranceCompany.tokenClaimReducer(result[6], {from: myUser});
		result = await insuranceCompany.viewInsuranceStatus(myUser);
		assert.equal(result[6], 0, 'Tokens owned should be set to 0');
		assert.equal(result[4], 0, 'Net claims should have decreased');

	});

	// TODO : write tests featuring events for minting and burning tokens


})