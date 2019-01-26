const BikeSharing = artifacts.require('../contracts/BikeSharing.sol');
const Insurance = artifacts.require('../contracts/Insurance.sol');

contract('Insurance', function(accounts) {

	let bikeShop;
	let insuranceCompany;
	const premium = web3.utils.toWei('10', 'finney');

	beforeEach("should deploy both contracts", async() => {
		bikeShop = await BikeSharing.deployed();
		insuranceCompany = await Insurance.deployed();
	})

	it("should return proper insurance rate", async() => {
		const premiumRate = await insuranceCompany.getPremiumRate();
		assert.equal(premiumRate, premium, 'Not equal');
	})
})