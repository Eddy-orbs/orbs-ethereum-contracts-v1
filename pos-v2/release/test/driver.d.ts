import BN from "bn.js";
export declare const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
import { SubscriptionsContract } from "../typings/subscriptions-contract";
import { ElectionsContract } from "../typings/elections-contract";
import { ERC20Contract } from "../typings/erc20-contract";
import { StakingContract } from "../typings/staking-contract";
import { RewardsContract } from "../typings/rewards-contract";
import { MonthlySubscriptionPlanContract } from "../typings/monthly-subscription-plan-contract";
import { ContractRegistryContract } from "../typings/contract-registry-contract";
export declare const DEFAULT_MINIMUM_STAKE = 100;
export declare const DEFAULT_COMMITTEE_SIZE = 2;
export declare const DEFAULT_TOPOLOGY_SIZE = 3;
export declare const DEFAULT_MAX_DELEGATION_RATIO = 10;
export declare const DEFAULT_VOTE_OUT_THRESHOLD = 80;
export declare const DEFAULT_BANNING_THRESHOLD = 80;
export declare const DEFAULT_VOTE_OUT_TIMEOUT: number;
export declare const BANNING_LOCK_TIMEOUT: number;
export declare class Driver {
    accounts: string[];
    elections: ElectionsContract;
    erc20: ERC20Contract;
    externalToken: ERC20Contract;
    staking: StakingContract;
    subscriptions: SubscriptionsContract;
    rewards: RewardsContract;
    contractRegistry: ContractRegistryContract;
    private participants;
    constructor(accounts: string[], elections: ElectionsContract, erc20: ERC20Contract, externalToken: ERC20Contract, staking: StakingContract, subscriptions: SubscriptionsContract, rewards: RewardsContract, contractRegistry: ContractRegistryContract);
    static new(maxCommitteeSize?: number, maxTopologySize?: number, minimumStake?: number | BN, maxDelegationRatio?: number, voteOutThreshold?: number, voteOutTimeout?: number, banningThreshold?: number): Promise<Driver>;
    static newContractRegistry(governorAddr: string): Promise<ContractRegistryContract>;
    static newStakingContract(electionsAddr: string, erc20Addr: string): Promise<StakingContract>;
    get contractsOwner(): string;
    get contractsNonOwner(): string;
    get rewardsGovernor(): Participant;
    newSubscriber(tier: string, monthlyRate: number | BN): Promise<MonthlySubscriptionPlanContract>;
    newParticipant(): Participant;
    delegateMoreStake(amount: number | BN, delegatee: Participant): Promise<import("web3-core").TransactionReceipt>;
}
export declare class Participant {
    address: string;
    orbsAddress: string;
    ip: string;
    private erc20;
    private externalToken;
    private staking;
    private elections;
    constructor(address: string, orbsAddress: string, driver: Driver);
    stake(amount: number | BN, staking?: StakingContract): Promise<import("web3-core").TransactionReceipt>;
    private assignAndApprove;
    assignAndApproveOrbs(amount: number | BN, to: string): Promise<void>;
    assignAndApproveExternalToken(amount: number | BN, to: string): Promise<void>;
    unstake(amount: number | BN): Promise<import("web3-core").TransactionReceipt>;
    delegate(to: Participant): Promise<import("web3-core").TransactionReceipt>;
    registerAsValidator(): Promise<import("web3-core").TransactionReceipt>;
    notifyReadyForCommittee(): Promise<import("web3-core").TransactionReceipt>;
}
export declare function expectRejected(promise: Promise<any>, msg?: string): Promise<void>;
//# sourceMappingURL=driver.d.ts.map