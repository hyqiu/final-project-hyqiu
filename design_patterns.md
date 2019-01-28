
Below are the design patterns that I have adopted to carry out this project.

# Circuit Breaker

As an assignment requirement, I implemented an emergency switch for both the "Insurance" and the "BikeSharing" contracts. It consists in a boolean storage variable, which then conditions the accessibility of the most crucial functions of both contracts. This accessibility matter is handled by a common modifier, than may block the entry into the important functions in both contracts. The unit test carried out on the Insurance contract emergency switch showed that the contract owner is indeed the only account that may access the emergency switch.  

# Factory

`Insurance.sol` deploys a child, that is the token contract (`BehaviourToken.sol`), which serves as the reward scheme put forth by the insurance company to benefit the good-behaved and careful bikers. Such rewards inherit from the classic ERC20 contract, so they are mintable, which thus poses no complications in terms of supply and no risk of shortage. Whenever the insurance client wants to redeem some tokens against alleviating its claim history, the transferred tokens are simply burnt. However, the factory pattern could have been extended, as one could have imagined the possibility to transfer tokens from one client to another, to help the people who have too high a claims count. 

# Mapping iterator

The contracts did not need any for-loops as each client request proceeds from an external call from the clients themselves, and their data can be retrieved thanks to the mappings constituting the contract storage. However, I implemented arrays in each contract (`insuredList` and `clientList`), as this would facilitate the counting process (figuring out how many clients we had), since such counting is impossible with mappings.


# Access restriction

Thanks to modifiers, I have allowed the functions in `BikeSharing.sol` and `Insurance.sol` to have limited access, conditioned to the requesting user's identity. Hence, for the `surrenderBike` function in the Bike Shop context, no only do the modifiers not allow non-clients to return a hypothetical bike, but the user must also fulfill a few conditions such as having the "in Ride" status, that the corresponding bike is also marked as "in Ride" and that the user is indeed the last user that has rented the vehicle. 








