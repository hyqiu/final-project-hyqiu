var BikeSharing = artifacts.require("BikeSharing");

module.exports = function(deployer, network, accounts) {
	deployer.deploy(BikeSharing);
}