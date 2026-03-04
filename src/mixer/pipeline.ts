import { randomHex } from '@/crypto/bdhke';
import { RealAtomiqSwapClient } from '@/integrations/swaps/atomiq';
import { RealLightningClient } from '@/integrations/lightning/client';
import { RealCashuClient } from '@/integrations/cashu/client';
import { ENV } from '@/config/env';
import { mixerEngine } from './engine';
import { globalEventBus } from '@/events/bus';
import { PipelineTransfer, EcashProof } from '@/domain/types';
import { generateMockInvoice } from '@/utils/lightning';

const atomiq = new RealAtomiqSwapClient(process.env.NEXT_PUBLIC_NETWORK === 'MAINNET' ? 'MAINNET' : 'TESTNET');
const _lnClient = new RealLightningClient(
    process.env.LND_URL || '',
    process.env.LND_MACAROON || '',
    process.env.LND_TLS || ''
);
const _cashuClient = new RealCashuClient(process.env.CASHU_MINT || ENV.CASHU_DEFAULT_MINT);

const transfers = new Map<string, PipelineTransfer>();

export class PipelineOrchestrator {
    async initiate(from: string, to: string, amountStrk: bigint): Promise<PipelineTransfer> {
        const id = randomHex(12);
        const transfer: PipelineTransfer = {
            id,
            from,
            // Do not persist recipient address for privacy
            to: 'redacted',
            amountStrk,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            state: 'PIPELINE_CREATED',
        };
        transfers.set(id, transfer);
        globalEventBus.emit({ id: randomHex(8), type: 'pipeline.created', at: Date.now(), payload: { transfer } });
        // fire and forget full pipeline (mocked)
        void this.run(id);
        return transfer;
    }

    get(id: string): PipelineTransfer | undefined { return transfers.get(id); }

    private update(id: string, patch: Partial<PipelineTransfer>): PipelineTransfer {
        const existing = transfers.get(id);
        if (!existing) throw new Error('transfer not found');
        const prevState = existing.state;
        const updated: PipelineTransfer = { ...existing, ...patch, updatedAt: Date.now() };
        transfers.set(id, updated);
        globalEventBus.emit({ id: randomHex(8), type: 'pipeline.updated', at: Date.now(), payload: { transfer: updated } });
        if (prevState !== updated.state) {
            globalEventBus.emit({ id: randomHex(8), type: 'pipeline.state_changed', at: Date.now(), payload: { id, from: prevState, to: updated.state } });
        }
        return updated;
    }

    private async run(id: string) {
        try {
            // 1. STRK -> BTC swap (mock) then into LN
            this.update(id, { state: 'SWAP_OUT_STRK_PENDING' });
            const quote1 = await atomiq.getQuote('STRK', 'BTC_LN', this.get(id)!.amountStrk);
            await atomiq.execute(quote1.id);
            this.update(id, { state: 'SWAP_OUT_STRK_COMPLETED', intermediateBtcMsat: BigInt(quote1.amountOut) * 1000n });

            // 2. Create LN invoice (mint side) & mark deposit
            // Generate a proper bolt11-formatted mock invoice
            const mockInvoice = generateMockInvoice(Number(quote1.amountOut), 'Privacy Mixer', id.slice(-6));
            this.update(id, { state: 'LN_DEPOSIT_PENDING', lnInvoice: mockInvoice });
            // simulate settlement
            this.update(id, { state: 'LN_DEPOSIT_SETTLED' });

            // 3. Mint ecash proofs (mock single proof)
            const proofs: EcashProof[] = [{
                secret: 'sec_' + id,
                signature: 'sig_' + id,
                amount: BigInt(quote1.amountOut),
                currency: 'SAT',
                keysetId: 'mock'
            }];
            this.update(id, { state: 'ECASH_MINTED', ecashProofs: proofs });

            // 4. Create mixing session & deposit
            const sessionRes = await mixerEngine.createSession({ currency: 'SAT', targetAmounts: [proofs[0].amount] });
            await mixerEngine.deposit(sessionRes.session.id, proofs);
            await mixerEngine.startMixing(sessionRes.session.id);
            const mixed = (await mixerEngine.getSession(sessionRes.session.id))?.outputs ?? [];
            this.update(id, { sessionId: sessionRes.session.id, state: 'REISSUED', mixedProofs: mixed });

            // 5. Swap back to STRK (mock)
            this.update(id, { state: 'SWAP_BACK_PENDING' });
            const quote2 = await atomiq.getQuote('BTC_LN', 'STRK', BigInt(quote1.amountOut));
            const exec2 = await atomiq.execute(quote2.id);
            this.update(id, { state: 'SWAP_BACK_COMPLETED', swapBackTxId: exec2.txId });

            // 6. Completed
            this.update(id, { state: 'PIPELINE_COMPLETED' });
            globalEventBus.emit({ id: randomHex(8), type: 'pipeline.completed', at: Date.now(), payload: { id } });
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'error';
            this.update(id, { state: 'PIPELINE_FAILED', error: msg });
            globalEventBus.emit({ id: randomHex(8), type: 'pipeline.failed', at: Date.now(), payload: { id, error: msg } });
        }
    }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
