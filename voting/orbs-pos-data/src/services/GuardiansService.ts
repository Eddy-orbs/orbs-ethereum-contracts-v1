/**
 * Copyright 2019 the orbs-ethereum-contracts authors
 * This file is part of the orbs-ethereum-contracts library in the Orbs project.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
 * The above notice should be included in all copies or substantial portions of the software.
 */

import Web3 from 'web3';
import { PromiEvent, TransactionReceipt } from 'web3-core';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import { IOrbsPosContractsAddresses } from '../contracts-adresses';
import guardiansContractJSON from '../contracts/OrbsGuardians.json';
import votingContractJSON from '../contracts/OrbsVoting.json';
import erc20ContactAbi from '../erc20-abi';
import { IDelegationData } from '../interfaces/IDelegationData';
import { IDelegationInfo, TDelegationType } from '../interfaces/IDelegationInfo';
import { IGuardianData } from '../interfaces/IGuardianData';
import { IGuardianInfo } from '../interfaces/IGuardianInfo';
import { IGuardiansService } from '../interfaces/IGuardiansService';
import { IOrbsClientService } from '../interfaces/IOrbsClientService';
import { NOT_DELEGATED, ORBS_TDE_ETHEREUM_BLOCK, VALID_VOTE_LENGTH } from "./consts";
import { getUpcomingElectionBlockNumber } from "./utils";

function ensureNumericValue(numberOrString: number | string): number {
  return typeof numberOrString === 'string' ? parseInt(numberOrString) : numberOrString;
}

export class GuardiansService implements IGuardiansService {
  private votingContract: Contract;
  private erc20Contract: Contract;
  private guardiansContract: Contract;

  constructor(
    private web3: Web3,
    private orbsClientService: IOrbsClientService,
    addresses: IOrbsPosContractsAddresses,
  ) {
    this.votingContract = new this.web3.eth.Contract(votingContractJSON.abi as AbiItem[], addresses.votingContract);
    this.erc20Contract = new this.web3.eth.Contract(erc20ContactAbi as AbiItem[], addresses.erc20Contract);
    this.guardiansContract = new this.web3.eth.Contract(guardiansContractJSON.abi, addresses.guardiansContract);
  }

  // CONFIG //
  setFromAccount(address: string): void {
    this.votingContract.options.from = address;
  }

  // WRITE //
  selectGuardian(guardianAddress: string): PromiEvent<TransactionReceipt> {
    return this.votingContract.methods.delegate(guardianAddress).send();
  }

  // READ //
  async getSelectedGuardianAddress(accountAddress: string): Promise<string> {
    let info: IDelegationData = await this.getCurrentDelegationByDelegate(accountAddress);
    if (info.delegatedTo === NOT_DELEGATED) {
      info = await this.getCurrentDelegationByTransfer(accountAddress);
    }

    return info.delegatedTo;
  }

  async getDelegationInfo(address: string): Promise<IDelegationInfo> {
    let info: IDelegationData = await this.getCurrentDelegationByDelegate(address);
    let delegationType: TDelegationType;
    if (info.delegatedTo === NOT_DELEGATED) {
      info = await this.getCurrentDelegationByTransfer(address);
      if (info.delegatedTo === NOT_DELEGATED) {
        delegationType = 'Not-Delegated';
      } else {
        delegationType = 'Transfer';
      }
    } else {
      delegationType = 'Delegate';
    }

    const balance = await this.getOrbsBalance(address);
    return {
      delegatorBalance: Number(balance),
      delegationType,
      ...info,
    };
  }

  async getGuardiansList(offset: number, limit: number): Promise<string[]> {
    return await this.getGuardians(offset, limit);
  }

  async getGuardianInfo(guardianAddress: string): Promise<IGuardianInfo> {
    const guardianData: IGuardianData = await this.getGuardianData(guardianAddress);

    const [votingWeightResults, totalParticipatingTokens] = await Promise.all([
      this.orbsClientService.getGuardianVoteWeight(guardianAddress),
      this.orbsClientService.getTotalParticipatingTokens(),
    ]);

    const result: IGuardianInfo = {
      voted: votingWeightResults !== BigInt(0),
      stake: 0,
      ...guardianData,
    };

    if (totalParticipatingTokens !== BigInt(0)) {
      result.stake = Number(votingWeightResults) / Number(totalParticipatingTokens);
    }

    return result;
  }

  ////////////////////////// PRIVATES ///////////////////////////

  private getGuardians(offset: number, limit: number): Promise<string[]> {
    return this.guardiansContract.methods.getGuardians(offset, limit).call();
  }

  private async getGuardianData(address: string): Promise<IGuardianData> {
    const [guardianData, currentVote, upcomingElectionsBlockNumber] = await Promise.all([
      this.guardiansContract.methods.getGuardianData(address).call(),
      this.votingContract.methods.getCurrentVote(address).call(),
      getUpcomingElectionBlockNumber(this.web3),
    ]);

    const votedAtBlockNumber = parseInt(currentVote.blockNumber);
    return {
      name: guardianData.name,
      website: guardianData.website,
      hasEligibleVote: votedAtBlockNumber + VALID_VOTE_LENGTH > upcomingElectionsBlockNumber,
      currentVote: currentVote.validators,
    };
  }

  private async getCurrentDelegationByDelegate(address: string): Promise<IDelegationData> {
    const from = address;

    let currentDelegation = await this.votingContract.methods.getCurrentDelegation(from).call({ from });

    if (currentDelegation === NOT_DELEGATED) {
      return {
        delegatedTo: currentDelegation,
      };
    }

    const options = {
      fromBlock: ORBS_TDE_ETHEREUM_BLOCK,
      toBlock: 'latest',
      filter: {
        delegator: this.web3.utils.padLeft(address, 40, '0'),
        to: this.web3.utils.padLeft(currentDelegation, 40, '0'),
      },
    };

    const events = await this.votingContract.getPastEvents('Delegate', options);
    const lastEvent = events.pop();

    let { timestamp } = await this.web3.eth.getBlock(lastEvent.blockNumber);
    timestamp = ensureNumericValue(timestamp);

    return {
      delegatedTo: currentDelegation,
      delegationBlockNumber: lastEvent.blockNumber,
      delegationTimestamp: timestamp * 1000,
    };
  }

  private async getOrbsBalance(address: string): Promise<string> {
    const balance = await this.erc20Contract.methods.balanceOf(address).call();
    return this.web3.utils.fromWei(balance, 'ether');
  }

  private async getCurrentDelegationByTransfer(address: string): Promise<IDelegationData> {
    const delegationConstant = '0x00000000000000000000000000000000000000000000000000f8b0a10e470000';

    const paddedAddress = this.web3.utils.padLeft(address, 40, '0');
    const options = {
      fromBlock: ORBS_TDE_ETHEREUM_BLOCK,
      toBlock: 'latest',
      filter: { from: paddedAddress },
    };

    const events = await this.erc20Contract.getPastEvents('Transfer', options);

    const entryWithTransaction = events.reverse().find(({ raw }) => raw['data'] === delegationConstant);

    if (!entryWithTransaction) {
      return {
        delegatedTo: NOT_DELEGATED,
      };
    }

    let { timestamp } = await this.web3.eth.getBlock(entryWithTransaction.blockNumber);
    timestamp = ensureNumericValue(timestamp);
    const help = entryWithTransaction['raw']['topics'][2];

    return {
      delegatedTo: '0x' + help.substring(26, 66),
      delegationBlockNumber: entryWithTransaction.blockNumber,
      delegationTimestamp: timestamp * 1000,
    };
  }
}