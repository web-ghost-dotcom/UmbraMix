import { NextRequest, NextResponse } from 'next/server';
import { depositSchema } from '@/domain/schemas';
import { mixerEngine } from '@/mixer';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = depositSchema.parse(body);
        const session = await mixerEngine.deposit(parsed.sessionId, parsed.proofs.map(p => ({
            ...p,
            amount: BigInt(p.amount as unknown as string) // schema already BigInt, but TS appeasement
        })));
        return NextResponse.json(session);
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'error';
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
