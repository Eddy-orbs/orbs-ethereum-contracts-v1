pragma solidity 0.5.3;


interface IOrbsValidatorsRegistry {
    event ValidatorLeft(address indexed validator);
    event ValidatorRegistered(address indexed validator);

    function register(
        string calldata name,
        bytes calldata ipvAddress,
        string calldata website,
        address orbsAddress
    )
    external;
    function leave() external;
    function getValidatorData(address validator)
    external
    view
    returns (
        string memory name,
        bytes memory ipvAddress,
        string memory website,
        address orbsAddress
    );

    function isValidator(address validator) external view returns (bool);
    function getOrbsAddress(address validator)
    external
    view
    returns (address orbsAddress);
}