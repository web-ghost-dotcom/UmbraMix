import { NextRequest, NextResponse } from 'next/server';
import { mixerEngine } from '@/mixer';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const session = await mixerEngine.getSession(id);
    if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(session);
}
