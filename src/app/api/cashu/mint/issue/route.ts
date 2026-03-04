import { NextRequest, NextResponse } from 'next/server';
import { CashuMint, CashuWallet, getEncodedTokenV4 } from '@cashu/cashu-ts';
import { ENV } from '@/config/env';

export async function POST(request: NextRequest) {
    try {
        const { quoteId, amount } = await request.json();

        if (!quoteId || !amount) {
            return NextResponse.json(
                { error: 'Missing quoteId or amount' },
                { status: 400 }
            );
        }

        // Use default mint
        const mintUrl = ENV.CASHU_DEFAULT_MINT || 'https://mint.minibits.cash/Bitcoin';
        const mint = new CashuMint(mintUrl);
        const wallet = new CashuWallet(mint);

        await wallet.loadMint();

        // Mint proofs
        const proofs = await wallet.mintProofs(amount, quoteId);

        // Encode as token
        const token = getEncodedTokenV4({
            mint: mintUrl,
            proofs
        });

        return NextResponse.json({
            token,
            amount,
            proofCount: proofs.length
        });

    } catch (error) {
        console.error('Mint issue error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to mint token' },
            { status: 500 }
        );
    }
}
