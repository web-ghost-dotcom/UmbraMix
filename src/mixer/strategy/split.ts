import { EcashProof } from '@/domain/types';

export interface SplitStrategyOptions {
    maxParts: number; // maximum number of parts per input proof
    minAmount: bigint; // minimum denomination
}

export interface SplitResult { outputs: EcashProof[] }

export interface SplitStrategy {
    split(proofs: EcashProof[], opts: SplitStrategyOptions): SplitResult;
}

export class EvenSplitStrategy implements SplitStrategy {
    split(proofs: EcashProof[], opts: SplitStrategyOptions): SplitResult {
        const outputs: EcashProof[] = [];
        for (const p of proofs) {
            // Determine number of parts (bounded by maxParts and amount/minAmount)
            const theoretical = Number(p.amount / opts.minAmount);
            const parts = Math.min(Math.max(1, theoretical), opts.maxParts);
            if (parts === 1) { outputs.push(p); continue; }
            const base = p.amount / BigInt(parts);
            let remainder = p.amount - base * BigInt(parts);
            for (let i = 0; i < parts; i++) {
                let amt = base;
                if (remainder > 0n) { amt += 1n; remainder -= 1n; }
                outputs.push({ ...p, amount: amt, secret: p.secret + '_s' + i });
            }
        }
        return { outputs };
    }
}

export const defaultSplitStrategy = new EvenSplitStrategy();
