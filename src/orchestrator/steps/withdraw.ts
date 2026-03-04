import { OrchestratorEvent } from '@/lib/types';
import { RealStarknetWalletClient } from '@/integrations/starknet/wallet';
import { ENV } from '@/config/env';
import { hash, uint256, num } from 'starknet';

export async function stepWithdraw(
    destinations: string[],
    amountPerDestination: number,
    depositInfo: {
        secret: string;
        nullifier: string;
        commitmentHash: string;
        mixerContractAddress: string;
    },
    onEvent: (e: OrchestratorEvent) => void
) {
    console.log('🏦 UmbraMix Withdraw: Starting withdrawal step');
    console.log('🏦 UmbraMix Withdraw: Parameters:', {
        destinations: destinations.length,
        amountPerDestination,
        mixerContract: depositInfo.mixerContractAddress
    });

    try {
        // Initialize wallet client  
        const walletClient = new RealStarknetWalletClient(ENV.STARKNET_RPC);
        await walletClient.connect();
        await walletClient.initMixerContract(depositInfo.mixerContractAddress);

        onEvent({ type: 'mix:progress', message: 'Starting privacy withdrawals...', progress: 85 });

        for (let i = 0; i < destinations.length; i++) {
            const destination = destinations[i];
            const amountWei = BigInt(Math.floor(amountPerDestination * Math.pow(10, 18))); // Convert to wei

            console.log(`🏦 UmbraMix Withdraw: Processing withdrawal ${i + 1}/${destinations.length}`);
            console.log(`🏦 UmbraMix Withdraw: Destination: ${destination.slice(0, 10)}...${destination.slice(-6)}`);
            console.log(`🏦 UmbraMix Withdraw: Amount: ${amountPerDestination} STRK (${amountWei} wei)`);

            // Generate ZK proof for withdrawal (simplified)
            console.log('🔐 UmbraMix Withdraw: Generating ZK proof for withdrawal...');

            // For a real implementation, this would generate a proper zero-knowledge proof
            // that proves knowledge of the secret without revealing it
            const proof = generateWithdrawalProof(
                depositInfo.secret,
                depositInfo.commitmentHash,
                depositInfo.nullifier,
                destination,
                amountWei
            );

            console.log('🔐 UmbraMix Withdraw: ZK proof generated:', {
                proofLength: proof.length,
                nullifier: depositInfo.nullifier.slice(0, 10) + '...'
            });

            onEvent({
                type: 'mix:progress',
                message: `Withdrawing to account ${i + 1}/${destinations.length}...`,
                progress: 85 + (i * 5) / destinations.length
            });

            // Submit withdrawal to mixer contract
            console.log('📤 UmbraMix Withdraw: Submitting withdrawal to mixer contract...');
            try {
                const withdrawalTxHash = await walletClient.withdrawFromMixer(
                    depositInfo.nullifier,
                    depositInfo.commitmentHash,
                    destination,
                    amountWei,
                    proof
                );

                console.log(`✅ UmbraMix Withdraw: Withdrawal ${i + 1} submitted:`, withdrawalTxHash);

                // Wait for confirmation
                const confirmedTx = await walletClient.waitForTransaction(withdrawalTxHash);

                if (confirmedTx.status === 'REJECTED') {
                    throw new Error(`Withdrawal ${i + 1} was rejected by the network`);
                }

                console.log(`✅ UmbraMix Withdraw: Withdrawal ${i + 1} confirmed:`, confirmedTx);

            } catch (error) {
                console.error(`❌ UmbraMix Withdraw: Failed withdrawal ${i + 1}:`, error);
                throw new Error(`Withdrawal to ${destination.slice(0, 10)}... failed: ${error}`);
            }

            // Add delay between withdrawals for privacy
            if (i < destinations.length - 1) {
                const delay = 1000 + Math.random() * 2000; // 1-3 second random delay
                console.log(`⏳ UmbraMix Withdraw: Privacy delay: ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.log('✅ UmbraMix Withdraw: All withdrawals completed successfully');
        onEvent({
            type: 'mix:progress',
            message: `All ${destinations.length} withdrawals completed`,
            progress: 95
        });

        return {
            withdrawalCount: destinations.length,
            totalAmount: amountPerDestination * destinations.length,
            destinations: destinations.map(addr => addr.slice(0, 10) + '...')
        };

    } catch (error) {
        console.error('❌ UmbraMix Withdraw: Step failed:', error);
        onEvent({
            type: 'mix:error',
            message: error instanceof Error ? error.message : 'Unknown withdrawal error'
        });
        throw error;
    }
}

function generateWithdrawalProof(
    secret: string,
    commitmentHash: string,
    nullifier: string,
    recipient: string,
    amount: bigint
): string[] {
    // Use the same proven 3-element proof format as the working e2e test
    // This matches the format used in src/utils/e2e-privacy-mixer-test.ts

    try {
        console.log(`🔐 Creating ZK proof for secret: ${secret.slice(0, 10)}..., amount: ${amount}, recipient: ${recipient.slice(0, 10)}...`);

        // Convert inputs to BigInt exactly like the working e2e test
        const secretBigInt = BigInt(secret);
        const recipientBigInt = BigInt(recipient);

        // Split amount into low and high parts using uint256 format
        const amountUint256 = uint256.bnToUint256(amount);
        const amountLow = BigInt(amountUint256.low);
        const amountHigh = BigInt(amountUint256.high);

        // Generate recipient_hash = hash(recipient) using Starknet.js (matches Cairo)
        const recipientHash = hash.computePoseidonHashOnElements([recipientBigInt]);

        // Generate amount_hash = hash(amount.low, amount.high) using Starknet.js (matches Cairo)
        const amountHash = hash.computePoseidonHashOnElements([amountLow, amountHigh]);

        const proof = [
            secret, // secret (as hex string)
            num.toHex(recipientHash), // recipient_hash
            num.toHex(amountHash)     // amount_hash
        ];

        console.log(`✅ Generated ZK proof:`, proof);
        return proof;

    } catch (error) {
        console.error('❌ Error creating ZK proof:', error);
        throw error;
    }
}
