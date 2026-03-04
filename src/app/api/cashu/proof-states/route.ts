import { NextResponse } from 'next/server';
import { CashuMint, CashuWallet } from '@cashu/cashu-ts';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { proofs, mintUrl } = await req.json();

        console.log('🔍 [PROOF-STATES API] Received request:', {
            mintUrl: mintUrl || 'using default',
            proofsCount: Array.isArray(proofs) ? proofs.length : 'invalid'
        });

        if (!proofs || !Array.isArray(proofs)) {
            console.error('❌ [PROOF-STATES API] Invalid proofs array:', { proofs });
            return NextResponse.json({ error: 'Invalid proofs array' }, { status: 400 });
        }

        const url = (mintUrl && typeof mintUrl === 'string') ? mintUrl : ENV.CASHU_DEFAULT_MINT;
        console.log('🏭 [PROOF-STATES API] Using mint URL:', url);

        const mint = new CashuMint(url);
        const wallet = new CashuWallet(mint);
        await wallet.loadMint();
        console.log('✅ [PROOF-STATES API] Wallet loaded successfully');

        try {
            const proofStates = await wallet.checkProofsStates(proofs);
            console.log('📊 [PROOF-STATES API] Proof states checked:', {
                totalProofs: proofs.length,
                unspentCount: proofStates.filter(s => s.state === 'UNSPENT').length,
                spentCount: proofStates.filter(s => s.state === 'SPENT').length,
                pendingCount: proofStates.filter(s => s.state === 'PENDING').length
            });

            return NextResponse.json({ states: proofStates });
        } catch (stateError) {
            console.error('❌ [PROOF-STATES API] Error checking proof states:', stateError);
            return NextResponse.json({
                error: `Failed to check proof states: ${stateError instanceof Error ? stateError.message : String(stateError)}`
            }, { status: 500 });
        }

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('❌ [PROOF-STATES API] Error:', msg);
        return NextResponse.json({ error: `proof states check failed: ${msg}` }, { status: 500 });
    }
}