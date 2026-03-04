import { NextResponse } from 'next/server';
import { getTestnetStatus, CONFIG_STATUS, ENV, getStarknetRpc } from '@/config/env';
import { RealAtomiqSwapClient } from '@/integrations/swaps/atomiq';

export async function GET() {
    try {
        const testnetStatus = getTestnetStatus();
        const config = CONFIG_STATUS;

        // Test individual integrations
        const integrationTests = {
            atomiq: false,
            lightning: false,
            cashu: false,
            starknet: false
        };

        // Test Atomiq integration
        try {
            const atomiq = new RealAtomiqSwapClient();
            const limits = await atomiq.getSwapLimits('STRK', 'BTC_LN');
            integrationTests.atomiq = !!limits;
        } catch (error) {
            console.warn('Atomiq test failed:', error);
        }

        // Test Lightning integration (simple check if configured)
        integrationTests.lightning = !!ENV.LND_URL;

        // Test Cashu integration (simple check if mint URL is valid)
        try {
            new URL(ENV.CASHU_DEFAULT_MINT);
            integrationTests.cashu = true;
        } catch (error) {
            console.warn('Invalid Cashu mint URL:', error);
        }

        // Check Starknet RPC
        try {
            const rpcUrl = ENV.STARKNET_RPC || getStarknetRpc();
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'starknet_chainId',
                    params: [],
                    id: 1
                })
            });
            integrationTests.starknet = response.ok;
        } catch (error) {
            console.warn('Starknet RPC test failed:', error);
        }

        return NextResponse.json({
            ready: testnetStatus.ready,
            network: ENV.NETWORK,
            configuration: {
                starknetRpcConfigured: testnetStatus.starknetRpc,
                lightningConfigured: testnetStatus.lightningConfigured,
                cashuConfigured: testnetStatus.cashuMint,
                valid: config.valid,
                errors: config.errors,
                warnings: config.warnings || []
            },
            integrationTests,
            warnings: config.warnings || [],
            readinessScore: Object.values(integrationTests).filter(Boolean).length / 4 * 100,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        return NextResponse.json(
            {
                error: 'Failed to check testnet status',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
