import { InMemoryStorage, StorageAdapter } from '../storage/adapter';
import { EventBus, globalEventBus } from '../events/bus';
import { EcashProof, MixingSession, SessionCreationRequest, SessionCreationResponse } from '../domain';
import { assertState } from '../domain/status';
import { randomHex } from '../crypto/bdhke';
import { defaultSplitStrategy } from './strategy/split';
import { globalDelayScheduler } from './scheduler/delay';
import { SPLIT_MAX_PARTS, SPLIT_MIN_DENOM } from '@/config/constants';

export interface MixerEngineOptions {
    storage?: StorageAdapter;
    bus?: EventBus;
}

export class MixerEngine {
    private storage: StorageAdapter;
    private bus: EventBus;

    constructor(opts: MixerEngineOptions = {}) {
        this.storage = opts.storage ?? new InMemoryStorage();
        this.bus = opts.bus ?? globalEventBus;
    }

    async createSession(req: SessionCreationRequest): Promise<SessionCreationResponse> {
        const id = randomHex(12);
        const session: MixingSession = {
            id,
            state: 'AWAITING_DEPOSIT',
            deposits: [],
            outputs: [],
            targetAmounts: req.targetAmounts,
            currency: req.currency,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            entropySeed: randomHex(16)
            // IMPORTANT: do not persist any recipient/withdrawal address
        } as MixingSession;
        await this.storage.saveSession(session);
        this.bus.emit({ id: randomHex(8), type: 'session.created', at: Date.now(), payload: { session } });
        return { session };
    }

    async deposit(sessionId: string, proofs: EcashProof[]): Promise<MixingSession> {
        const session = await this.storage.getSession(sessionId);
        if (!session) throw new Error('Session not found');
        assertState(session, ['AWAITING_DEPOSIT', 'DEPOSITED']);
        session.deposits.push(...proofs);
        session.state = 'DEPOSITED';
        session.updatedAt = Date.now();
        await this.storage.saveSession(session);
        this.bus.emit({ id: randomHex(8), type: 'deposit.received', at: Date.now(), payload: { sessionId, proofs } });

        // Schedule mixing with randomized delay & splitting
        const split = defaultSplitStrategy.split(session.deposits, { maxParts: SPLIT_MAX_PARTS, minAmount: SPLIT_MIN_DENOM });
        // Replace deposits with split set (simple approach for demonstration)
        session.deposits = split.outputs;
        await this.storage.saveSession(session);
        const scheduledId = 'mix_' + session.id;
        globalDelayScheduler.schedule(scheduledId, () => { void this.startMixing(session.id); });
        return session;
    }

    async startMixing(sessionId: string): Promise<MixingSession> {
        const session = await this.storage.getSession(sessionId);
        if (!session) throw new Error('Session not found');
        assertState(session, ['DEPOSITED']);
        session.state = 'MIXING';
        await this.storage.saveSession(session);
        this.bus.emit({ id: randomHex(8), type: 'mixing.started', at: Date.now(), payload: { sessionId } });

        // Placeholder mixing algorithm: clone deposits to outputs (would reissue with new blinds)
        session.outputs = session.deposits.map((p) => ({ ...p, secret: p.secret + '_mix' }));
        session.state = 'READY';
        session.updatedAt = Date.now();
        await this.storage.saveSession(session);
        this.bus.emit({ id: randomHex(8), type: 'mixing.completed', at: Date.now(), payload: { sessionId, outputs: session.outputs } });
        return session;
    }

    // Withdraw without persisting or emitting the recipient address
    async withdraw(sessionId: string, _destination: string): Promise<MixingSession> {
        const session = await this.storage.getSession(sessionId);
        if (!session) throw new Error('Session not found');
        assertState(session, ['READY']);
        session.state = 'WITHDRAWING';
        await this.storage.saveSession(session);
        // For privacy: do not emit destination address in events
        this.bus.emit({ id: randomHex(8), type: 'withdraw.initiated', at: Date.now(), payload: { sessionId, destination: 'redacted' } });

        // Placeholder: instantly complete
        session.state = 'COMPLETED';
        session.updatedAt = Date.now();
        await this.storage.saveSession(session);
        this.bus.emit({ id: randomHex(8), type: 'withdraw.completed', at: Date.now(), payload: { sessionId, destination: 'redacted' } });
        return session;
    }

    // Controlled read access
    async getSession(id: string): Promise<MixingSession | undefined> {
        return this.storage.getSession(id);
    }
}

export const mixerEngine = new MixerEngine();
