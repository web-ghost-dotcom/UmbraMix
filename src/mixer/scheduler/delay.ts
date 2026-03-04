import { MIX_MIN_DELAY_MS, MIX_MAX_DELAY_MS } from '@/config/constants';

export interface ScheduledTask { id: string; runAt: number; timer: NodeJS.Timeout }

export class RandomDelayScheduler {
    private tasks = new Map<string, ScheduledTask>();

    schedule(id: string, cb: () => void, min = MIX_MIN_DELAY_MS, max = MIX_MAX_DELAY_MS): void {
        const jitter = min + Math.floor(Math.random() * (max - min + 1));
        const runAt = Date.now() + jitter;
        const timer = setTimeout(() => {
            this.tasks.delete(id);
            cb();
        }, jitter);
        this.tasks.set(id, { id, runAt, timer });
    }

    cancel(id: string): void {
        const t = this.tasks.get(id);
        if (!t) return;
        clearTimeout(t.timer);
        this.tasks.delete(id);
    }
}

export const globalDelayScheduler = new RandomDelayScheduler();
