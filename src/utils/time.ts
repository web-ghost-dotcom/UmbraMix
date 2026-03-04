export function now(): number { return Date.now(); }
export function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

// Lightweight rate helpers colocated for now (could move to dedicated pricing module)
import { ENV } from '@/config/env';

export function estimateSatsFromStrk(strkAmount: number, rateOverride?: number): number {
    const rate = rateOverride || ENV.STRK_SATS_RATE || 125;
    if (strkAmount <= 0) return 0;
    return Math.max(1, Math.floor(strkAmount * rate));
}

export function estimateStrkFromSats(sats: number, rateOverride?: number): number {
    const rate = rateOverride || ENV.STRK_SATS_RATE || 125;
    if (sats <= 0) return 0;
    return sats / rate;
}
