import { NextRequest, NextResponse } from 'next/server';
import { mixerEngine } from '@/mixer';
import { sessionCreateSchema } from '@/domain/schemas';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = sessionCreateSchema.parse(body);
        const res = await mixerEngine.createSession({
            currency: parsed.currency,
            targetAmounts: parsed.targetAmounts,
            destination: parsed.destination,
        });
        return NextResponse.json(res.session);
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'error';
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
