pragma solidity 0.5.16;

interface IProtocol {

    event ProtocolVersionChanged(string deploymentSubset, uint protocolVersion, uint asOfBlock);

    /*
     *   External methods
     */

    /// @dev returns true if the given deployment subset exists (i.e - is registered with a protocol version)
    function deploymentSubsetExists(string calldata deploymentSubset) external returns (bool);

    /*
     *   Governor methods
     */

    /// @dev schedules a protocol version upgrade for the given deployment subset.
    function setProtocolVersion(string calldata deploymentSubset, uint protocolVersion, uint asOfBlock) external /* onlyGovernor */;
}
