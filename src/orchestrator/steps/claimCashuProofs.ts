import { OrchestratorEvent } from '@/lib/types';
import { RealCashuClient } from '@/integrations/cashu/client';
const isServer = typeof window === 'undefined';
import { getDecodedToken } from '@cashu/cashu-ts';

export async function stepClaimCashuProofs(
    mintQuote: any,
    cashu: RealCashuClient,
    targetSats: number,
    onEvent: (e: OrchestratorEvent) => void
) {
    console.log('🪙 UmbraMix ClaimCashu: Starting Cashu proof claiming');
    console.log('🪙 UmbraMix ClaimCashu: Parameters:', {
        quoteId: mintQuote.quote,
        amount: targetSats,
        expectedState: 'PAID'
    });

    try {
        onEvent({
            type: 'mix:progress',
            message: `Claiming Cashu proofs for ${targetSats} sats...`,
            progress: 45
        });

        // Check if the Lightning invoice has been paid by Atomiq
        console.log('🔍 UmbraMix ClaimCashu: Checking if mint quote was paid...');
        const quoteStatus = await cashu.checkMintQuote(mintQuote.quote);

        console.log('🔍 UmbraMix ClaimCashu: Quote status:', {
            quote: quoteStatus.quote,
            state: quoteStatus.state,
            amount: quoteStatus.amount.toString()
        });

        if (quoteStatus.state !== 'PAID') {
            // Wait a bit and check again
            console.log('⏳ UmbraMix ClaimCashu: Payment not confirmed yet, waiting...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            const retryStatus = await cashu.checkMintQuote(mintQuote.quote);
            console.log('🔍 UmbraMix ClaimCashu: Retry status:', retryStatus.state);

            if (retryStatus.state !== 'PAID') {
                throw new Error(`Lightning payment not confirmed. Quote state: ${retryStatus.state}`);
            }
        }

        console.log('✅ UmbraMix ClaimCashu: Lightning payment confirmed by Cashu mint');

        // Mint the proofs now that payment is confirmed
        console.log('🏭 UmbraMix ClaimCashu: Minting Cashu proofs...');
        const proofs = await cashu.mintProofs(BigInt(targetSats), mintQuote.quote);

        console.log('🏭 UmbraMix ClaimCashu: Cashu proofs minted:', {
            count: proofs.length,
            totalAmount: proofs.reduce((sum, p) => sum + Number(p.amount), 0),
            proofs: proofs.map(p => ({
                amount: Number(p.amount),
                secret: p.secret?.slice(0, 10) + '...'
            }))
        });

        // Create a token so user can save/redeem later
        try {
            const totalAmount = proofs.reduce((sum, p) => sum + Number(p.amount), 0);
            const token = cashu.createToken(proofs);
            // Persist server-side to avoid loss (server-only)
            try {
                // Extract mint URL from token for accurate recovery later
                let mintUrl = 'unknown';
                try {
                    const decoded = getDecodedToken(token);
                    mintUrl = decoded?.mint || mintUrl;
                } catch (_) { }
                if (isServer) {
                    const { default: TokenVault } = await import(/* webpackIgnore: true */ '@/storage/tokenVault.server');
                    await TokenVault.set({
                        quote: mintQuote.quote,
                        token,
                        mintUrl,
                        amountSats: totalAmount,
                        proofsCount: proofs.length,
                        createdAt: Date.now()
                    });
                    console.log('💾 UmbraMix ClaimCashu: Saved ecash token to server vault for quote', mintQuote.quote);
                }
            } catch (e) {
                console.warn('⚠️ UmbraMix ClaimCashu: Failed to save token to server vault:', e);
            }
            if (typeof window !== 'undefined') {
                const key = `umbramix:cashu-token:${mintQuote.quote}`;
                window.localStorage.setItem(key, token);
                console.log('💾 UmbraMix ClaimCashu: Saved ecash token to localStorage under key', key);
            }
        } catch (e) {
            console.warn('⚠️ UmbraMix ClaimCashu: Could not persist ecash token:', e);
        }

        // Verify total amount matches expectation
        const totalAmount = proofs.reduce((sum, p) => sum + Number(p.amount), 0);
        if (Math.abs(totalAmount - targetSats) > 1) { // Allow 1 sat tolerance
            console.warn('⚠️ UmbraMix ClaimCashu: Amount mismatch:', {
                expected: targetSats,
                received: totalAmount,
                difference: totalAmount - targetSats
            });
        }

        onEvent({
            type: 'mix:progress',
            message: `Cashu proofs claimed: ${proofs.length} proofs for ${totalAmount} sats`,
            progress: 50
        });

        console.log('🪙 UmbraMix ClaimCashu: Step completed successfully');
        return proofs;

    } catch (error) {
        console.error('❌ UmbraMix ClaimCashu: Step failed:', error);
        console.error('🔍 UmbraMix ClaimCashu: Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            context: {
                quoteId: mintQuote.quote,
                targetSats,
                quoteState: mintQuote.state
            }
        });

        onEvent({
            type: 'mix:error',
            message: error instanceof Error ? error.message : 'Unknown Cashu claiming error'
        });
        throw error;
    }
}
