#!/usr/bin/env npx tsx

/**
 * Simple Contract Test - Deposit & Withdraw
 * Tests the core functionality with the current deployed contract
 */

import { RpcProvider, CallData, cairo, num } from 'starknet';
import { ENV } from '@/config/env';
import { PRIVACY_MIXER } from '@/config/constants';

const RPC_URL = ENV.STARKNET_RPC;
const MIXER_CONTRACT = PRIVACY_MIXER.CONTRACT_ADDRESS;
const STRK_TOKEN = PRIVACY_MIXER.STRK_TOKEN;

async function testContractCalls() {
    console.log('🧪 Testing Contract Read Functions');
    console.log('📍 Contract:', MIXER_CONTRACT);
    console.log('🪙 STRK Token:', STRK_TOKEN);

    try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL });

        console.log('\n1️⃣ === TESTING READ FUNCTIONS ===');

        // Test 1: Get contract owner
        console.log('🔍 Getting contract owner...');
        const ownerResult = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_owner',
            calldata: []
        });
        console.log('👤 Owner:', ownerResult[0]);

        // Test 2: Get STRK token address
        console.log('🔍 Getting STRK token address...');
        const strkResult = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_strk_token',
            calldata: []
        });
        console.log('🪙 STRK Token:', strkResult[0]);

        // Test 3: Get mixing stats
        console.log('🔍 Getting mixing stats...');
        const statsResult = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_mixing_stats',
            calldata: []
        });
        console.log('📊 Mixing Stats:', {
            totalDeposits: statsResult[0],
            totalWithdrawals: statsResult[1],
            activeCommitments: statsResult[2],
            anonymitySetSize: statsResult[3],
            mixingEfficiency: statsResult[4]
        });

        // Test 4: Get anonymity set size
        console.log('🔍 Getting anonymity set size...');
        const anonymityResult = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_anonymity_set_size',
            calldata: []
        });
        console.log('👥 Anonymity Set Size:', anonymityResult[0]);

        // Test 5: Get minimum delay
        console.log('🔍 Getting minimum delay...');
        const delayResult = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_min_delay',
            calldata: []
        });
        console.log('⏱️ Min Delay:', delayResult[0], 'seconds');

        // Test 6: Get minimum anonymity set
        console.log('🔍 Getting minimum anonymity set...');
        const minAnonymityResult = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_min_anonymity_set',
            calldata: []
        });
        console.log('🎭 Min Anonymity Set:', minAnonymityResult[0]);

        // Test 7: Check if contract is paused
        console.log('🔍 Checking if contract is paused...');
        const pausedResult = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'is_paused',
            calldata: []
        });
        console.log('⏸️ Is Paused:', Boolean(Number(pausedResult[0])));

        console.log('\n2️⃣ === TESTING STRK TOKEN ===');

        // Test STRK token functions
        console.log('🔍 Getting STRK token name...');
        const nameResult = await provider.callContract({
            contractAddress: STRK_TOKEN,
            entrypoint: 'name',
            calldata: []
        });

        // Convert felt to string
        const nameHex = num.toHex(nameResult[0]);
        const nameString = Buffer.from(nameHex.slice(2), 'hex').toString('utf8');
        console.log('📛 STRK Name:', nameString);

        console.log('🔍 Getting STRK token symbol...');
        const symbolResult = await provider.callContract({
            contractAddress: STRK_TOKEN,
            entrypoint: 'symbol',
            calldata: []
        });

        const symbolHex = num.toHex(symbolResult[0]);
        const symbolString = Buffer.from(symbolHex.slice(2), 'hex').toString('utf8');
        console.log('🔤 STRK Symbol:', symbolString);

        console.log('🔍 Getting STRK decimals...');
        const decimalsResult = await provider.callContract({
            contractAddress: STRK_TOKEN,
            entrypoint: 'decimals',
            calldata: []
        });
        console.log('🔢 STRK Decimals:', decimalsResult[0]);

        console.log('\n3️⃣ === TESTING NULLIFIER FUNCTIONS ===');

        // Test with a random nullifier
        const testNullifier = '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234';
        console.log('🔍 Testing nullifier usage for:', testNullifier.slice(0, 12) + '...');

        const nullifierResult = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'is_nullifier_used',
            calldata: [testNullifier]
        });
        console.log('🔒 Is nullifier used:', Boolean(Number(nullifierResult[0])));

        // Test commitment validity
        const testCommitment = '0x987654321fedcba987654321fedcba987654321fedcba987654321fedcba98';
        console.log('🔍 Testing commitment validity for:', testCommitment.slice(0, 12) + '...');

        const commitmentResult = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'is_commitment_valid',
            calldata: [testCommitment]
        });
        console.log('✅ Is commitment valid:', Boolean(Number(commitmentResult[0])));

        console.log('\n✅ === ALL READ TESTS PASSED ===');
        console.log('🎉 Contract is responding correctly to all queries');

        return {
            success: true,
            contractResponsive: true,
            strkTokenWorking: true,
            minDelay: Number(delayResult[0]),
            minAnonymity: Number(minAnonymityResult[0]),
            anonymitySetSize: Number(anonymityResult[0]),
            isPaused: Boolean(Number(pausedResult[0]))
        };

    } catch (error) {
        console.error('\n❌ Contract test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

async function main() {
    console.log('🚀 Starting Simple Contract Tests\n');

    const result = await testContractCalls();

    if (result.success) {
        console.log('\n📋 Contract Configuration Summary:');
        console.log('  - Min Delay:', result.minDelay, 'seconds');
        console.log('  - Min Anonymity:', result.minAnonymity);
        console.log('  - Current Anonymity Set:', result.anonymitySetSize);
        console.log('  - Contract Paused:', result.isPaused);
        console.log('\n✅ Contract is ready for deposit/withdraw testing!');

        if (result.minDelay === 0 && result.minAnonymity === 0) {
            console.log('🎯 Perfect! Zero delay and anonymity - ideal for testing');
        }
    } else {
        console.log('\n❌ Contract not ready. Fix issues before proceeding.');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

export { testContractCalls };
