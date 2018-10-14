pragma solidity 0.4.24;

import "../contracts/SubscriptionManager.sol";


contract SubscriptionManagerMock is SubscriptionManager {
    struct UpgradeContext {
        bool called;
        address newContract;
        bool shouldFailGracefully;
        bool shouldRevert;
    }

    UpgradeContext public upgradeContext;

    constructor(ERC20 _orbs, Federation _federation, uint256 _minimalMonthlySubscription) public
        SubscriptionManager(_orbs, _federation, _minimalMonthlySubscription) {
    }

    function getTotalMonthlySubscriptionsTokens(uint16 _year, uint8 _month) public view returns (uint256) {
        return subscriptions[_year][_month].totalTokens;
    }

    function distributeFeesByTime(uint16 _year, uint8 _month) public {
        super.distributeFees(_year, _month);
    }

    function subscribeByTime(bytes32 _id, string _profile, uint256 _value, uint256 _startTime) public {
        super.subscribe(_id, _profile, _value, _startTime);
    }

    function setUpgradeFail(bool _gracefully) public {
        upgradeContext.shouldFailGracefully = _gracefully;
        upgradeContext.shouldRevert = !_gracefully;
    }

    function onUpgrade(Upgradable _newContract) internal returns (bool) {
        if (upgradeContext.shouldFailGracefully) {
            return false;
        }

        require(!upgradeContext.shouldRevert, "Upgrade failed!");

        upgradeContext.called = true;
        upgradeContext.newContract = _newContract;

        return super.onUpgrade(_newContract);
    }
}
