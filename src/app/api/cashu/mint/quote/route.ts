import { NextRequest, NextResponse } from 'next/server';
import { CashuMint, CashuWallet } from '@cashu/cashu-ts';
import { ENV } from '@/config/env';

export async function POST(request: NextRequest) {
    try {
        const { amount } = await request.json();

        if (!amount || amount <= 0) {
            return NextResponse.json(
                { error: 'Invalid amount' },
                { status: 400 }
            );
        }

        // Use default mint
        const mintUrl = ENV.CASHU_DEFAULT_MINT || 'https://mint.minibits.cash/Bitcoin';
        const mint = new CashuMint(mintUrl);
        const wallet = new CashuWallet(mint);

        await wallet.loadMint();

        // Create mint quote
        const mintQuote = await wallet.createMintQuote(amount);

        return NextResponse.json({
            quoteId: mintQuote.quote,
            invoice: mintQuote.request,
            amount,
            mintUrl
        });

    } catch (error) {
        console.error('Mint quote error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create mint quote' },
            { status: 500 }
        );
    }
}
