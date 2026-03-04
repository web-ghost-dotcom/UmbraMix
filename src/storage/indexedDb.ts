// IndexedDB-backed persistent storage adapter for mixing sessions
// Prevents fund loss when user refreshes or closes the tab mid-mix

import { EcashProof, MixingSession } from '../domain';
import { StorageAdapter } from './adapter';

const DB_NAME = 'umbramix-db';
const DB_VERSION = 1;
const SESSION_STORE = 'sessions';
const PROOFS_STORE = 'proofs';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(SESSION_STORE)) {
                db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(PROOFS_STORE)) {
                db.createObjectStore(PROOFS_STORE, { keyPath: 'sessionId' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function txPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export class IndexedDBStorage implements StorageAdapter {
    private dbPromise: Promise<IDBDatabase>;

    constructor() {
        this.dbPromise = openDB();
    }

    async saveSession(session: MixingSession): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(SESSION_STORE, 'readwrite');
        const store = tx.objectStore(SESSION_STORE);
        // Serialize bigints to strings for storage
        const serialized = serializeSession(session);
        await txPromise(store.put(serialized));
    }

    async getSession(id: string): Promise<MixingSession | undefined> {
        const db = await this.dbPromise;
        const tx = db.transaction(SESSION_STORE, 'readonly');
        const store = tx.objectStore(SESSION_STORE);
        const raw = await txPromise(store.get(id));
        return raw ? deserializeSession(raw) : undefined;
    }

    async listSessions(): Promise<MixingSession[]> {
        const db = await this.dbPromise;
        const tx = db.transaction(SESSION_STORE, 'readonly');
        const store = tx.objectStore(SESSION_STORE);
        const all = await txPromise(store.getAll());
        return all.map(deserializeSession);
    }

    async updateSessionPartial(id: string, patch: Partial<MixingSession>): Promise<MixingSession | undefined> {
        const existing = await this.getSession(id);
        if (!existing) return undefined;
        const updated: MixingSession = { ...existing, ...patch, updatedAt: Date.now() };
        await this.saveSession(updated);
        return { ...updated };
    }

    async saveProofs(sessionId: string, proofs: EcashProof[]): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(PROOFS_STORE, 'readwrite');
        const store = tx.objectStore(PROOFS_STORE);
        const existing = await txPromise(store.get(sessionId));
        const currentProofs: EcashProof[] = existing?.proofs ?? [];
        const merged = [...currentProofs];
        for (const p of proofs) {
            const idx = merged.findIndex(e => e.secret === p.secret);
            if (idx >= 0) {
                merged[idx] = serializeProof(p);
            } else {
                merged.push(serializeProof(p));
            }
        }
        await txPromise(store.put({ sessionId, proofs: merged }));
    }

    async markProofsSpent(sessionId: string, secrets: string[]): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(PROOFS_STORE, 'readwrite');
        const store = tx.objectStore(PROOFS_STORE);
        const existing = await txPromise(store.get(sessionId));
        if (!existing) return;
        const proofs: any[] = existing.proofs ?? [];
        for (const sec of secrets) {
            const p = proofs.find((pr: any) => pr.secret === sec);
            if (p) p.spent = true;
        }
        await txPromise(store.put({ sessionId, proofs }));
    }

    /** Remove completed sessions older than maxAge (ms). Default: 24 hours */
    async pruneOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
        const sessions = await this.listSessions();
        const cutoff = Date.now() - maxAgeMs;
        let pruned = 0;
        const db = await this.dbPromise;
        for (const s of sessions) {
            if ((s.state === 'COMPLETED' || s.state === 'CANCELLED') && s.updatedAt < cutoff) {
                const tx = db.transaction(SESSION_STORE, 'readwrite');
                await txPromise(tx.objectStore(SESSION_STORE).delete(s.id));
                pruned++;
            }
        }
        return pruned;
    }

    /** Get incomplete sessions for recovery UI */
    async getIncompleteSessions(): Promise<MixingSession[]> {
        const all = await this.listSessions();
        return all.filter(s =>
            s.state !== 'COMPLETED' &&
            s.state !== 'CANCELLED' &&
            s.state !== 'FAILED'
        );
    }
}

// Serialization helpers for BigInt <-> string
function serializeSession(session: MixingSession): any {
    return {
        ...session,
        targetAmounts: session.targetAmounts.map(a => String(a)),
        deposits: session.deposits.map(serializeProof),
        outputs: session.outputs.map(serializeProof),
    };
}

function deserializeSession(raw: any): MixingSession {
    return {
        ...raw,
        targetAmounts: (raw.targetAmounts || []).map((a: string) => BigInt(a)),
        deposits: (raw.deposits || []).map(deserializeProof),
        outputs: (raw.outputs || []).map(deserializeProof),
    };
}

function serializeProof(proof: EcashProof): any {
    return { ...proof, amount: String(proof.amount) };
}

function deserializeProof(raw: any): EcashProof {
    return { ...raw, amount: BigInt(raw.amount) };
}

// Singleton for client-side usage
let _instance: IndexedDBStorage | null = null;
export function getIndexedDBStorage(): IndexedDBStorage {
    if (!_instance) {
        _instance = new IndexedDBStorage();
    }
    return _instance;
}
