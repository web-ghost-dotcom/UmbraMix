import { NextResponse } from 'next/server';

// POST /api/lightning/pay
// Body: { invoice: string, timeoutSeconds?: number }
export async function POST(req: Request) {
    try {
        const { invoice, timeoutSeconds = 60 } = await req.json();
        if (!invoice) return NextResponse.json({ error: 'invoice required' }, { status: 400 });

        const nodeEndpoint = process.env.LND_URL || '';
        const macaroon = process.env.LND_MACAROON || '';
        if (!nodeEndpoint || !macaroon) {
            return NextResponse.json({ error: 'Lightning node not configured server-side' }, { status: 500 });
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Grpc-Metadata-macaroon': macaroon
        };

        const res = await fetch(`${nodeEndpoint}/v1/channels/transactions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ payment_request: invoice, timeout_seconds: timeoutSeconds })
        });

        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json({ error: 'LND payment error', status: res.status, detail: text }, { status: 502 });
        }

        const data = await res.json();
        return NextResponse.json({
            paymentHash: data.payment_hash,
            paymentPreimage: data.payment_preimage,
            paymentError: data.payment_error || null,
            status: data.payment_error ? 'FAILED' : 'SUCCEEDED'
        });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
