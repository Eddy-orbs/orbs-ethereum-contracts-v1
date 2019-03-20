pragma solidity 0.5.3;


import "./IOrbsValidatorsRegistry.sol";


contract OrbsValidatorsRegistry is IOrbsValidatorsRegistry {

    struct ValidatorData {
        string name;
        bytes4 ipAddress;
        string website;
        bytes20 orbsAddress;
        uint registeredOnBlock;
        uint lastUpdatedOnBlock;
        bytes declarationHash;
    }

    uint public constant VERSION = 1;

    mapping(address => ValidatorData) internal validatorsData;

    mapping(bytes4 => address) public lookupByIp;
    mapping(bytes20 => address) public lookupByOrbsAddr;

    function register(
        string memory name,
        bytes4 ipAddress,
        string memory website,
        bytes20 orbsAddress,
        bytes memory declarationHash
    )
        public
    {
        require(bytes(name).length > 0, "Please provide a valid name");
        require(bytes(website).length > 0, "Please provide a valid website");
        require(ipAddress != bytes4(0), "Please pass a valid ip address represented as an array of exactly 4 bytes");
        require(orbsAddress != bytes20(0), "Please provide a valid Orbs Address");

        require(
            lookupByIp[ipAddress] == address(0) ||
            lookupByIp[ipAddress] == msg.sender,
                "IP Address is already in use by another validator"
        );
        require(
            lookupByOrbsAddr[orbsAddress] == address(0) ||
            lookupByOrbsAddr[orbsAddress] == msg.sender,
                "Orbs Address is already in use by another validator"
        );

        lookupByIp[ipAddress] = msg.sender;
        lookupByOrbsAddr[orbsAddress] = msg.sender;

        uint registeredOnBlock = validatorsData[msg.sender].registeredOnBlock;
        if (registeredOnBlock == 0) {
            registeredOnBlock = block.number;
        }

        validatorsData[msg.sender] = ValidatorData(
            name,
            ipAddress,
            website,
            orbsAddress,
            registeredOnBlock,
            block.number,
            declarationHash
        );
        emit ValidatorRegistered(msg.sender);
    }

    function leave() public {
        require(isValidator(msg.sender), "Sender is not a listed Validator");

        ValidatorData storage data = validatorsData[msg.sender];

        delete lookupByIp[data.ipAddress];
        delete lookupByOrbsAddr[data.orbsAddress];

        delete validatorsData[msg.sender];

        emit ValidatorLeft(msg.sender);
    }

    function getValidatorData(address validator)
        public
        view
        returns (
            string memory name,
            bytes4 ipAddress,
            string memory website,
            bytes20 orbsAddress,
            bytes memory declarationHash
        )
    {
        require(isValidator(validator), "Unlisted Validator");

        ValidatorData storage entry = validatorsData[validator];
        return (
            entry.name,
            entry.ipAddress,
            entry.website,
            entry.orbsAddress,
            entry.declarationHash
        );
    }

    function reviewRegistration()
        public
        view
        returns (
            string memory name,
            bytes4 ipAddress,
            string memory website,
            bytes20 orbsAddress,
            bytes memory declarationHash
        )
    {
        return getValidatorData(msg.sender);
    }

    function getRegistrationBlockNumber(address validator)
        external
        view
        returns (uint registeredOn, uint lastUpdatedOn)
    {
        require(isValidator(validator), "Unlisted Validator");

        ValidatorData storage entry = validatorsData[validator];
        return (
            entry.registeredOnBlock,
            entry.lastUpdatedOnBlock
        );
    }

    function getOrbsAddress(address validator)
        public
        view
        returns (bytes20)
    {
        require(isValidator(validator), "Unlisted Validator");

        return validatorsData[validator].orbsAddress;
    }

    function isValidator(address addr) public view returns (bool) {
        return bytes(validatorsData[addr].name).length > 0;
    }
}