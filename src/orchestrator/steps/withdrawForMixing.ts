import { OrchestratorEvent } from '@/lib/types';
import { RealStarknetWalletClient } from '@/integrations/starknet/wallet';
import { ENV } from '@/config/env';
import { SHARED_SWAP_ACCOUNT_ADDRESS } from '@/config/constants';
import { hash, uint256, num } from 'starknet';

export async function stepWithdrawForMixing(
    depositResult: {
        commitmentHash: string;
        secret: string;
        nullifier: string;
        amount: number;
        amountWei: string;
        mixerContractAddress: string;
        walletAddress: string;
        withdrawalDone?: boolean;
        withdrawalTxHash?: string;
        withdrawalRecipient?: string;
        [key: string]: unknown;
    },
    onEvent: (e: OrchestratorEvent) => void
) {
    console.log('🔄 UmbraMix Withdraw: Starting immediate withdrawal for mixing pipeline');
    console.log('🔄 UmbraMix Withdraw: Parameters:', {
        commitment: depositResult.commitmentHash.slice(0, 10) + '...',
        amount: depositResult.amount,
        nullifier: depositResult.nullifier.slice(0, 10) + '...'
    });

    try {
        onEvent({
            type: 'deposit:preparing_withdrawal',
            message: 'Preparing withdrawal for privacy mixing...',
            progress: 25
        });

        // Always use the user's connected wallet to sign the withdrawal.
        // The user's wallet signs the withdrawal tx (gas-efficient — no new popup,
        // reuses cached connection). STRK is sent to the shared swap account which
        // then signs the Atomiq commit server-side.
        const walletClient = new RealStarknetWalletClient(ENV.STARKNET_RPC);
        await walletClient.connect(); // reuses cached Braavos/Argent connection
        await walletClient.initMixerContract(depositResult.mixerContractAddress);

        const recipientAddress = SHARED_SWAP_ACCOUNT_ADDRESS;
        console.log('🔄 UmbraMix Withdraw: User wallet signs tx; STRK recipient = shared swap account:', recipientAddress);

        console.log('🔄 UmbraMix Withdraw: Preparing withdrawal transaction...');
        console.log('🔄 UmbraMix Withdraw: Withdrawal details:', {
            nullifier: depositResult.nullifier.slice(0, 10) + '...',
            commitment: depositResult.commitmentHash.slice(0, 10) + '...',
            recipient: recipientAddress,   // full address intentionally logged
            amount: depositResult.amountWei
        });

        // Generate ZK proof (same 3-element format as main withdraw step & e2e test)
        console.log('🔄 UmbraMix Withdraw: Generating withdrawal proof (3-element format)...');

        const amountBigInt = BigInt(depositResult.amountWei);
        const recipientBigInt = BigInt(recipientAddress);

        const amountUint256 = uint256.bnToUint256(amountBigInt);
        const amountLow = BigInt(amountUint256.low);
        const amountHigh = BigInt(amountUint256.high);

        const recipientHash = hash.computePoseidonHashOnElements([recipientBigInt]);
        const amountHash = hash.computePoseidonHashOnElements([amountLow, amountHigh]);

        const proof: string[] = [
            depositResult.secret,             // secret
            num.toHex(recipientHash),          // recipient_hash
            num.toHex(amountHash)              // amount_hash
        ];

        if (proof.length !== 3) {
            throw new Error(`Generated proof length mismatch: expected 3, got ${proof.length}`);
        }

        console.log('🔄 UmbraMix Withdraw: Proof generated:', {
            proofLength: proof.length,
            elements: proof.map(p => p.slice(0, 10) + '...')
        });

        onEvent({
            type: 'deposit:preparing_withdrawal',
            message: 'Checking minimum mixing delay...',
            progress: 25
        });

        // Check if enough time has passed since deposit for privacy requirements
        // The NEW contract enforces a 4-second delay between deposit and withdrawal for testing
        const MINIMUM_DELAY_SECONDS = 4; // 4 seconds as per new test contract deployment

        console.log('🕐 UmbraMix Withdraw: Checking timing requirements...');
        console.log('🕐 UmbraMix Withdraw: Contract requires 4 second delay between deposit and withdrawal');

        // Wait the required delay to satisfy contract requirements
        console.log('⏳ UmbraMix Withdraw: Waiting 4 seconds for mixing delay...');
        await new Promise(resolve => setTimeout(resolve, MINIMUM_DELAY_SECONDS * 1000));

        console.log('✅ UmbraMix Withdraw: Minimum delay satisfied, proceeding with withdrawal');

        onEvent({
            type: 'deposit:preparing_withdrawal',
            message: 'Submitting withdrawal transaction...',
            progress: 30
        });

        // Execute withdrawal from privacy mixer
        console.log('🔄 UmbraMix Withdraw: Executing withdrawal from privacy mixer...');
        const withdrawalResult = await walletClient.withdrawFromMixer(
            depositResult.nullifier,
            depositResult.commitmentHash,
            recipientAddress,
            amountBigInt,
            proof
        );

        console.log('🔄 UmbraMix Withdraw: Withdrawal transaction submitted:', withdrawalResult);

        onEvent({
            type: 'deposit:withdrawn_for_mixing',
            message: `Withdrawal submitted: ${withdrawalResult}`,
            progress: 35
        });

        // Wait for withdrawal confirmation
        console.log('🔄 UmbraMix Withdraw: Waiting for withdrawal confirmation...');
        const confirmedWithdrawal = await walletClient.waitForTransaction(withdrawalResult);
        console.log('🔄 UmbraMix Withdraw: Withdrawal confirmed:', confirmedWithdrawal);

        if (confirmedWithdrawal.status === 'REJECTED') {
            throw new Error('Withdrawal transaction was rejected by the network');
        }

        onEvent({
            type: 'deposit:withdrawn_for_mixing',
            message: 'STRK successfully withdrawn from privacy mixer for mixing pipeline',
            progress: 40
        });

        console.log('🔄 UmbraMix Withdraw: Step completed successfully');
        console.log('🔄 UmbraMix Withdraw: Funds are now available for Lightning/Cashu mixing');

        const txHash = (confirmedWithdrawal as any).transactionHash || (confirmedWithdrawal as any).transaction_hash || withdrawalResult;
        console.log('🔄 UmbraMix Withdraw: Determined withdrawal tx hash:', txHash);
        return {
            withdrawalTxHash: txHash,
            availableForSwap: true,
            controllingWallet: recipientAddress,
            amount: depositResult.amount,
            amountWei: depositResult.amountWei,
            originalDeposit: depositResult
        };

    } catch (error) {
        console.error('❌ UmbraMix Withdraw: Step failed:', error);
        onEvent({
            type: 'deposit:error',
            message: error instanceof Error ? error.message : 'Unknown withdrawal error'
        });
        throw error;
    }
}
