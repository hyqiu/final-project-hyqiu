var BikeSharing = artifacts.require("BikeSharing");
var Insurance = artifacts.require("Insurance");
var BehaviourToken = artifacts.require("BehaviourToken");

module.exports = function(deployer, network, accounts) {
	deployer.deploy(BikeSharing).then(function() {
		return deployer.deploy(Insurance, BikeSharing.address, "BehaviourToken", "BHT");
	});

	deployer.deploy(BehaviourToken, "BehaviourToken", "BHT");

}