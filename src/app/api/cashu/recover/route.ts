import { NextRequest, NextResponse } from 'next/server';
import TokenVault from '@/storage/tokenVault.server';
import { RealCashuClient } from '@/integrations/cashu/client';
import { ENV } from '@/config/env';

// GET /api/cashu/recover?quote=...&mint=...
// Returns { token, quote, amountSats, createdAt } if found or recovered
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const quote = searchParams.get('quote');
        const forcedMint = searchParams.get('mint') || undefined;

        if (!quote) {
            return NextResponse.json({ error: 'Missing quote parameter' }, { status: 400 });
        }

        // 1) Return from vault if present
        const existing = await TokenVault.get(quote);
        if (existing) {
            return NextResponse.json({
                ok: true,
                source: 'vault',
                quote: existing.quote,
                token: existing.token,
                amountSats: existing.amountSats,
                mint: existing.mintUrl,
                createdAt: existing.createdAt
            });
        }

        // 2) Attempt to recover by checking the mint directly
        const mintUrl = forcedMint || ENV.CASHU_DEFAULT_MINT;
        const cashu = new RealCashuClient(mintUrl);

        // We need to check if quote exists and is PAID; if so, mint proofs again
        const status = await cashu.checkMintQuote(quote);
        if (status.state !== 'PAID') {
            return NextResponse.json({
                ok: false,
                error: `Quote not in PAID state (state=${status.state}). If you already paid, retry shortly.`
            }, { status: 409 });
        }

        // Try to mint; if it succeeds, persist and return
        const amount = Number(status.amount || 0n);
        const proofs = await cashu.mintProofs(BigInt(amount), quote);
        const token = cashu.createToken(proofs);

        await TokenVault.set({
            quote,
            token,
            mintUrl,
            amountSats: proofs.reduce((s, p) => s + Number(p.amount), 0),
            proofsCount: proofs.length,
            createdAt: Date.now()
        });

        return NextResponse.json({
            ok: true,
            source: 'mint',
            quote,
            token,
            amountSats: amount,
            mint: mintUrl
        });

    } catch (e: any) {
        const msg = e?.message || 'Unknown error';
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
