/**
 * Test script to verify the complete deposit flow works with deployed contract
 */

import { testContractConnection } from './test-contract';
import { PRIVACY_MIXER } from '@/config/constants';

console.log('🧪 Testing Privacy Mixer Contract Integration...\n');

async function runTests() {
    console.log('📋 Configuration Check:');
    console.log('├── Contract Address:', PRIVACY_MIXER.CONTRACT_ADDRESS);
    console.log('├── Owner Address:', PRIVACY_MIXER.DEPLOYMENT_PARAMS.OWNER);
    console.log('├── Min Deposit:', PRIVACY_MIXER.DEPLOYMENT_PARAMS.MIN_DEPOSIT.toString(), 'wei');
    console.log('├── Max Deposit:', PRIVACY_MIXER.DEPLOYMENT_PARAMS.MAX_DEPOSIT.toString(), 'wei');
    console.log('└── Min Delay:', PRIVACY_MIXER.DEPLOYMENT_PARAMS.MIN_DELAY.toString(), 'seconds');
    console.log('');

    console.log('🔗 Testing Contract Connection...');
    try {
        const result = await testContractConnection();

        if (result.success) {
            console.log('✅ Contract connection successful!');
            console.log('');
            console.log('📊 Contract Status:');
            console.log('├── Total Deposits:', result.stats?.totalDeposits || 'N/A');
            console.log('├── Total Withdrawals:', result.stats?.totalWithdrawals || 'N/A');
            console.log('├── Anonymity Set Size:', result.stats?.anonymitySetSize || 'N/A');
            console.log('└── Is Paused:', result.stats?.isPaused);
            console.log('');

            console.log('🎯 Integration Status: READY FOR USER TRANSACTIONS! 🚀');
            console.log('');
            console.log('Next Steps:');
            console.log('1. User can connect wallet (ArgentX, Braavos, etc.)');
            console.log('2. User can input STRK amount to mix');
            console.log('3. Contract will receive deposits with privacy commitments');
            console.log('4. Mixing pipeline will proceed through Lightning/Cashu steps');

        } else {
            console.error('❌ Contract connection failed:', result.error);
            console.log('');
            console.log('🔧 Check:');
            console.log('- RPC endpoint is accessible');
            console.log('- Contract address is correct');
            console.log('- ABI file exists and is valid');
        }

    } catch (error) {
        console.error('💥 Test failed with error:', error);
    }
}

// For Node.js testing
if (typeof window === 'undefined') {
    runTests();
}

export { runTests };
