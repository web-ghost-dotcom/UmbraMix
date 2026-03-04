import { NextRequest, NextResponse } from 'next/server';
import { pipelineOrchestrator } from '@/mixer/pipeline';
import { z } from 'zod';

const schema = z.object({
    from: z.string(),
    to: z.string(),
    amountStrk: z.string().transform(v => BigInt(v)),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = schema.parse(body);
        const transfer = await pipelineOrchestrator.initiate(parsed.from, parsed.to, parsed.amountStrk);
        return NextResponse.json(transfer);
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'error';
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
