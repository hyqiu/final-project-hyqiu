
Below are the design patterns that I have adopted to carry out this project.

# Circuit Breaker

As an assignment requirement, I implemented an emergency switch for both the "Insurance" and the "BikeSharing" contracts. It consists in a boolean storage variable, which then conditions the accessibility of the most crucial functions of both contracts. This accessibility matter is handled by a common modifier, than may block the entry into the important functions in both contracts. The unit test carried out on the Insurance contract emergency switch showed that the contract owner is indeed the only account that may access the emergency switch.  

# Fail early, fail loud


# Access restriction

Thanks to modifiers, I have allowed the functions in `BikeSharing.sol` and `Insurance.sol` to have limited access, conditioned to the requesting user's identity. Hence, for the `surrenderBike` function in the Bike Shop context, no only do the modifiers not allow non-clients to return a hypothetical bike, but the user must also fulfill a few conditions such as having the "in Ride" status, that the corresponding bike is also marked as "in Ride" and that the user is indeed the last user that has rented the vehicle. 


# Mapping iterators

For both "Insurance" and "BikeSharing" contracts, I needed to collect data about the clients in both situations, therefore I used `structs` to carry the bulk of the data  

# 







