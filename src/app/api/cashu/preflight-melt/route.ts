import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log('❌ [PREFLIGHT-MELT API] DISABLED - Use /api/cashu/receive-token + /api/cashu/melt-with-proofs instead');
  

  
  return NextResponse.json({ 
    error: 'This API is disabled. Use the two-step approach: /api/cashu/receive-token then /api/cashu/melt-with-proofs' 
  }, { status: 410 });
}
