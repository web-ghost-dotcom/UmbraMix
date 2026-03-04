/**
 * Utility to test contract integration
 */

import { RpcProvider, Contract } from 'starknet';
import { PRIVACY_MIXER } from '@/config/constants';
import privacyMixerAbi from '@/config/privacy-mixer-abi.json';
import { ENV } from '@/config/env';

const RPC_URL = ENV.STARKNET_RPC || 'https://starknet-sepolia.g.alchemy.com/v2/kwgGr9GGk4YyLXuGfEvpITv1jpvn3PgP';

export async function testContractConnection() {
    try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL });

        // Create contract instance for read-only operations
        const contract = new Contract(
            privacyMixerAbi,
            PRIVACY_MIXER.CONTRACT_ADDRESS,
            provider
        );

        console.log('Testing contract connection...');
        console.log('Contract Address:', PRIVACY_MIXER.CONTRACT_ADDRESS);

        // Test basic read functions
        const totalDeposits = await contract.get_total_deposits();
        const totalWithdrawals = await contract.get_total_withdrawals();
        const anonymitySetSize = await contract.get_anonymity_set_size();
        const isPaused = await contract.is_paused();

        console.log('Contract Status:');
        console.log('- Total Deposits:', totalDeposits.toString());
        console.log('- Total Withdrawals:', totalWithdrawals.toString());
        console.log('- Anonymity Set Size:', anonymitySetSize.toString());
        console.log('- Is Paused:', isPaused);

        // Test mixing stats
        const mixingStats = await contract.get_mixing_stats();
        console.log('Mixing Stats:', {
            total_deposits: mixingStats.total_deposits.toString(),
            total_withdrawals: mixingStats.total_withdrawals.toString(),
            active_commitments: mixingStats.active_commitments.toString(),
            anonymity_set_size: mixingStats.anonymity_set_size.toString(),
            mixing_efficiency: mixingStats.mixing_efficiency.toString(),
        });

        return {
            success: true,
            contract,
            stats: {
                totalDeposits: totalDeposits.toString(),
                totalWithdrawals: totalWithdrawals.toString(),
                anonymitySetSize: anonymitySetSize.toString(),
                isPaused,
                mixingStats
            }
        };

    } catch (error) {
        console.error('Contract connection test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Helper to validate contract configuration
export function validateContractConfig() {
    console.log('Privacy Mixer Contract Configuration:');
    console.log('Contract Address:', PRIVACY_MIXER.CONTRACT_ADDRESS);
    console.log('Owner Address:', PRIVACY_MIXER.DEPLOYMENT_PARAMS.OWNER);
    console.log('Min Deposit:', PRIVACY_MIXER.DEPLOYMENT_PARAMS.MIN_DEPOSIT.toString(), 'wei');
    console.log('Max Deposit:', PRIVACY_MIXER.DEPLOYMENT_PARAMS.MAX_DEPOSIT.toString(), 'wei');
    console.log('Fee Rate:', PRIVACY_MIXER.DEPLOYMENT_PARAMS.FEE_RATE.toString(), '/10000');
    console.log('Min Delay:', PRIVACY_MIXER.DEPLOYMENT_PARAMS.MIN_DELAY.toString(), 'seconds');

    return PRIVACY_MIXER;
}
