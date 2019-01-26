var BikeSharing = artifacts.require("BikeSharing");
var Insurance = artifacts.require("Insurance");

module.exports = function(deployer, network, accounts) {
	deployer.deploy(BikeSharing).then(function() {
		return deployer.deploy(Insurance, BikeSharing.address, "BehaviourToken", "BHT");
	});
}