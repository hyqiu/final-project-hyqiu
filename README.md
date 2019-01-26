# Consensys Academy Final Project

This Dapp provides a use-case for an on-demand insurance contract, applied to a bike rental company. 

The process works as follows :

- A customer rents a bike in a total of 1000 bikes, rides it for a certain amount of time and returns it. 
- At rental time, the customer pays a deposit corresponding to the bike's face value. When they return the bike, they are charged according to the time (in minutes) spent riding the bike.
- When returned, a bike can be in good or bad condition. 
	* If the bike is in good condition, the deposit is returned to the user, minus the fee corresponding to the time spent riding the bike. 
	* If the bike is in bad condition, the deposit is not returned to the user.
	* If the bike has been ridden for more than 24 hours, the deposit is not returned to the user.

- Users can choose to underwrite insurance, so that their deposit can be reimbursed in part if they damange the bike. 
- At underwriting time (i.e. user chooses to buy insurance), the user must pay the first premium upfront.
- The premium works as "pay-as-you-ride" : the user only pays as much premium as the number of rides that he or she has made. 
- Provided the user bought insurance, at the end of a ride : 
	* If the bike is returned in good condition, an ERC20 token is minted for the user, as reward for "good riding behaviour".
	* If the bike is returned in bad condition, the deposit is paid back to the user, minus a retention.
- The premium amount is conditioned on the number of claims (i.e. times they returned a bike in bad condition), so that "The more claims a user made in the past, the more he/she is going to pay".
	* Yet, a user can redeem tokens they earned as "good riders" to decrease their claims history.

=====================================================================================================================

Workflow : 
- Buy insurance.
	- The client buys insurance (pays a premium upfront)
	- Then, will pay small premium every time they rent a bike
- Rent bike. 
	- The client rents a bike
	- The admin checks on public insurance record if the guy is insured. 
		- The premium is paid according to past accident count if insured
	- The deposit will be the same for everyone.
- At end of ride, the renter : 
	- Can file a claim if the scooter is not in good shape any more. 
	- Communicates with insurer to have the guy gain extra points.
	- If there is an accident : 
		* The bike sharing contract can modify the count of accident. 
		* The insurance contract will automate payment of one bike

======================================================== Ideas ======================================================== 
- Ban client (last resort, after fake declaration) --> TO IMPLEMENT
- A Proof-of-Existence contract where you must prove the bike still looks good. 
- Send to repair shop the broken ones if it falls below a certain threshold ? 
- Add IPFS geolocation ? 

======================================================== Things to clean ======================================================== 
- The Bike Struct (with enum, no need for currentlyInUse !)

===========

Possible tests : 
- How much does the insured pay ? 
- 5 tokens = -1 accidentCount




================================================================================================================================================


TO DO : 
1) CHANGE CONDITION OF THE BIKE
2) Possibility to revoke a customer
3) Cancel subscription, BUT before that pay back ALL the fees that are due to you
4) Add getter function for Behaviour Token





