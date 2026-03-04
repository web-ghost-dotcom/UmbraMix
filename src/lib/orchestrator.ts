import { MixRequest, OrchestratorEvent } from './types';
import { startMix, MixOptions } from '@/orchestrator';

export async function runMix(req: MixRequest, onEvent: (e: OrchestratorEvent) => void, options?: MixOptions) {
    try {
        await startMix(req, onEvent, options);
    } catch (e: any) {
        onEvent({ type: 'mix:error', message: e?.message || 'Unknown error' });
        throw e;
    }
}
