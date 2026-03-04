// Event domain types
import { EcashProof, MixingSession, PipelineTransfer } from './types';

export type MixerEventType =
    | 'session.created'
    | 'session.updated'
    | 'session.state_changed'
    | 'session.completed'
    | 'deposit.received'
    | 'mixing.started'
    | 'mixing.completed'
    | 'withdraw.initiated'
    | 'withdraw.completed'
    | 'pipeline.created'
    | 'pipeline.updated'
    | 'pipeline.state_changed'
    | 'pipeline.completed'
    | 'pipeline.failed'
    | 'error';

export interface MixerBaseEvent<T extends MixerEventType = MixerEventType, P = unknown> {
    id: string;
    type: T;
    payload: P;
    at: number;
    sessionId?: string;
}

export type SessionCreatedEvent = MixerBaseEvent<'session.created', { session: MixingSession }>;
export type DepositReceivedEvent = MixerBaseEvent<'deposit.received', { sessionId: string; proofs: EcashProof[] }>;

export type MixerEvent =
    | SessionCreatedEvent
    | DepositReceivedEvent
    | MixerBaseEvent<'session.updated', { session: MixingSession }>
    | MixerBaseEvent<'session.state_changed', { sessionId: string; from: string; to: string }>
    | MixerBaseEvent<'session.completed', { sessionId: string }>
    | MixerBaseEvent<'mixing.started', { sessionId: string }>
    | MixerBaseEvent<'mixing.completed', { sessionId: string; outputs: EcashProof[] }>
    | MixerBaseEvent<'withdraw.initiated', { sessionId: string; destination: string }>
    | MixerBaseEvent<'withdraw.completed', { sessionId: string; destination: string; proofs?: EcashProof[] }>
    | MixerBaseEvent<'pipeline.created', { transfer: PipelineTransfer }>
    | MixerBaseEvent<'pipeline.updated', { transfer: PipelineTransfer }>
    | MixerBaseEvent<'pipeline.state_changed', { id: string; from: string; to: string }>
    | MixerBaseEvent<'pipeline.completed', { id: string }>
    | MixerBaseEvent<'pipeline.failed', { id: string; error: string }>
    | MixerBaseEvent<'error', { sessionId?: string; message: string; cause?: unknown }>;
