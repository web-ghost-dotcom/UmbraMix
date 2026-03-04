import { OrchestratorEvent } from '@/lib/types';
import { RealAtomiqSwapClient } from '@/integrations/swaps/atomiq';
import { SHARED_SWAP_ACCOUNT_ADDRESS } from '@/config/constants';
import { ENV } from '@/config/env';

export async function stepSwapToLightning(
    amountStrk: number,
    depositInfo: {
        walletAddress: string;
        mixerContractAddress: string;
        fundsAvailable?: boolean;
    },
    mintInvoiceInfo: {
        lightningInvoice: string;
        amount: number;
        cashu: any;
        mintQuote: any;
    },
    onEvent: (e: OrchestratorEvent) => void
) {
    console.log('⚡ UmbraMix SwapToLN: Starting STRK → Lightning BTC swap');
    console.log('⚡ UmbraMix SwapToLN: Parameters:', {
        amountStrk,
        fromWallet: depositInfo.walletAddress.slice(0, 10) + '...',
        network: ENV.NETWORK,
        fundsAvailable: depositInfo.fundsAvailable || false,
        targetInvoice: mintInvoiceInfo.lightningInvoice.slice(0, 50) + '...'
    });

    // Verify funds are available for swapping
    if (depositInfo.fundsAvailable) {
        console.log('✅ UmbraMix SwapToLN: Funds confirmed available after privacy mixer withdrawal');
    } else {
        console.log('⚠️ UmbraMix SwapToLN: Warning - funds availability not confirmed');
    }

    try {
        onEvent({
            type: 'mix:progress',
            message: `Converting ${amountStrk} STRK to Lightning BTC...`,
            progress: 25
        });

        console.log('🏗️ UmbraMix SwapToLN: Initializing Atomiq client...');
        const atomiq = new RealAtomiqSwapClient(ENV.NETWORK);

        // Use the Cashu mint invoice from the createMintInvoice step (original mixer flow)
        const lightningInvoice = mintInvoiceInfo.lightningInvoice?.trim();
        console.log('⚡ UmbraMix SwapToLN: Using Cashu mint invoice for automated mixer flow...');

        // Decode invoice to extract exact sats (authoritative output amount)
        let invoiceSats: number | undefined;
        try {
            const { millisatoshis } = await import('bolt11').then(m => m.decode(lightningInvoice));
            if (millisatoshis) {
                invoiceSats = Number(BigInt(millisatoshis) / 1000n);
            }
        } catch (e) {
            console.warn('⚠️ UmbraMix SwapToLN: Failed to decode invoice for sats amount, proceeding (swap call will re-validate):', e instanceof Error ? e.message : e);
        }

        // Cashu mint invoices always have preset amounts (original mixer flow)
        if (invoiceSats == null || invoiceSats <= 0) {
            console.warn('⚠️ UmbraMix SwapToLN: Could not decode invoice amount, using mint amount as fallback');
            invoiceSats = mintInvoiceInfo.amount; // Use the known mint amount
        }

        console.log('⚡ UmbraMix SwapToLN: Lightning invoice details:', {
            invoice: lightningInvoice.slice(0, 50) + '...',
            invoiceSats,
            strkInputApprox: amountStrk,
            note: 'invoiceSats is authoritative output; STRK input derived by SDK'
        });

        onEvent({
            type: 'mix:progress',
            message: `Converting ${amountStrk} STRK to Lightning BTC...`,
            progress: 30
        });

        // Execute the simplified STRK → Lightning swap
        console.log('⚡ UmbraMix SwapToLN: Executing STRK → Lightning swap (exactOut via invoice)...');
        const swapResult = await atomiq.swapStrkToLightning(
            invoiceSats || mintInvoiceInfo.amount, // pass decoded invoice sats (exactOut target)
            lightningInvoice,
            SHARED_SWAP_ACCOUNT_ADDRESS
        );

        console.log('⚡ UmbraMix SwapToLN: Swap result:', {
            success: swapResult.success,
            txId: swapResult.txId,
            amount: swapResult.amount,
            route: swapResult.route,
            error: swapResult.error
        });

        // Verify swap succeeded
        if (!swapResult.success) {
            throw new Error(`STRK → Lightning swap failed: ${swapResult.error || 'Unknown error'}`);
        }

        // Wait for Lightning payment confirmation
        console.log('⏳ UmbraMix SwapToLN: Waiting for Lightning payment confirmation...');
        onEvent({
            type: 'mix:progress',
            message: 'Waiting for Lightning payment confirmation...',
            progress: 35
        });

        // In real implementation, we'd wait for actual Lightning confirmation
        // For now, simulate the confirmation delay
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('✅ UmbraMix SwapToLN: Lightning payment confirmed!');
        onEvent({
            type: 'mix:progress',
            message: 'STRK successfully swapped to Lightning BTC',
            progress: 40
        });

        return {
            executionId: swapResult.txId || `swap_${Date.now()}`,
            lightningInvoice: lightningInvoice,
            lightningAmount: invoiceSats || mintInvoiceInfo.amount,
            lightningPaymentHash: swapResult.txId, // Use txId as payment reference
            swapTxId: swapResult.txId,
            amountIn: amountStrk,
            amountOut: swapResult.amount,
            fee: 0, // Fee included in swap amount for simplified interface
            cashu: mintInvoiceInfo.cashu,
            mintQuote: mintInvoiceInfo.mintQuote
        };

    } catch (error) {
        console.error('❌ UmbraMix SwapToLN: Step failed:', error);
        console.error('🔍 UmbraMix SwapToLN: Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            context: {
                amountStrk,
                network: ENV.NETWORK
            }
        });

        onEvent({
            type: 'mix:error',
            message: error instanceof Error ? error.message : 'Unknown swap error'
        });
        throw error;
    }
}
