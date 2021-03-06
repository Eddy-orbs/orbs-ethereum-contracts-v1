/**
 * Copyright 2019 the orbs-ethereum-contracts authors
 * This file is part of the orbs-ethereum-contracts library in the Orbs project.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
 * The above notice should be included in all copies or substantial portions of the software.
 */

import * as ERC20ContractABI from 'orbs-staking-contract/build/abi/ERC20.json';
import Web3 from 'web3';
import { PromiEvent, TransactionReceipt } from 'web3-core';
import { Contract, EventData } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import { MainnetContractsAddresses } from '../contracts-adresses';
import { IOrbsTokenService } from '../interfaces/IOrbsTokenService';
import { getUnsubscribePromise } from '../utils/erc20EventsUtils';
import { ITypedEventData } from './contractsTypes/contractTypes';

/**
 * DEV_NOTE : The real object will also have array accessors ("1", "2", "3") that match the named members.
 */
interface IApprovalEventValues {
  owner: string; // Owner of the account
  spender: string; // Account approved to spend owners tokens
  // TODO : O.L : Change this to bigint after web3 change
  value: string; // Amount (DEV_NOTE : Currently string, in the future should change to bigint)
}

export class OrbsTokenService implements IOrbsTokenService {
  private erc20TokenContract: Contract;

  constructor(private web3: Web3, address: string = MainnetContractsAddresses.erc20Contract) {
    this.erc20TokenContract = new this.web3.eth.Contract(ERC20ContractABI as AbiItem[], address);
  }

  // CONFIG //
  setFromAccount(address: string): void {
    this.erc20TokenContract.options.from = address;
  }

  // READ //
  async readAllowance(ownerAddress: string, spenderAddress: string): Promise<bigint> {
    const allowanceStr: string = await this.erc20TokenContract.methods.allowance(ownerAddress, spenderAddress).call();
    return BigInt(allowanceStr);
  }

  // SUBSCRIPTIONS //
  subscribeToAllowanceChange(
    ownerAddress: string,
    spenderAddress: string,
    callback: (error: Error, allowance: bigint) => void,
  ) {
    const specificEventEmitter = this.erc20TokenContract.events.Approval(
      {
        filter: {
          owner: [ownerAddress],
          spender: [spenderAddress],
        },
      },
      async (error: Error, event: ITypedEventData<IApprovalEventValues>) => {
        if (error) {
          callback(error, null);
          return;
        }

        const newAllowance = event.returnValues.value;
        callback(null, BigInt(newAllowance));
      },
    );

    return () => getUnsubscribePromise(specificEventEmitter);
  }

  // WRITE //
  approve(spenderAddress: string, amount: bigint): PromiEvent<TransactionReceipt> {
    return this.erc20TokenContract.methods.approve(spenderAddress, amount.toString()).send();
  }
}
