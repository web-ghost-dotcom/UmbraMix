import { NextRequest, NextResponse } from 'next/server';
import { CashuMint, CashuWallet, MintQuoteState } from '@cashu/cashu-ts';
import { ENV } from '@/config/env';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const quoteId = searchParams.get('quoteId');

        if (!quoteId) {
            return NextResponse.json(
                { error: 'Missing quoteId' },
                { status: 400 }
            );
        }

        // Use default mint
        const mintUrl = ENV.CASHU_DEFAULT_MINT || 'https://mint.minibits.cash/Bitcoin';
        const mint = new CashuMint(mintUrl);
        const wallet = new CashuWallet(mint);

        await wallet.loadMint();

        // Check quote status
        const quoteStatus = await wallet.checkMintQuote(quoteId);

        return NextResponse.json({
            quoteId,
            state: quoteStatus.state,
            paid: quoteStatus.state === MintQuoteState.PAID || quoteStatus.state === MintQuoteState.ISSUED
        });

    } catch (error) {
        console.error('Mint status error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to check mint status' },
            { status: 500 }
        );
    }
}
