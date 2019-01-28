const BehaviourToken = artifacts.require('../contracts/BehaviourToken.sol');
const truffleAssert = require('truffle-assertions');

contract('BehaviourToken', function(accounts) {

	let tokenInstance;
	let owner = accounts[0];
	let user = accounts[1];

	beforeEach('setup contract for each test', async() => {
		tokenInstance = await BehaviourToken.deployed();
	});

	it("should allow the owner to mint new tokens for user", async () => {
		const value = 3;
		let result = await tokenInstance.mint(user, value, {from: owner});

		truffleAssert.eventEmitted(result, 'Transfer', (ev) => {
			return ev.from === '0x0000000000000000000000000000000000000000' && ev.to === user && ev.value == 3;
		}, 'The event should showcase a transfer from a null address to user');

	});


	it("should allow the owner to burn the user's tokens", async () => {
		const value = 1;
		let result = await tokenInstance.burn(user, value, {from: owner});

		truffleAssert.eventEmitted(result, 'Transfer', (ev) => {
			return ev.from === user && ev.to === '0x0000000000000000000000000000000000000000' && ev.value == 1;
		}, 'The event should showcase a transfer from the user address to a null address');

	});

	it("should return an error if we want to burn more than possible", async () => {
		const value = 3;
		try {
			let result = await tokenInstance.burn(user, value, {from: owner});	
		} catch(e) {
			return true;
		}
		throw new Error("This should not appear");
		
	})


})