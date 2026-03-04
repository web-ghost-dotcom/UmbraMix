// Core domain type definitions for UmbraMix
// Keep each interface focused and cohesive.

export type Currency = 'SAT' | 'WEI' | 'STRK';

export interface NoteCommitment {
    id: string; // unique commitment id
    amount: bigint;
    currency: Currency;
    createdAt: number;
}

export interface BlindSignatureRequest {
    secret: string; // user supplied random secret (x)
    blindingFactor: string; // r
    blindedMessage: string; // T (B_)
    amount: bigint;
    currency: Currency;
}

export interface BlindSignaturePromise {
    requestId: string;
    blindedSignature: string; // C_
    keysetId: string;
    mintedAt: number;
}

export interface EcashProof {
    secret: string; // x
    signature: string; // C
    amount: bigint;
    currency: Currency;
    keysetId: string;
    spent?: boolean;
}

export interface MixingSession {
    id: string;
    state: SessionState;
    deposits: EcashProof[]; // incoming proofs provided by user
    outputs: EcashProof[]; // reissued / mixed outputs
    targetAmounts: bigint[]; // normalized denominational breakdown
    currency: Currency;
    createdAt: number;
    updatedAt: number;
    entropySeed: string; // internal randomness seed for scheduling
    withdrawalAddress?: string; // user destination (lightning invoice, starknet addr, etc.)
}

// Extended pipeline (STRK -> LN BTC -> Cashu -> mix -> STRK) high-level transfer
export type PipelineState =
    | 'PIPELINE_CREATED'
    | 'SWAP_OUT_STRK_PENDING'
    | 'SWAP_OUT_STRK_COMPLETED'
    | 'LN_DEPOSIT_PENDING'
    | 'LN_DEPOSIT_SETTLED'
    | 'ECASH_MINTED'
    | 'MIXING'
    | 'REISSUED'
    | 'SWAP_BACK_PENDING'
    | 'SWAP_BACK_COMPLETED'
    | 'PIPELINE_COMPLETED'
    | 'PIPELINE_FAILED';

export interface PipelineTransfer {
    id: string;
    from: string; // sender starknet address
    to: string;   // recipient starknet address
    amountStrk: bigint; // raw STRK amount
    createdAt: number;
    updatedAt: number;
    state: PipelineState;
    sessionId?: string; // associated mixing session id
    intermediateBtcMsat?: bigint; // amount after swap (msat)
    lnInvoice?: string;
    ecashProofs?: EcashProof[];
    mixedProofs?: EcashProof[];
    swapOutTxId?: string;
    swapBackTxId?: string;
    error?: string;
}

export type SessionState =
    | 'CREATED'
    | 'AWAITING_DEPOSIT'
    | 'DEPOSITED'
    | 'MIXING'
    | 'READY'
    | 'WITHDRAWING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'FAILED';

export interface DepositRequest {
    sessionId: string;
    proofs: EcashProof[];
}

export interface WithdrawRequest {
    sessionId: string;
    destination: string; // lightning invoice / starknet address / cashu token return
    amount?: bigint; // optional subset withdraw
}

export interface SessionCreationRequest {
    currency: Currency;
    targetAmounts: bigint[];
    destination?: string;
}

export interface SessionCreationResponse {
    session: MixingSession;
}

export interface MixerStats {
    totalSessions: number;
    activeSessions: number;
    totalVolume: bigint;
}
