import { OrchestratorEvent } from '@/lib/types';
import { RealAtomiqSwapClient } from '@/integrations/swaps/atomiq';
import { ENV } from '@/config/env';

export async function stepDynamicEstimateSats(
    amountStrk: number,
    onEvent: (e: OrchestratorEvent) => void
) {
    onEvent({ type: 'mix:progress', message: 'Fetching real-time STRK→sats estimate...', progress: 11 });
    const client = new RealAtomiqSwapClient(ENV.NETWORK);
    try {
        const estimate = await client.estimateLightningSatsFromStrk(amountStrk);
        console.log('🧮 UmbraMix DynamicEstimate: Result', estimate);
        return estimate; // { satsOut, rate, source, quote? }
    } catch (e) {
        console.warn('⚠️ UmbraMix DynamicEstimate: Falling back after failure:', e);
        const fallback = Math.floor(amountStrk * (ENV.STRK_SATS_RATE || 700));
        return { satsOut: fallback, rate: fallback / amountStrk, source: 'fallback' as const };
    }
}
