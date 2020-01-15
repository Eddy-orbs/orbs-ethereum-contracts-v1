const BN = require('bn.js');
const chai = require('chai');
chai.use(require('chai-bn')(BN));
chai.use(require('./matchers'));
const {Driver, expectBNArrayEqual, expectRejected} = require("./driver");

const {subscriptionChangedEvent} = require('./eventParsing');

const expect = chai.expect;

contract('pos-v2-high-level-flows', async () => {

  it('registers a VC', async () => {
    const d = await Driver.new();

    const monthlyRate = new BN(1000);
    const firstPayment = monthlyRate.mul(new BN(2));

    const subscriber = await d.newSubscriber("defaultTier", monthlyRate);
    // buy subscription for a new VC
    const appOwner = d.newParticipant();
    await d.erc20.assign(appOwner.address, firstPayment);
    await d.erc20.approve(appOwner.staking.address, firstPayment, {from: appOwner.address});
    let r = await subscriber.createVC(firstPayment, {from: appOwner.address});

    // TODO check tokens were withdrawn

    expect(r).to.have.subscriptionChangedEvent();
    const firstSubsc = subscriptionChangedEvent(r).pop();

    const blockNumber = new BN(r.receipt.blockNumber);
    const blockTimestamp = new BN((await web3.eth.getBlock(blockNumber)).timestamp);
    const expectedGenRef = blockNumber.add(new BN('300'));
    const secondsInMonth = new BN(30 * 24 * 60 * 60);
    let expectedExpiration = new BN(blockTimestamp).add(firstPayment.mul(secondsInMonth).div(monthlyRate));

    expect(firstSubsc.vcid).to.exist;
    expect(firstSubsc.genRef).to.be.bignumber.equal(expectedGenRef);
    expect(firstSubsc.expiresAt).to.be.bignumber.equal(expectedExpiration);
    expect(firstSubsc.tier).to.equal("defaultTier");

    let vcid = firstSubsc.vcid;
    expect(r).to.have.paymentEvent({vcid, by: appOwner.address, amount: firstPayment, tier: "defaultTier", rate: monthlyRate});

    // Buy more time
    const anotherPayer = d.newParticipant();
    const secondPayment = new BN(3000);
    await d.erc20.assign(anotherPayer.address, secondPayment);
    await d.erc20.approve(anotherPayer.staking.address, secondPayment, {from: anotherPayer.address});
    r = await subscriber.extendSubscription(vcid, secondPayment, {from: anotherPayer.address});
    expect(r).to.have.paymentEvent({vcid, by: anotherPayer.address, amount: secondPayment, tier: "defaultTier", rate: monthlyRate});

    expect(r).to.have.subscriptionChangedEvent();
    const secondSubsc = subscriptionChangedEvent(r).pop();

    expectedExpiration = new BN(firstSubsc.expiresAt).add(secondPayment.mul(secondsInMonth).div(monthlyRate));

    expect(secondSubsc.vcid).to.equal(firstSubsc.vcid);
    expect(secondSubsc.genRef).to.be.equal(firstSubsc.genRef);
    expect(secondSubsc.expiresAt).to.be.bignumber.equal(expectedExpiration);
    expect(secondSubsc.tier).to.equal("defaultTier");


    // TODO check tokens were withdrawn

  });

  it('does something logical when people pay after expiration', ()=> {});

});