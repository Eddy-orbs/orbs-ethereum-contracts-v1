import chai from 'chai';
import utils from 'ethereumjs-util';

import expectRevert from './helpers/expectRevert';
import ASBProof from './helpers/asbProof';

const TEST_ACCOUNTS = require('./accounts.json');

const { expect } = chai;

const Federation = artifacts.require('./Federation.sol');
const AutonomousSwapProofVerifierWrapper = artifacts.require('./AutonomousSwapProofVerifierWrapper.sol');

contract('AutonomousSwapProofVerifier', (accounts) => {
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const VERSION = '0.1';

  it('should not allow to create with a 0x0 federation', async () => {
    await expectRevert(AutonomousSwapProofVerifierWrapper.new(ZERO_ADDRESS));
  });

  it('should report version', async () => {
    const federation = await Federation.new(accounts.slice(0, 2));
    const verifier = await AutonomousSwapProofVerifierWrapper.new(federation.address);
    expect(await verifier.VERSION.call()).to.be.bignumber.equal(VERSION);
  });

  describe('parsing', async () => {
    let verifier;

    beforeEach(async () => {
      const federation = await Federation.new(accounts.slice(0, 2));
      verifier = await AutonomousSwapProofVerifierWrapper.new(federation.address);
    });

    describe('results block header', async () => {
      it('should properly parse', async () => {
        const data = {
          protocolVersion: 2,
          virtualChainId: 1111,
          networkType: 1,
          timestamp: 1544081404,
          receiptMerkleRoot: utils.keccak256('Hello World!!!'),
        };

        const resultsBlockHeader = ASBProof.buildResultsBlockHeader(data);
        const rawResultsBlockHeader = utils.bufferToHex(resultsBlockHeader);
        const resultsBlockHeaderData = await verifier.parseResultsBlockHeaderRaw.call(rawResultsBlockHeader);

        expect(resultsBlockHeaderData[0]).to.be.bignumber.equal(data.protocolVersion);
        expect(resultsBlockHeaderData[1]).to.be.bignumber.equal(data.virtualChainId);
        expect(resultsBlockHeaderData[2]).to.be.bignumber.equal(data.networkType);
        expect(resultsBlockHeaderData[3]).to.be.bignumber.equal(data.timestamp);
        expect(utils.toBuffer(resultsBlockHeaderData[4])).to.eql(data.receiptMerkleRoot);
      });
    });

    describe('results block proof', async () => {
      it('should properly parse', async () => {
        const testSignatures = TEST_ACCOUNTS.slice(0, 32).map((account) => {
          const messageHashBuffer = utils.keccak256('Hello world3!');
          const rawSignature = utils.ecsign(messageHashBuffer, utils.toBuffer(account.privateKey));
          const signature = utils.toRpcSig(rawSignature.v, rawSignature.r, rawSignature.s);

          return {
            publicAddress: account.address,
            signature,
          };
        });

        const blockHash = utils.keccak256('Hello World2!');
        const data = {
          blockProofVersion: 5,
          transactionsBlockHash: utils.keccak256('Hello World!'),
          blockrefMessage: Buffer.concat([Buffer.alloc(20), blockHash]),
          signatures: testSignatures,
        };

        const resultsBlockProof = ASBProof.buildResultsProof(data);
        const rawResultsBlockProof = utils.bufferToHex(resultsBlockProof);
        const resultsBlockProofData = await verifier.parseResultsBlockProofRaw.call(rawResultsBlockProof);

        expect(resultsBlockProofData[0]).to.be.bignumber.equal(data.blockProofVersion);
        expect(utils.toBuffer(resultsBlockProofData[1])).to.eql(data.transactionsBlockHash);
        expect(utils.toBuffer(resultsBlockProofData[2])).to.eql(utils.keccak256(data.blockrefMessage));
        expect(utils.toBuffer(resultsBlockProofData[3])).to.eql(blockHash);
        const numOfSignatures = resultsBlockProofData[4].toNumber();
        expect(numOfSignatures).to.be.bignumber.equal(data.signatures.length);

        for (let i = 0; i < numOfSignatures; ++i) {
          expect(resultsBlockProofData[5][i]).to.be.eql(testSignatures[i].publicAddress);

          // TODO: at the moment, truffle can't properly parse the returned bytes[MAX_SIGNATURE] addresses. This should
          // be fixed in truffle 0.5 and later.
          // expect(resultsBlockProofData[6][i]).to.be.eql(testSignatures[i].signature);
        }
      });
    });

    describe('transaction receipt', async () => {
      it('should properly parse', async () => {
        const eventData = {
          orbsContractName: 'Hello World!',
          eventId: 12,
          tuid: 56789,
          orbsAddress: Buffer.from('ef0ee8a2ba59624e227f6ac0a85e6aa5e75df86a', 'hex'),
          ethereumAddress: '0x2c80c37bdf6d68390ccaa03a125f65dcc43b7a5f',
          value: 1500,
        };

        const data = {
          executionResult: 5,
        };

        const transactionReceipt = ASBProof.buildTransactionReceipt(data, eventData);
        const rawTransactionReceipt = utils.bufferToHex(transactionReceipt);
        const transactionReceiptfData = await verifier.parseTransactionReceiptRaw.call(rawTransactionReceipt);

        expect(transactionReceiptfData[0]).to.be.bignumber.equal(data.executionResult);
        expect(utils.toBuffer(transactionReceiptfData[1])).to.eql(ASBProof.buildEventData(eventData));
      });
    });

    describe('event data', async () => {
      it('should properly parse', async () => {
        const data = {
          orbsContractName: 'Hello World!',
          eventId: 12,
          tuid: 56789,
          orbsAddress: Buffer.from('ef0ee8a2ba59624e227f6ac0a85e6aa5e75df86a', 'hex'),
          ethereumAddress: '0x2c80c37bdf6d68390ccaa03a125f65dcc43b7a5f',
          value: 1500,
        };

        const event = ASBProof.buildEventData(data);
        const rawEventData = utils.bufferToHex(event);
        const eventData = await verifier.parseEventDataRaw.call(rawEventData);

        expect(eventData[0]).to.eql(data.orbsContractName);
        expect(eventData[1]).to.be.bignumber.equal(data.eventId);
        expect(eventData[2]).to.be.bignumber.equal(data.tuid);
        expect(eventData[3]).to.eql(utils.bufferToHex(data.orbsAddress));
        expect(eventData[4]).to.eql(data.ethereumAddress);
        expect(eventData[5]).to.be.bignumber.equal(data.value);
      });
    });
  });

  describe('proof processing', async () => {
    const NETWORK_TYPE = 0;
    const VIRTUAL_CHAIN_ID = 0x6b696e;
    const ORBS_ASB_CONTRACT_NAME = 'asb';
    const PROTOCOL_VERSION = 51;

    const federationMemberAccounts = TEST_ACCOUNTS.slice(0, 32);
    const federationMembersAddresses = federationMemberAccounts.map(account => account.address);
    let verifier;

    beforeEach(async () => {
      const federation = await Federation.new(federationMembersAddresses);
      verifier = await AutonomousSwapProofVerifierWrapper.new(federation.address);
    });

    context('valid', async () => {
      it('should process correctly', async () => {
        const proof = (new ASBProof())
          .setFederationMemberAccounts(federationMemberAccounts)
          .setOrbsContractName(ORBS_ASB_CONTRACT_NAME)
          .setEventId(7755)
          .setTuid(12)
          .setOrbsAddress('ef0ee8a2ba59624e227f6ac0a85e6aa5e75df86a')
          .setEthereumAddress(accounts[5])
          .setValue(100000)
          .setTransactionExecutionResult(1)
          .setTransactionReceipts(['transaction1', 'transaction2', 5, 4, 3])
          .setProtocolVersion(PROTOCOL_VERSION)
          .setVirtualChainId(VIRTUAL_CHAIN_ID)
          .setNetworkType(NETWORK_TYPE)
          .setTimestamp(Math.floor((new Date()).getTime() / 1000))
          .setBlockProofVersion(0);

        const rawProof = proof.getHexProof();
        const proofData = await verifier.processProofRaw.call(rawProof.resultsBlockHeader, rawProof.resultsBlockProof,
          rawProof.transactionReceipt, rawProof.transactionReceiptProof);

        expect(proofData[0]).to.eql(utils.bufferToHex(proof.orbsAddress));
        expect(proofData[1]).to.eql(proof.ethereumAddress);
        expect(proofData[2]).to.be.bignumber.equal(proof.value);
        expect(proofData[3]).to.be.bignumber.equal(proof.networkType);
        expect(proofData[4]).to.be.bignumber.equal(proof.virtualChainId);
        expect(proofData[5]).to.be.bignumber.equal(proof.tuid);
      });
    });
  });
});
