import { NextResponse } from 'next/server';
import { CashuMint, CashuWallet } from '@cashu/cashu-ts';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { invoice, mintUrl } = await req.json();

    console.log('🔧 [MELT-QUOTE API] Received request:', {
      hasInvoice: !!invoice,
      invoicePrefix: invoice?.substring(0, 20) + '...' || 'missing',
      mintUrl: mintUrl || 'using default'
    });

    if (!invoice || typeof invoice !== 'string') {
      console.error('❌ [MELT-QUOTE API] Missing or invalid invoice');
      return NextResponse.json({ error: 'Missing invoice' }, { status: 400 });
    }
    const url = (mintUrl && typeof mintUrl === 'string') ? mintUrl : ENV.CASHU_DEFAULT_MINT;
    console.log('🏭 [MELT-QUOTE API] Using mint URL:', url);

    const mint = new CashuMint(url);
    const wallet = new CashuWallet(mint);
    await wallet.loadMint();
    console.log('✅ [MELT-QUOTE API] Wallet loaded successfully');

    console.log('⚡ [MELT-QUOTE API] Creating melt quote...');
    const quote = await wallet.createMeltQuote(invoice);

    console.log('✅ [MELT-QUOTE API] Quote created:', {
      quote: quote.quote?.substring(0, 20) + '...',
      amount: quote.amount,
      fee_reserve: quote.fee_reserve,
      unit: quote.unit,
      expiry: quote.expiry,
      hasRequest: !!quote.request
    });

    return NextResponse.json({
      quote: quote.quote,
      amount: quote.amount,
      fee_reserve: quote.fee_reserve,
      unit: quote.unit,
      expiry: quote.expiry,
      request: quote.request
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;

    console.error('❌ [MELT-QUOTE API] Error creating quote:', {
      message: msg,
      stack: stack?.substring(0, 500) + '...'
    });

    return NextResponse.json({ error: `melt-quote failed: ${msg}` }, { status: 500 });
  }
}
