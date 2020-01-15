import { PromiEvent, TransactionReceipt } from 'web3-core';
import { IGuardiansService } from '../interfaces/IGuardiansService';
import { ITxCreatingServiceMock } from './ITxCreatingServiceMock';
import { TxsMocker } from './TxsMocker';
import { IGuardianInfo } from '../interfaces/IGuardianInfo';

type TTxCreatingActionNames = 'stake' | 'unstake' | 'restake' | 'withdraw' | 'selectGuardian';

export class GuardiansServiceMock implements IGuardiansService, ITxCreatingServiceMock {
  public readonly txsMocker: TxsMocker<TTxCreatingActionNames>;

  private guardiansList: string[] = [];
  private guardiansMap: Map<string, IGuardianInfo> = new Map();
  private selectedGuardiansMap: Map<string, string> = new Map();

  constructor(autoCompleteTxes: boolean = true) {
    this.txsMocker = new TxsMocker<TTxCreatingActionNames>(autoCompleteTxes);
  }

  // CONFIG //
  setFromAccount(address: string): void {
    this.txsMocker.setFromAccount(address);
  }

  // WRITE (TX creation) //

  selectGuardian(guardianAddress: string): PromiEvent<TransactionReceipt> {
    return this.txsMocker.createTxOf('selectGuardian', () =>
      this.selectedGuardiansMap.set(this.txsMocker.getFromAccount(), guardianAddress),
    );
  }

  // READ //
  async getSelectedGuardianAddress(accountAddress: string): PromiEvent<string> {
    return this.selectedGuardiansMap.get(accountAddress) || null;
  }

  async getGuardiansList(offset: number, limit: number): PromiEvent<string[]> {
    return this.guardiansList;
  }

  async getGuardianInfo(guardianAddress: string): PromiEvent<IGuardianInfo> {
    return this.guardiansMap.get(guardianAddress);
  }

  // Test helpers
  withGuardian(address: string, guardian: IGuardianInfo): this {
    this.guardiansList.push(address);
    this.guardiansMap.set(address, guardian);
    return this;
  }
}
