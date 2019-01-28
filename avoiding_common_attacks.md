
Below are the four risks I have identified that may have applied to my project. 

# Re-entrancy
This is a common issue that could have happened to both `Insurance.sol` and `BikeSharing.sol`, as in both cases there are values transfers involved. 
- For `Bikesharing.sol`, the risks occurs when the user returns the bike, and the function calculates the amount that is going to be repaid, before transferring the funds. A malicious contract can in fact make repeated calls on the function so that the transfer function can be called repeatedly. However, this risk is mitigated by the fact that the function modifiers would not allow multiple calls to the function, as the user's status would change from "In-Ride" to "Good-to-Go", therefore he/she must rent a bike again before being able to call this function. Furthermore, the logic and the state updates are performed before the `transfer` function is called. 
- For `Insurance.sol`, the issue is similar as it occurs during the phase when the insurer makes paybacks to the clients who did not get their deposit back from the bike shop. To prevent repeated calls, the pending claims are updated in the `insuranceMapping` first before calling the value transfer function.

# Arithmetic over/under flows
Both contracts are "accounting-intensive" as they manipulate data regarding trip counts, deposits, premiums and time... that can be confusing when mixed together. To avoid any misuse, I defined all my numerical variables as `uint256` as it can achieve a maximum value of 2^256 - 1, which is way above the UNIX timestamps necessitated by the time variables, as well as the ether values expressed in wei. I also used exclusively the `SafeMath.sol`library from open-zeppelin, which featured the necessary security in carrying out the basic operations. 

# External contract referencing
The `Insurance.sol` contract explicit references to the `Bikesharing.sol` contract, as it needs it to call a few getter functions to update the insurance data according to the bike rental / trips data. Furthermore, the `BehaviourToken.sol` is also referred to in order to carry out the reward program for the insurance clients. Yet, the risk here is largely alleviated by the fact that : 
- `Bikesharing.sol` is refererred to explicitly by its address, thus it is impossible that another malicious contract bearing the same name has the insurance contract wrongly hooked.
- `BehaviourToken.sol` is directly created by the insurance contract; besides the instance is not public in any way, so there cannot be any external call to the Token contract. 

# Time-dependent logic
`Bikesharing.sol` is indeed exposed to this vulnerability, as it uses time to calculate the fee that is due by the renter, according to the number of minutes he or she spent on the bike - hence, there is a risk of timestamp manipulation, which would induce the users to pay a lesser fee than the actual time they spent on the rented bike. A good solution would have been to specify block numbers instead, as miners cannot manipulate the latter easily. However, a malicious user would not have much to profit from such a scheme - he/she would simply get back the ether he/she previously gave as deposit to rent the bike. Besides, there would have been a few "communication" issues with the users as they would not know who much time corresponds to a block, so they cannot assess how much they will pay for a certain amount of time spent. 

