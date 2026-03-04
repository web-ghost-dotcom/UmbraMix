import { NextResponse } from 'next/server';
import { CashuMint, CashuWallet } from '@cashu/cashu-ts';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { quote, proofs, mintUrl } = await req.json();

    console.log('🔧 [MELT API] Received request:', {
      mintUrl: mintUrl || 'using default',
      quoteFields: quote ? Object.keys(quote) : 'missing',
      proofsCount: Array.isArray(proofs) ? proofs.length : 'invalid',
      quoteQuote: quote?.quote?.substring(0, 20) + '...' || 'missing'
    });

    if (!quote || !proofs) {
      console.error('❌ [MELT API] Missing required fields:', { hasQuote: !!quote, hasProofs: !!proofs });
      return NextResponse.json({ error: 'Missing quote or proofs' }, { status: 400 });
    }

    if (!Array.isArray(proofs) || proofs.length === 0) {
      console.error('❌ [MELT API] Invalid proofs array:', { proofs });
      return NextResponse.json({ error: 'Invalid proofs array' }, { status: 400 });
    }

    const url = (mintUrl && typeof mintUrl === 'string') ? mintUrl : ENV.CASHU_DEFAULT_MINT;
    console.log('🏭 [MELT API] Using mint URL:', url);

    const mint = new CashuMint(url);
    const wallet = new CashuWallet(mint);
    await wallet.loadMint();
    console.log('✅ [MELT API] Wallet loaded successfully');

    // Build MeltQuoteResponse using the EXACT original quote ID (critical!)
    // We must use the same quote ID that was returned from createMeltQuote
    const meltQuoteResponse = {
      quote: quote.quote, // MUST be the exact same quote ID
      amount: Number(quote.amount),
      fee_reserve: Number(quote.fee_reserve),
      state: 'UNPAID' as const,
      expiry: quote.expiry ?? Math.floor(Date.now() / 1000) + 3600,
      payment_preimage: null as string | null,
      request: quote.request ?? '',
      unit: quote.unit ?? 'sat'
    } as const;

    console.log('📋 [MELT API] Using original quote (same ID):', {
      quote: meltQuoteResponse.quote?.substring(0, 20) + '...',
      amount: meltQuoteResponse.amount,
      fee_reserve: meltQuoteResponse.fee_reserve,
      hasRequest: !!meltQuoteResponse.request,
      unit: meltQuoteResponse.unit,
      expiry: meltQuoteResponse.expiry
    });

    // Validate proofs format
    console.log('🔍 [MELT API] Validating proofs format:', {
      proofsCount: proofs.length,
      firstProof: proofs[0] ? {
        hasSecret: !!proofs[0].secret,
        hasC: !!proofs[0].C,
        hasAmount: !!proofs[0].amount,
        hasId: !!proofs[0].id,
        amount: proofs[0].amount,
        fields: Object.keys(proofs[0])
      } : 'no proofs',
      totalAmount: proofs.reduce((sum, p) => sum + (p.amount || 0), 0)
    });

    // Check if any proofs are invalid
    const invalidProofs = proofs.filter(p => !p.secret || !p.C || !p.amount || !p.id);
    if (invalidProofs.length > 0) {
      console.error('❌ [MELT API] Found invalid proofs:', invalidProofs);
      return NextResponse.json({ error: 'Invalid proof format' }, { status: 400 });
    }

    // Check if quote has expired
    const now = Math.floor(Date.now() / 1000);
    if (meltQuoteResponse.expiry && now > meltQuoteResponse.expiry) {
      console.error('❌ [MELT API] Quote expired:', {
        now,
        expiry: meltQuoteResponse.expiry,
        expiredBy: now - meltQuoteResponse.expiry
      });
      return NextResponse.json({ error: 'Quote expired' }, { status: 400 });
    }

    // First, check proof states to detect if they're already used/pending
    console.log('🔍 [MELT API] Checking proof states before melt...');
    try {
      const proofStates = await wallet.checkProofsStates(proofs);
      console.log('📊 [MELT API] Proof states:', {
        totalProofs: proofs.length,
        unspentCount: proofStates.filter(s => s.state === 'UNSPENT').length,
        spentCount: proofStates.filter(s => s.state === 'SPENT').length,
        pendingCount: proofStates.filter(s => s.state === 'PENDING').length,
        states: proofStates.map(s => s.state)
      });

      // Check if any proofs are not UNSPENT
      const nonUnspentProofs = proofStates.filter(s => s.state !== 'UNSPENT');
      if (nonUnspentProofs.length > 0) {
        console.error('❌ [MELT API] Found non-unspent proofs:', {
          nonUnspentCount: nonUnspentProofs.length,
          states: nonUnspentProofs.map(s => ({ Y: s.Y?.substring(0, 10), state: s.state }))
        });
        return NextResponse.json({
          error: `Proofs not available: ${nonUnspentProofs.length} proofs are ${nonUnspentProofs.map(p => p.state).join(', ')}`
        }, { status: 400 });
      }

      console.log('✅ [MELT API] All proofs are UNSPENT, proceeding with melt...');
    } catch (stateError) {
      console.warn('⚠️ [MELT API] Could not check proof states:', stateError instanceof Error ? stateError.message : String(stateError));
      // Continue anyway - some mints might not support state checking
    }

    console.log('⚡ [MELT API] Calling wallet.meltProofs with original quote...');

    try {
      const meltRes = await wallet.meltProofs(meltQuoteResponse, proofs);
      console.log('✅ [MELT API] Raw melt response:', {
        hasChange: !!meltRes.change,
        changeCount: meltRes.change?.length || 0,
        changeAmount: meltRes.change?.reduce((sum, p) => sum + p.amount, 0) || 0,
        responseFields: Object.keys(meltRes)
      });
      return NextResponse.json({ change: meltRes.change });
    } catch (innerError) {
      // Try to extract more details from the HTTP error
      console.error('❌ [MELT API] Detailed melt error:', {
        message: innerError instanceof Error ? innerError.message : String(innerError),
        name: innerError instanceof Error ? innerError.constructor.name : typeof innerError,
        // Try to access response details if available
        status: (innerError as any)?.status,
        statusText: (innerError as any)?.statusText,
        response: (innerError as any)?.response,
        stack: innerError instanceof Error ? innerError.stack?.substring(0, 800) : undefined
      });
      throw innerError;
    }


  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;

    console.error('❌ [MELT API] Error during melt:', {
      message: msg,
      stack: stack?.substring(0, 500) + '...',
      errorType: e instanceof Error ? e.constructor.name : typeof e
    });

    return NextResponse.json({ error: `melt failed: ${msg}` }, { status: 500 });
  }
}
