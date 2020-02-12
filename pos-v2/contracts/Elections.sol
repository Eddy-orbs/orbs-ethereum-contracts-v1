pragma solidity 0.4.26;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/Math.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./IStakingListener.sol";
import "./ICommitteeListener.sol";

contract Elections is IStakingListener, Ownable {
	using SafeMath for uint256;

	event ValidatorRegistered(address addr, bytes4 ip, address orbsAddr);
	event CommitteeChanged(address[] addrs, address[] orbsAddrs, uint256[] stakes);
	event TopologyChanged(address[] orbsAddrs, bytes4[] ips);
	event VoteOut(address voter, address against);
	event VotedOutOfCommittee(address addr);

	event Delegated(address from, address to);
	event TotalStakeChanged(address addr, uint256 newTotal); // TODO - do we need this?

	address[] topology;

	struct Validator {
		bytes4 ip;
		address orbsAddress;
	}

	// TODO consider using structs instead of multiple mappings
	mapping (address => Validator) registeredValidators;
	mapping (address => bool) readyValidators; // TODO if out-of-topology validators cannot be be ready-for-committee, this mapping can be replaced by a single uint
	mapping (address => uint256) ownStakes;
	mapping (address => uint256) totalStakes;
	mapping (address => uint256) uncappedStakes;
	mapping (address => address) delegations;
	mapping (address => mapping (address => uint256)) voteOuts; // by => to => timestamp
	mapping (address => address) orbsAddressToMainAddress;

	uint committeeSize; // TODO may be redundant if readyValidators mapping is present

	ICommitteeListener committeeListener;
	address stakingContract;

	uint minimumStake;
	uint maxCommitteeSize;
	uint maxTopologySize;
	uint maxDelegationRatio; // TODO consider using a hardcoded constant instead.
	uint8 voteOutPercentageThreshold;
	uint256 voteOutTimeoutSeconds;

	modifier onlyStakingContract() {
		require(msg.sender == stakingContract, "caller is not the staking contract");

		_;
	}

	constructor(uint _maxCommitteeSize, uint _maxTopologySize, uint _minimumStake, uint8 _maxDelegationRatio, uint8 _voteOutPercentageThreshold, uint256 _voteOutTimeoutSeconds, ICommitteeListener _committeeListener) public {
		require(_maxCommitteeSize > 0, "maxCommitteeSize must be larger than 0");
		require(_maxTopologySize > _maxCommitteeSize, "topology must be larger than a full committee");
		require(_committeeListener != address(0), "committee listener should not be 0");
		require(_minimumStake > 0, "minimum stake for committee must be non-zero");
		require(_maxDelegationRatio >= 1, "max delegation ration must be at least 1");
		require(_voteOutPercentageThreshold >= 0 && _voteOutPercentageThreshold <= 100, "voteOutPercentageThreshold must be between 0 and 100");

		minimumStake = _minimumStake;
		maxCommitteeSize = _maxCommitteeSize;
		committeeListener = _committeeListener;
		maxTopologySize = _maxTopologySize;
	    maxDelegationRatio = _maxDelegationRatio;
		voteOutPercentageThreshold = _voteOutPercentageThreshold;
		voteOutTimeoutSeconds = _voteOutTimeoutSeconds;
	}

	function getTopology() public view returns (address[]) {
		return topology;
	}

	function setStakingContract(address addr) external onlyOwner {
		require(addr != address(0), "Got staking contract address 0");
		stakingContract = addr;
	}

	function registerValidator(bytes4 _ip, address _orbsAddress) external  {
		require(registeredValidators[msg.sender].orbsAddress == address(0), "Validator is already registered");
		require(_orbsAddress != address(0), "orbs address must be non zero");

		registeredValidators[msg.sender].orbsAddress = _orbsAddress;
		registeredValidators[msg.sender].ip = _ip;
		orbsAddressToMainAddress[_orbsAddress] = msg.sender;
		emit ValidatorRegistered(msg.sender, _ip, _orbsAddress);

		_placeInTopology(msg.sender);
	}

	function notifyReadyForCommittee() external {
		address sender = getMainAddrFromOrbsAddr(msg.sender);
		readyValidators[sender] = true;
		_placeInTopology(sender);
	}

	function delegate(address to) external {
		address prevDelegatee = delegations[msg.sender];
        if (prevDelegatee == address(0)) {
            prevDelegatee = msg.sender;
        }

		uint256 stake = ownStakes[msg.sender];
        _updateTotalStake(prevDelegatee, uncappedStakes[prevDelegatee].sub(stake));
        _placeInTopology(prevDelegatee); // TODO may emit superfluous event
		_updateTotalStake(to, uncappedStakes[to].add(stake));
		_placeInTopology(to);

		delegations[msg.sender] = to;

		emit Delegated(msg.sender, to);
	}

	function voteOut(address addr) external {
		address sender = getMainAddrFromOrbsAddr(msg.sender);
		uint256 totalCommitteeStake = 0;
		uint256 totalVoteOutStake = 0;

		voteOuts[sender][addr] = now;
		for (uint i = 0; i < committeeSize; i++) {
			address member = topology[i];
			uint256 memberStake = totalStakes[member];

			totalCommitteeStake = totalCommitteeStake.add(memberStake);
			uint256 votedAt = voteOuts[member][addr];
			if (votedAt != 0 && now.sub(votedAt) < voteOutTimeoutSeconds) {
				totalVoteOutStake = totalVoteOutStake.add(memberStake);
			}
			// TODO - consider clearing up stale votes from the state (gas efficiency)
		}

		if (totalCommitteeStake > 0 && totalVoteOutStake.mul(100).div(totalCommitteeStake) >= voteOutPercentageThreshold) {
			for (i = 0; i < committeeSize; i++) {
				voteOuts[topology[i]][addr] = 0; // clear vote-outs
			}
			readyValidators[addr] = false;
			_placeInTopology(addr);

			emit VotedOutOfCommittee(addr);
		}

		emit VoteOut(sender, addr);
	}

	function distributedStake(address[] stakeOwners, uint256[] amounts) external onlyStakingContract {
		require(stakeOwners.length == amounts.length);

		for (uint i = 0; i < stakeOwners.length; i++) {
			staked(stakeOwners[i], amounts[i]);
		}
	}

	function staked(address staker, uint256 amount) public onlyStakingContract {
		address delegatee = delegations[staker];
		if (delegatee == address(0)) {
			delegatee = staker;
		}
		ownStakes[staker] = ownStakes[staker].add(amount);
		_updateTotalStake(delegatee, uncappedStakes[delegatee].add(amount));

		_placeInTopology(delegatee);
	}

	function unstaked(address staker, uint256 amount) external onlyStakingContract {
		address delegatee = delegations[staker];
		if (delegatee == address(0)) {
			delegatee = staker;
		}
		ownStakes[staker] = ownStakes[staker].sub(amount);
		_updateTotalStake(delegatee, uncappedStakes[delegatee].sub(amount));

		_placeInTopology(delegatee);
	}

	function getMainAddrFromOrbsAddr(address orbsAddr) private returns (address) {
		address sender = orbsAddressToMainAddress[orbsAddr];
		require(sender != address(0), "unknown orbs address");
		return sender;
	}

	// TODO what is the requirement? should an absolute minimum stake be enforced?
	function _holdsMinimumStake(address validator) private view returns (bool) {
		return minimumStake <= ownStakes[validator] && // validator must hold the minimum required stake (own)
		       minimumStake <= totalStakes[validator]; // validator must hold the minimum required stake (effective)
	}

	function _isSelfDelegating(address validator) private view returns (bool) {
		return delegations[validator] == address(0) || delegations[validator] == validator;
	}

	function _satisfiesTopologyPrerequisites(address validator) private view returns (bool) {
		return registeredValidators[validator].orbsAddress != address(0) &&    // validator must be registered
			   _isSelfDelegating(validator) &&
		       _holdsMinimumStake(validator);
	}

	function _isQualifiedForTopologyByRank(address validator) private view returns (bool) {
		// this assumes maxTopologySize > maxCommitteeSize, otherwise a non ready-for-committee validator may override one that is ready.
		return topology.length < maxTopologySize || // topology is not full
				totalStakes[validator] > totalStakes[topology[topology.length-1]]; // validator has more stake the the bottom topology validator
	}

	function _loadStakes(uint limit) private view returns (uint256[]) {
		assert(limit <= maxTopologySize);
		if (limit > topology.length) {
			limit = topology.length;
		}
		uint256[] memory stakes = new uint256[](limit);
		for (uint i=0; i < limit && i < topology.length; i++) {
			stakes[i] = totalStakes[topology[i]];
		}
		return stakes;
	}

	function _loadTopologyStakes() private view returns (uint256[]) {
		return _loadStakes(maxTopologySize);
	}

	function _loadCommitteeStakes() private view returns (uint256[]) {
		return _loadStakes(committeeSize);
	}

	function _notifyTopologyChanged() private {
		assert(topology.length <= maxTopologySize);
		address[] memory topologyOrbsAddresses = new address[](topology.length);
		bytes4[] memory ips = new bytes4[](topology.length);

		for (uint i = 0; i < topologyOrbsAddresses.length; i++) {
			Validator storage val = registeredValidators[topology[i]];
			topologyOrbsAddresses[i] = val.orbsAddress;
			ips[i] = val.ip;
		}
		emit TopologyChanged(topologyOrbsAddresses, ips);
	}

	function _notifyCommitteeChanged() private {
		uint256[] memory committeeStakes = _loadCommitteeStakes();
		address[] memory committeeOrbsAddresses = new address[](committeeStakes.length);
		address[] memory committeeAddresses = new address[](committeeStakes.length);
		for (uint i = 0; i < committeeStakes.length; i++) {
			Validator storage val = registeredValidators[topology[i]];
			committeeOrbsAddresses[i] = val.orbsAddress;
			committeeAddresses[i] = topology[i];
		}
		committeeListener.committeeChanged(committeeAddresses, committeeStakes);
		emit CommitteeChanged(committeeAddresses, committeeOrbsAddresses, committeeStakes);
	}

	function _refreshCommitteeSize() private returns (uint, uint) {
		uint newSize = committeeSize;
		uint prevSize = newSize;
		while (newSize > 0 && (topology.length < newSize || !readyValidators[topology[newSize - 1]])) {
			newSize--;
		}
		while (topology.length > newSize && readyValidators[topology[newSize]] && newSize < maxCommitteeSize){
			newSize++;
		}
		committeeSize = newSize;
		return (prevSize, newSize);
	}

	function _removeFromTopology(uint pos) private {
		assert(topology.length > 0);
		assert(p < topology.length);

		for (uint p = pos; p < topology.length - 1; p++) {
			topology[p] = topology[p + 1];
		}

		topology.length = topology.length - 1;
		(uint prevSize, uint currentSize) = _refreshCommitteeSize();

		if (prevSize != currentSize || pos < currentSize) {
			_notifyCommitteeChanged();
		}

		_notifyTopologyChanged();
	}

	function _appendToTopology(address validator) private {
		uint pos = topology.length - 1; // current last

		if (topology.length < maxTopologySize) { // extend topology
			topology.length++;
			pos++;
		}

		topology[pos] = validator;

		pos = _repositionTopologyMember(pos);
		(uint prevSize, uint currentSize) = _refreshCommitteeSize();

		if (prevSize != currentSize || pos < currentSize) {
			_notifyCommitteeChanged();
		}

		_notifyTopologyChanged();
	}

	function _adjustPositionInTopology(uint pos) private {
		uint newPos = _repositionTopologyMember(pos);
		(uint prevSize, uint currentSize) = _refreshCommitteeSize();

		if (prevSize != currentSize || pos < currentSize || newPos < currentSize) {
			_notifyCommitteeChanged();
		}
	}

	function _placeInTopology(address validator) private {
		(uint pos, bool inTopology) = _findInTopology(validator);

		if (inTopology && !_satisfiesTopologyPrerequisites(validator)) {
			_removeFromTopology(pos);
			return;
		}

		if (inTopology) {
			_adjustPositionInTopology(pos);
			return;
		}

		if (_satisfiesTopologyPrerequisites(validator) && _isQualifiedForTopologyByRank(validator)) {
			_appendToTopology(validator);
			return;
		}
	}

	function _compareValidators(uint v1pos, uint v2pos) private view returns (int) {
		address v1 = topology[v1pos];
		bool v1Ready = readyValidators[v1];
		uint256 v1Stake = totalStakes[v1];
		address v2 = topology[v2pos];
		bool v2Ready = readyValidators[v2];
		uint256 v2Stake = totalStakes[v2];
		return v1Ready && !v2Ready || v1Ready == v2Ready && v1Stake > v2Stake ? int(1) : -1;
	}

	function _repositionTopologyMember(uint memberPos) private returns (uint) {
        uint topologySize = topology.length;
		assert(topologySize > memberPos);

		while (memberPos > 0 && _compareValidators(memberPos, memberPos - 1) > 0) {
			_replace(memberPos-1, memberPos);
			memberPos--;
		}

		while (memberPos < topologySize - 1 && _compareValidators(memberPos, memberPos + 1) < 0) {
			_replace(memberPos, memberPos+1);
			memberPos++;
		}

		return memberPos;
	}

	function _replace(uint p1, uint p2) private {
		address tempValidator = topology[p1];
		topology[p1] = topology[p2];
		topology[p2] = tempValidator;
	}

	function _updateTotalStake(address addr, uint256 newTotal) private {
		uncappedStakes[addr] = newTotal;
		uint256 ownStake = 0;
		if (_isSelfDelegating(addr)) {
			ownStake = ownStakes[addr];
		}
		uint256 capped = _capStake(newTotal, ownStake);
		totalStakes[addr] = capped;
		emit TotalStakeChanged(addr, capped);
	}

	function _capStake(uint256 uncapped, uint256 own) view private returns (uint256){
		if (own == 0) {
			return 0;
		}
		uint256 maxRatio = maxDelegationRatio;
		if (uncapped.div(own) < maxRatio) {
			return uncapped;
		}
		return own.mul(maxRatio); // never overflows
	}

	function _findInTopology(address v) private view returns (uint, bool) {
		uint l =  topology.length;
		for (uint i=0; i < l; i++) {
			if (topology[i] == v) {
				return (i, true);
			}
		}
		return (0, false);
	}


}
