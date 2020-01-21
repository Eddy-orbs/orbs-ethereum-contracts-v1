import Web3 from "web3";
declare const web3: Web3;

import BN from "bn.js";
import {Driver} from "./driver";
import chai from "chai";
chai.use(require('chai-bn')(BN));
chai.use(require('./matchers'));

const expect = chai.expect;

import {CommitteeProvider} from './committee-provider';


contract('elections-high-level-flows', async () => {

  it('handle delegation requests', async () => {
    const d = await Driver.new();

    const d1 = await d.newParticipant();
    const d2 = await d.newParticipant();

    const r = await d1.delegate(d2);
    expect(r).to.have.a.delegatedEvent({
      from: d1.address,
      to: d2.address
    });
  });

  it('sorts committee by stake', async () => {
    const d = await Driver.new(2, 3);
    const committeeProvider = new CommitteeProvider((web3.currentProvider as any).host, d.elections.address);

    const stake100 = new BN(100);
    const stake200 = new BN(200);
    const stake300 = new BN(300);
    const stake500 = new BN(500);

    // First validator registers

    const validatorStaked100 = d.newParticipant();
    let r = await validatorStaked100.stake(stake100);
    expect(r).to.have.a.stakedEvent();

    r = await validatorStaked100.registerAsValidator();
    expect(r).to.have.a.validatorRegisteredEvent({
      addr: validatorStaked100.address,
      ip: validatorStaked100.ip
    });
    expect(r).to.have.a.committeeChangedEvent({
      addrs: [validatorStaked100.address],
      orbsAddrs: [validatorStaked100.orbsAddress],
      stakes: [stake100],
    });
    expect(r).to.have.a.topologyChangedEvent({
      orbsAddrs: [validatorStaked100.orbsAddress],
      ips: [validatorStaked100.ip]
    });

    const committeeFromAdapter = await committeeProvider.getCommitteeAsOf(r.receipt.blockNumber);
    expect(committeeFromAdapter).to.haveCommittee({
      addrs: [validatorStaked100.address.toLowerCase()],
      orbsAddrs: [validatorStaked100.orbsAddress.toLowerCase()],
      stakes: [stake100],
    });

    const validatorStaked200 = d.newParticipant();
    r = await validatorStaked200.stake(stake200);
    expect(r).to.have.a.totalStakeChangedEvent({addr: validatorStaked200.address, newTotal: stake200});

    r = await validatorStaked200.registerAsValidator();

    expect(r).to.have.a.validatorRegisteredEvent({
      addr: validatorStaked200.address,
      ip: validatorStaked200.ip,
    });
    expect(r).to.have.a.committeeChangedEvent({
      addrs: [validatorStaked200.address, validatorStaked100.address],
      orbsAddrs: [validatorStaked200.orbsAddress, validatorStaked100.orbsAddress],
      stakes: [stake200, stake100]
    });
    expect(r).to.have.a.topologyChangedEvent({
      orbsAddrs: [validatorStaked200.orbsAddress, validatorStaked100.orbsAddress],
      ips: [validatorStaked200.ip, validatorStaked100.ip]
    });

    // A third validator registers high ranked

    const validatorStaked300 = d.newParticipant();
    r = await validatorStaked300.stake(stake300);
    expect(r).to.have.a.stakedEvent();

    r = await validatorStaked300.registerAsValidator();
    expect(r).to.have.a.validatorRegisteredEvent({
      addr: validatorStaked300.address,
      ip: validatorStaked300.ip
    });
    expect(r).to.have.a.committeeChangedEvent({
      addrs: [validatorStaked300.address, validatorStaked200.address],
      orbsAddrs: [validatorStaked300.orbsAddress, validatorStaked200.orbsAddress],
      stakes: [stake300, stake200]
    });
    expect(r).to.have.a.topologyChangedEvent({
      orbsAddrs: [validatorStaked300.orbsAddress, validatorStaked200.orbsAddress, validatorStaked100.orbsAddress],
      ips: [validatorStaked300.ip, validatorStaked200.ip, validatorStaked100.ip]
    });

    r = await d.delegateMoreStake(stake300, validatorStaked200);
    expect(r).to.have.a.committeeChangedEvent({
      addrs: [validatorStaked200.address, validatorStaked300.address],
      orbsAddrs: [validatorStaked200.orbsAddress, validatorStaked300.orbsAddress],
      stakes: [stake200.add(stake300), stake300]
    });
    expect(r).to.have.a.topologyChangedEvent({
      orbsAddrs: [validatorStaked200.orbsAddress, validatorStaked300.orbsAddress, validatorStaked100.orbsAddress],
      ips: [validatorStaked200.ip, validatorStaked300.ip, validatorStaked100.ip]
    });

    r = await d.delegateMoreStake(stake500, validatorStaked100);
    expect(r).to.have.a.committeeChangedEvent({
      addrs: [validatorStaked100.address, validatorStaked200.address],
      orbsAddrs: [validatorStaked100.orbsAddress, validatorStaked200.orbsAddress],
      stakes: [stake100.add(stake500), stake500]
    });
    expect(r).to.have.a.topologyChangedEvent({
      orbsAddrs: [validatorStaked100.orbsAddress, validatorStaked200.orbsAddress, validatorStaked300.orbsAddress],
      ips: [validatorStaked100.ip, validatorStaked200.ip, validatorStaked300.ip]
    });
  });

});
