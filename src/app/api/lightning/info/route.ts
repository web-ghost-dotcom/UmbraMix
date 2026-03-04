import { NextResponse } from 'next/server';

// GET /api/lightning/info
export async function GET() {
    try {
        const nodeEndpoint = process.env.LND_URL || '';
        const macaroon = process.env.LND_MACAROON || '';
        if (!nodeEndpoint || !macaroon) {
            return NextResponse.json({ configured: false, error: 'Lightning node not configured server-side' }, { status: 200 });
        }

        const headers: Record<string, string> = {
            'Grpc-Metadata-macaroon': macaroon
        };

        const res = await fetch(`${nodeEndpoint}/v1/getinfo`, { headers });
        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json({ configured: true, reachable: false, status: res.status, detail: text }, { status: 200 });
        }
        const data = await res.json();
        return NextResponse.json({ configured: true, reachable: true, pubkey: data.identity_pubkey, alias: data.alias, version: data.version });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
