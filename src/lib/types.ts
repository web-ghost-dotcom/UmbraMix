export type MixingStep = 'setup' | 'deposit' | 'mixing' | 'complete';

export type PrivacyLevel = 'standard' | 'enhanced' | 'maximum';

export interface PrivacyConfig {
    name: string;
    description: string;
    minParticipants: number;
    estimatedTime: number; // minutes
    feeBps: number; // basis points e.g. 20 = 0.2%
}

export interface MixRequest {
    amountStrk: number;
    destinations: string[]; // destination STRK addresses
    privacyLevel: PrivacyLevel;
    // Day 6 options
    enableTimeDelays: boolean;
    enableSplitOutputs: boolean;
    splitCount: number; // number of outputs
    enableRandomizedMints: boolean;
    enableAmountObfuscation: boolean;
    enableDecoyTx: boolean;
}

export type OrchestratorEventType =
    | 'wallet:connected'
    | 'deposit:initiated'
    | 'deposit:wallet_connected'
    | 'deposit:balance_checked'
    | 'deposit:preparing_transfer'
    | 'deposit:transfer_submitted'
    | 'deposit:confirmed'
    | 'deposit:preparing_withdrawal'
    | 'deposit:withdrawn_for_mixing'
    | 'deposit:error'
    | 'lightning:invoice_created'
    | 'lightning:paid'
    | 'cashu:minted'
    | 'cashu:routed'
    | 'cashu:redeemed'
    | 'mix:progress'
    | 'mix:complete'
    | 'mix:partial'
    | 'mix:failed'
    | 'mix:error'
    | 'issue:progress'
    | 'issue:deposit_done'
    | 'issue:complete'
    | 'issue:error'
    | 'redeem:validating'
    | 'redeem:creating_swap'
    | 'redeem:melting'
    | 'redeem:claiming'
    | 'redeem:forwarding'
    | 'redeem:complete'
    | 'redeem:error';

export interface OrchestratorEvent {
    type: OrchestratorEventType;
    message?: string;
    progress?: number; // 0-100
    anonymitySetSize?: number;
    estimatedTime?: number; // minutes
    privacyScore?: number; // 0-100
    details?: Record<string, unknown>;
}

export interface TransactionItem {
    id: string;
    type: 'deposit' | 'mix' | 'withdraw';
    amount: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    timestamp: number;
    privacyScore: number;
    fromNetwork: string;
    toNetwork: string;
    anonymitySetSize?: number;
}
