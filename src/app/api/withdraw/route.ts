import { NextRequest, NextResponse } from 'next/server';
import { withdrawSchema } from '@/domain/schemas';
import { mixerEngine } from '@/mixer';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = withdrawSchema.parse(body);
        const session = await mixerEngine.withdraw(parsed.sessionId, parsed.destination);
        return NextResponse.json(session);
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'error';
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
