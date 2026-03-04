'use client';

import { useState, useCallback, useEffect } from 'react';

export interface ScheduledMix {
    id: string;
    amountStrk: number;
    destination: string;
    privacyLevel: 'standard' | 'enhanced' | 'maximum';
    /** Cron-like schedule: 'once' | 'daily' | 'weekly' | 'monthly' */
    frequency: 'once' | 'daily' | 'weekly' | 'monthly';
    /** Next execution time (epoch ms) */
    nextRunAt: number;
    /** Whether this schedule is active */
    enabled: boolean;
    /** When the schedule was created */
    createdAt: number;
    /** Number of times it has executed */
    executionCount: number;
    /** When to auto-disable (0 = never) */
    maxExecutions: number;
    /** Only mix when gas is below this level (empty = always) */
    gasCondition: '' | 'low' | 'medium';
}

const STORAGE_KEY = 'umbramix:scheduled-mixes';

function loadSchedules(): ScheduledMix[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveSchedules(schedules: ScheduledMix[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

function computeNextRun(frequency: ScheduledMix['frequency'], fromDate = Date.now()): number {
    const now = new Date(fromDate);
    switch (frequency) {
        case 'daily':
            return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, now.getHours(), now.getMinutes()).getTime();
        case 'weekly':
            return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, now.getHours(), now.getMinutes()).getTime();
        case 'monthly':
            return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes()).getTime();
        case 'once':
        default:
            return fromDate;
    }
}

export function useScheduledMixes() {
    const [schedules, setSchedules] = useState<ScheduledMix[]>([]);

    useEffect(() => {
        setSchedules(loadSchedules());
    }, []);

    const persist = useCallback((updated: ScheduledMix[]) => {
        setSchedules(updated);
        saveSchedules(updated);
    }, []);

    const addSchedule = useCallback((mix: Omit<ScheduledMix, 'id' | 'createdAt' | 'executionCount'>) => {
        const newMix: ScheduledMix = {
            ...mix,
            id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
            executionCount: 0,
        };
        const updated = [...schedules, newMix];
        persist(updated);
        return newMix;
    }, [schedules, persist]);

    const removeSchedule = useCallback((id: string) => {
        persist(schedules.filter(s => s.id !== id));
    }, [schedules, persist]);

    const toggleSchedule = useCallback((id: string) => {
        persist(schedules.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
    }, [schedules, persist]);

    const markExecuted = useCallback((id: string) => {
        persist(schedules.map(s => {
            if (s.id !== id) return s;
            const newCount = s.executionCount + 1;
            const shouldDisable = s.maxExecutions > 0 && newCount >= s.maxExecutions;
            return {
                ...s,
                executionCount: newCount,
                enabled: shouldDisable ? false : s.enabled,
                nextRunAt: s.frequency !== 'once' ? computeNextRun(s.frequency) : s.nextRunAt,
            };
        }));
    }, [schedules, persist]);

    /** Get schedules that are due for execution */
    const getDueSchedules = useCallback((): ScheduledMix[] => {
        const now = Date.now();
        return schedules.filter(s => s.enabled && s.nextRunAt <= now);
    }, [schedules]);

    return {
        schedules,
        addSchedule,
        removeSchedule,
        toggleSchedule,
        markExecuted,
        getDueSchedules,
    };
}
