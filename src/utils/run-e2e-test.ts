#!/usr/bin/env npx tsx

/**
 * E2E Test Runner - Loads environment and executes the privacy mixer test
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables first
config({ path: resolve(__dirname, '../../.env.local') });

// Verify required environment variables
const requiredEnvVars = [
    'NEXT_PUBLIC_MIXER_CONTRACT_ADDRESS',
    'NEXT_PUBLIC_STARKNET_RPC',
    'SENDER_PRIVATE_KEY',
    'SENDER_ADDRESS',
    'RECIPIENT_ADDRESS'
];

async function runE2ETest() {
    try {
        console.log('🔍 Checking environment configuration...');
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            console.error('❌ Missing required environment variables:');
            missingVars.forEach(varName => console.error(`   - ${varName}`));
            console.error('\nPlease check your .env.local file and ensure all variables are set.');
            process.exit(1);
        }

        console.log('✅ Environment configuration verified');
        console.log('📋 Test Configuration:');
        console.log(`   - Network: ${process.env.NEXT_PUBLIC_NETWORK || 'TESTNET'}`);
        console.log(`   - RPC: ${process.env.NEXT_PUBLIC_STARKNET_RPC}`);
        console.log(`   - Mixer Contract: ${process.env.NEXT_PUBLIC_MIXER_CONTRACT_ADDRESS}`);
        console.log(`   - Sender: ${process.env.SENDER_ADDRESS}`);
        console.log(`   - Recipient: ${process.env.RECIPIENT_ADDRESS}`);
        console.log('');

        // Initialize and run the test
        console.log('✅ Starting E2E Privacy Mixer Test');

        // Import the test module
        const testModule = await import('./e2e-privacy-mixer-test');

        console.log('✅ E2E test module loaded successfully');

        // Create and run the test instance
        const { PrivacyMixerE2ETest } = testModule;
        const test = new PrivacyMixerE2ETest();

        console.log('🚀 Running full Privacy Mixer E2E test...');
        await test.runFullTest();

        console.log('==========================================');
        console.log('🎉 All tests passed successfully!');

    } catch (error: any) {
        console.error('❌ E2E test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Execute the test
runE2ETest();
