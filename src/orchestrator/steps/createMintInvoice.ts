import { OrchestratorEvent } from '@/lib/types';
import { MultiMintCashuManager, RealCashuClient } from '@/integrations/cashu/client';
import { ENV } from '@/config/env';

export async function stepCreateMintInvoice(
    sats: number,
    onEvent: (e: OrchestratorEvent) => void
) {
    console.log('🏦 UmbraMix MintInvoice: Starting mint invoice creation');
    console.log('🏦 UmbraMix MintInvoice: Amount:', sats, 'sats');

    try {
        onEvent({
            type: 'mix:progress',
            message: `Creating Cashu mint invoice for ${sats} sats...`,
            progress: 15
        });

        // Initialize Cashu manager/client
        console.log('🏦 UmbraMix MintInvoice: Initializing Cashu services...');
        console.log('🏦 UmbraMix MintInvoice: Available mints:', ENV.CASHU_MINTS.length);
        console.log('🏦 UmbraMix MintInvoice: Default mint:', ENV.CASHU_DEFAULT_MINT);

        const cashuManager = ENV.CASHU_MINTS.length ? new MultiMintCashuManager(ENV.CASHU_MINTS) : null;
        const cashu = cashuManager ? cashuManager.selectMint() : new RealCashuClient(ENV.CASHU_DEFAULT_MINT);

        console.log('🏦 UmbraMix MintInvoice: Cashu client type:', cashuManager ? 'Multi-mint manager' : 'Single mint');

        // Create mint quote (this generates the Lightning invoice)
        console.log('🏦 UmbraMix MintInvoice: Creating mint quote...');
        const mintQuote = await cashu.createMintQuote(BigInt(sats));

        console.log('🏦 UmbraMix MintInvoice: Mint quote created:', {
            quote: mintQuote.quote,
            amount: mintQuote.amount.toString(),
            state: mintQuote.state,
            invoice: mintQuote.request?.slice(0, 50) + '...'
        });

        if (!mintQuote.request) {
            throw new Error('Cashu mint did not provide Lightning invoice');
        }

        onEvent({
            type: 'mix:progress',
            message: 'Cashu mint invoice created successfully',
            progress: 20
        });

        console.log('🏦 UmbraMix MintInvoice: Invoice ready for Atomiq payment');
        console.log('🏦 UmbraMix MintInvoice: Step completed successfully');

        return {
            cashu,
            cashuManager,
            mintQuote,
            lightningInvoice: mintQuote.request,
            amount: sats
        };

    } catch (error) {
        console.error('❌ UmbraMix MintInvoice: Step failed:', error);
        console.error('🔍 UmbraMix MintInvoice: Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            context: {
                sats,
                mintUrl: ENV.CASHU_DEFAULT_MINT,
                mintsAvailable: ENV.CASHU_MINTS.length
            }
        });

        onEvent({
            type: 'mix:error',
            message: error instanceof Error ? error.message : 'Unknown mint invoice error'
        });
        throw error;
    }
}
