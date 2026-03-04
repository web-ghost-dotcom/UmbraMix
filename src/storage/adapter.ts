import { EcashProof, MixingSession } from '../domain';

export interface StorageAdapter {
    saveSession(session: MixingSession): Promise<void>;
    getSession(id: string): Promise<MixingSession | undefined>;
    listSessions(): Promise<MixingSession[]>;
    updateSessionPartial(id: string, patch: Partial<MixingSession>): Promise<MixingSession | undefined>;

    saveProofs(sessionId: string, proofs: EcashProof[]): Promise<void>;
    markProofsSpent(sessionId: string, secrets: string[]): Promise<void>;
}

export class InMemoryStorage implements StorageAdapter {
    private sessions = new Map<string, MixingSession>();
    private sessionProofs = new Map<string, Map<string, EcashProof>>();

    async saveSession(session: MixingSession): Promise<void> {
        this.sessions.set(session.id, { ...session, updatedAt: Date.now() });
        if (!this.sessionProofs.has(session.id)) this.sessionProofs.set(session.id, new Map());
    }

    async getSession(id: string): Promise<MixingSession | undefined> {
        const s = this.sessions.get(id);
        return s ? { ...s } : undefined;
    }

    async listSessions(): Promise<MixingSession[]> {
        return Array.from(this.sessions.values()).map((s) => ({ ...s }));
    }

    async updateSessionPartial(id: string, patch: Partial<MixingSession>): Promise<MixingSession | undefined> {
        const existing = this.sessions.get(id);
        if (!existing) return undefined;
        const updated: MixingSession = { ...existing, ...patch, updatedAt: Date.now() };
        this.sessions.set(id, updated);
        return { ...updated };
    }

    async saveProofs(sessionId: string, proofs: EcashProof[]): Promise<void> {
        const bucket = this.sessionProofs.get(sessionId) ?? new Map<string, EcashProof>();
        for (const p of proofs) bucket.set(p.secret, { ...p });
        this.sessionProofs.set(sessionId, bucket);
    }

    async markProofsSpent(sessionId: string, secrets: string[]): Promise<void> {
        const bucket = this.sessionProofs.get(sessionId);
        if (!bucket) return;
        for (const sec of secrets) {
            const p = bucket.get(sec);
            if (p) bucket.set(sec, { ...p, spent: true });
        }
    }
}
