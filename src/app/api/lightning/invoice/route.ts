import { NextResponse } from 'next/server';

// POST /api/lightning/invoice
// Body: { amountMsat: number, memo?: string, expiry?: number }
export async function POST(req: Request) {
    try {
        const { amountMsat, memo = '', expiry = 3600 } = await req.json();
        if (!amountMsat || amountMsat <= 0) {
            return NextResponse.json({ error: 'amountMsat required' }, { status: 400 });
        }

        const nodeEndpoint = process.env.LND_URL || '';
        const macaroon = process.env.LND_MACAROON || '';
        const tls = process.env.LND_TLS || '';

        if (!nodeEndpoint || !macaroon) {
            return NextResponse.json({ error: 'Lightning node not configured server-side' }, { status: 500 });
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Grpc-Metadata-macaroon': macaroon
        };

        const res = await fetch(`${nodeEndpoint}/v1/invoices`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ value_msat: String(amountMsat), memo, expiry: String(expiry) })
        });

        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json({ error: 'LND error', status: res.status, detail: text }, { status: 502 });
        }

        const data = await res.json();
        return NextResponse.json({
            invoice: data.payment_request,
            paymentHash: data.r_hash || data.r_hash_str,
            expiry: Date.now() + expiry * 1000
        });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
