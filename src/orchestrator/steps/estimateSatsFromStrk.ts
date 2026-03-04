import { OrchestratorEvent } from '@/lib/types';
import { estimateSatsFromStrk } from '@/utils/time';
import { ENV } from '@/config/env';

/**
 * Derive Lightning sats target from known STRK input amount (user provided) using
 * an environment override rate (NEXT_PUBLIC_STRK_SATS_RATE) or default fallback.
 */
export async function stepEstimateSatsFromStrk(
    amountStrk: number,
    onEvent: (e: OrchestratorEvent) => void
) {
    const rate = ENV.STRK_SATS_RATE || 700;
    const sats = estimateSatsFromStrk(amountStrk, rate);

    console.log('🧮 UmbraMix Estimate: Converting STRK -> sats (pre-invoice)', { amountStrk, rate, sats });
    onEvent({ type: 'mix:progress', message: `Estimating sats for ${amountStrk} STRK...`, progress: 12 });

    return { amountStrk, sats, rate };
}
