import { IDelegationData } from '../interfaces/IDelegationData';
import { IEthereumClientService } from '../interfaces/IEthereumClientService';
import { IGuardianData } from '../interfaces/IGuardianData';
import { IRewardsDistributionEvent } from '../interfaces/IRewardsDistributionEvent';
import { IValidatorData } from '../interfaces/IValidatorData';

/**
 * Copyright 2019 the orbs-ethereum-contracts authors
 * This file is part of the orbs-ethereum-contracts library in the Orbs project.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
 * The above notice should be included in all copies or substantial portions of the software.
 */

export type ValidatorsMap = {[key: string]: IValidatorData};

export class EthereumClientServiceMock implements IEthereumClientService {
  private validatorsMap: ValidatorsMap = {};
  private orbsBalanceMap: Map<string, bigint> = new Map();

  async getValidators(): Promise<string[]> {
    return Object.keys(this.validatorsMap);
  }

  async getValidatorData(address: string): Promise<IValidatorData> {
    return this.validatorsMap[address];
  }

  async getGuardians(offset: number, limit: number): Promise<string[]> {
    return [];
  }

  async getGuardianData(address: string): Promise<IGuardianData> {
    return {
      name: null,
      website: null,
      hasEligibleVote: false,
      currentVote: []
    };
  }

  async getCurrentDelegationByDelegate(address: string): Promise<IDelegationData> {
    return {
      delegatedTo: null,
      delegationBlockNumber: 0,
      delegationTimestamp: 0,
    };
  }

  async getOrbsRewardsDistribution(address: string): Promise<IRewardsDistributionEvent[]> {
    return [];
  }

  async getCurrentDelegationByTransfer(address: string): Promise<IDelegationData> {
    return {
      delegatedTo: null,
      delegationBlockNumber: 0,
      delegationTimestamp: 0,
    };
  }

  async getUpcomingElectionBlockNumber(): Promise<number> {
    return 0;
  }

  async getOrbsBalance(address: string): Promise<string> {
    const resultBigInt = this.orbsBalanceMap.get(address);
    return resultBigInt ? resultBigInt.toString() : '0';
  }

  //// TEST Helpers
  withValidators(validatorsMap: ValidatorsMap): this {
    this.validatorsMap = validatorsMap;
    return this;
  }

  withORBSBalance(address: string, newBalance: bigint): this {
    this.orbsBalanceMap.set(address, newBalance);
    return this;
  }
}
