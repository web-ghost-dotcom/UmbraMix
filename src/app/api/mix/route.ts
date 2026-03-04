import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { startMix } from '@/orchestrator';
import { OrchestratorEvent } from '@/lib/types';

const MixSchema = z.object({
    amountStrk: z.number().positive(),
    destinations: z.array(z.string()).default([]),
    privacyLevel: z.enum(['standard', 'enhanced', 'maximum']).default('standard'),
    enableTimeDelays: z.boolean().default(true),
    enableSplitOutputs: z.boolean().default(true),
    splitCount: z.number().int().min(1).max(8).default(2),
    enableRandomizedMints: z.boolean().default(true),
    enableAmountObfuscation: z.boolean().default(true),
    enableDecoyTx: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = MixSchema.parse(body);

        const events: OrchestratorEvent[] = [];
        await startMix(parsed, (e) => events.push(e));

        return NextResponse.json({ ok: true, events });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 400 });
    }
}
