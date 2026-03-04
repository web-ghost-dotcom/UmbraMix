import { RealAtomiqSwapClient } from '../integrations/swaps/atomiq';

async function testAtomiqIntegration() {
    console.log('🧪 Testing Atomiq integration...');

    try {
        const client = new RealAtomiqSwapClient();

        console.log('🔍 Testing getSwapLimits...');
        const limits = await client.getSwapLimits('STRK', 'BTC_LN');
        console.log('✅ Swap limits:', {
            min: limits.min.toString(),
            max: limits.max.toString()
        });

        console.log('💱 Testing getQuote...');
        const quote = await client.getQuote('STRK', 'BTC_LN', BigInt('1000000000000000000')); // 1 STRK
        console.log('✅ Quote received:', {
            id: quote.id,
            from: quote.from,
            to: quote.to,
            amountIn: quote.amountIn.toString(),
            amountOut: quote.amountOut.toString(),
            fee: quote.fee.toString()
        });

        console.log('🎉 Atomiq integration test successful!');

    } catch (error: any) {
        console.log('❌ Atomiq test failed:', error.message);
        console.log('Stack:', error.stack?.substring(0, 500) + '...');
    }
}

testAtomiqIntegration();
