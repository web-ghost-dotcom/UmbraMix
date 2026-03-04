import { OrchestratorEvent } from '@/lib/types';
import { stepDeposit } from './deposit';
import { stepWithdrawForMixing } from './withdrawForMixing';
import { stepDynamicEstimateSats } from './dynamicEstimateSats';
import { stepCreateMintInvoice } from './createMintInvoice';
import { stepSwapToLightning } from './swapToLightning';
import { stepClaimCashuProofs } from './claimCashuProofs';

export interface IssueCashuResult {
    token: string; // Serialized Cashu token
    amount: number; // STRK amount
    satsValue: number; // sats value of the token
    mintUrl: string;
    depositInfo: {
        commitmentHash: string;
        secret: string;
        nullifier: string;
        mixerContractAddress: string;
    };
}

/** Shape returned after step 1 (deposit). Passed back in for step 2. */
export interface DepositStepResult {
    [key: string]: unknown;
    transactionHash: string;
    amount: number;
    amountWei: string;
    walletAddress: string;
    commitmentHash: string;
    secret: string;
    nullifier: string;
    mixerContractAddress: string;
    withdrawalReady: boolean;
    withdrawalDone?: boolean;
    withdrawalTxHash?: string;
    withdrawalRecipient?: string;
}

/**
 * Step 1 of the Issue flow: Deposit STRK to the privacy mixer.
 * Returns a DepositStepResult that must be passed to issueCashuStep2().
 *
 * This is a separate function so the UI can display a "Step 2" button
 * after the deposit confirms — giving the browser a fresh user-gesture
 * context so Braavos will show the withdrawal signing popup.
 */
export async function issueCashuStep1(
    amountStrk: number,
    onEvent: (e: OrchestratorEvent) => void
): Promise<DepositStepResult> {
    console.log('🎫 UmbraMix Issue Token Step 1: Depositing', amountStrk, 'STRK');

    onEvent({ type: 'issue:progress', message: 'Depositing STRK to privacy mixer...', progress: 10 });

    const depositResult = await stepDeposit(amountStrk, (e) => {
        if (e.type === 'deposit:initiated') {
            onEvent({ type: 'issue:progress', message: e.message, progress: 12 });
        } else if (e.type === 'deposit:wallet_connected') {
            onEvent({ type: 'issue:progress', message: e.message, progress: 15 });
        } else if (e.type === 'deposit:balance_checked') {
            onEvent({ type: 'issue:progress', message: e.message, progress: 18 });
        } else if (e.type === 'deposit:confirmed') {
            onEvent({ type: 'issue:progress', message: 'Deposit confirmed ✓', progress: 20 });
        }
    });

    console.log('✅ UmbraMix Issue Token Step 1 complete:', {
        commitment: depositResult.commitmentHash.slice(0, 10) + '...',
        amount: depositResult.amount
    });

    onEvent({ type: 'issue:deposit_done', message: 'Deposit confirmed. Click to complete the withdrawal.', progress: 20 });

    return depositResult;
}

/**
 * Step 2 of the Issue flow: Withdraw → swap → mint.
 * Must be called from a user-click handler (browser requires user gesture
 * for wallet popup). Pass the DepositStepResult from issueCashuStep1().
 */
export async function issueCashuStep2(
    depositResult: DepositStepResult,
    onEvent: (e: OrchestratorEvent) => void
): Promise<IssueCashuResult> {
    console.log('🎫 UmbraMix Issue Token Step 2: Withdraw → swap → mint');

    try {
        // Step 2: Withdraw from mixer (triggers wallet popup — must be in user gesture)
        onEvent({ type: 'issue:progress', message: 'Withdrawing from mixer for swap...', progress: 25 });

        const withdrawalResult = await stepWithdrawForMixing(depositResult, (e) => {
            if (e.type === 'deposit:preparing_withdrawal') {
                onEvent({ type: 'issue:progress', message: e.message, progress: 28 });
            }
        });

        console.log('✅ UmbraMix Issue Token: Withdrawal complete');

        // Step 3: Estimate STRK→sats conversion
        onEvent({ type: 'issue:progress', message: 'Estimating conversion rate...', progress: 35 });
        const dynamicEstimate = await stepDynamicEstimateSats(withdrawalResult.amount, onEvent);

        // Step 4: Create Cashu mint invoice
        onEvent({ type: 'issue:progress', message: 'Creating Cashu mint invoice...', progress: 40 });
        const mintInvoiceResult = await stepCreateMintInvoice(dynamicEstimate.satsOut, onEvent);

        // Step 5: Swap STRK→Lightning via Atomiq
        onEvent({ type: 'issue:progress', message: 'Swapping STRK to Lightning...', progress: 50 });
        const lightningResult = await stepSwapToLightning(
            withdrawalResult.amount,
            {
                walletAddress: withdrawalResult.originalDeposit.walletAddress,
                mixerContractAddress: withdrawalResult.originalDeposit.mixerContractAddress,
                fundsAvailable: withdrawalResult.availableForSwap
            },
            mintInvoiceResult,
            onEvent
        );

        console.log('✅ UmbraMix Issue Token: Lightning swap complete');

        // Step 6: Claim Cashu proofs from mint
        onEvent({ type: 'issue:progress', message: 'Claiming Cashu token...', progress: 75 });
        const cashuProofs = await stepClaimCashuProofs(
            mintInvoiceResult.mintQuote,
            mintInvoiceResult.cashu,
            dynamicEstimate.satsOut,
            onEvent
        );

        // Step 7: Serialize proofs as bearer token
        onEvent({ type: 'issue:progress', message: 'Creating bearer token...', progress: 90 });
        const serializedToken = mintInvoiceResult.cashu.createToken(cashuProofs);

        onEvent({ type: 'issue:complete', message: 'Token issued successfully!', progress: 100 });

        return {
            token: serializedToken,
            amount: depositResult.amount,
            satsValue: dynamicEstimate.satsOut,
            mintUrl: mintInvoiceResult.mintQuote.request || 'unknown',
            depositInfo: {
                commitmentHash: depositResult.commitmentHash,
                secret: depositResult.secret,
                nullifier: depositResult.nullifier,
                mixerContractAddress: depositResult.mixerContractAddress
            }
        };

    } catch (error: any) {
        console.error('❌ UmbraMix Issue Token Step 2 Error:', error);
        onEvent({ type: 'issue:error', message: error.message || 'Failed during withdrawal/swap/mint' });
        throw error;
    }
}

/**
 * Legacy combined flow (kept for backward compat).
 * Calls step1 then immediately step2 — only works if wallet popups
 * aren't blocked (e.g. in dev when popup-blocker is off).
 */
export async function issueCashuToken(
    amountStrk: number,
    onEvent: (e: OrchestratorEvent) => void
): Promise<IssueCashuResult> {
    const depositResult = await issueCashuStep1(amountStrk, onEvent);
    return issueCashuStep2(depositResult, onEvent);
}


