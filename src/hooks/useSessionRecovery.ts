// Hook for detecting and recovering incomplete mixing sessions
// Prevents fund loss when browser tab closes mid-mix

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getIndexedDBStorage, IndexedDBStorage } from '@/storage/indexedDb';
import type { MixingSession } from '@/domain';

export interface RecoverableSession {
    id: string;
    state: string;
    createdAt: number;
    updatedAt: number;
    depositCount: number;
    outputCount: number;
}

export function useSessionRecovery() {
    const [incompleteSessions, setIncompleteSessions] = useState<RecoverableSession[]>([]);
    const [isChecking, setIsChecking] = useState(true);
    const [storage, setStorage] = useState<IndexedDBStorage | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const db = getIndexedDBStorage();
        setStorage(db);

        (async () => {
            try {
                const sessions = await db.getIncompleteSessions();
                setIncompleteSessions(sessions.map(toRecoverable));
            } catch (err) {
                console.error('[SessionRecovery] Failed to check for incomplete sessions:', err);
            } finally {
                setIsChecking(false);
            }
        })();
    }, []);

    const dismissSession = useCallback(async (sessionId: string) => {
        if (!storage) return;
        await storage.updateSessionPartial(sessionId, { state: 'CANCELLED' as any });
        setIncompleteSessions(prev => prev.filter(s => s.id !== sessionId));
    }, [storage]);

    const dismissAll = useCallback(async () => {
        if (!storage) return;
        for (const s of incompleteSessions) {
            await storage.updateSessionPartial(s.id, { state: 'CANCELLED' as any });
        }
        setIncompleteSessions([]);
    }, [storage, incompleteSessions]);

    return {
        incompleteSessions,
        isChecking,
        hasIncomplete: incompleteSessions.length > 0,
        dismissSession,
        dismissAll,
    };
}

function toRecoverable(s: MixingSession): RecoverableSession {
    return {
        id: s.id,
        state: s.state,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        depositCount: s.deposits.length,
        outputCount: s.outputs.length,
    };
}
