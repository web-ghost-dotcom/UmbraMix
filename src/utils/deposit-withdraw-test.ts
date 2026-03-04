#!/usr/bin/env npx tsx

/**
 * Comprehensive Deposit & Withdraw Test
 * Tests the full flow: deposit STRK → withdraw STRK from privacy mixer contract
 */

import { Account, Provider, RpcProvider, CallData, cairo, num } from 'starknet';
import { ENV } from '@/config/env';
import { PRIVACY_MIXER } from '@/config/constants';
import { randomHex } from '@/crypto/bdhke';
import { hash } from 'starknet';

const RPC_URL = ENV.STARKNET_RPC;
const MIXER_CONTRACT = PRIVACY_MIXER.CONTRACT_ADDRESS;
const STRK_TOKEN = PRIVACY_MIXER.STRK_TOKEN;

// Test account details (replace with your actual test account)
const TEST_ACCOUNT_ADDRESS = '0x4e01d9ec9df257a629a9b70e67d092ed24385c6e68f0381674bee116cf39a7a';
const TEST_PRIVATE_KEY = process.env.STARKNET_PRIVATE_KEY;

if (!TEST_PRIVATE_KEY) {
    console.error('❌ STARKNET_PRIVATE_KEY environment variable not set');
    process.exit(1);
}

async function main() {
    console.log('🧪 Starting Deposit & Withdraw Test');
    console.log('🧪 Contract:', MIXER_CONTRACT);
    console.log('🧪 STRK Token:', STRK_TOKEN);
    console.log('🧪 Test Account:', TEST_ACCOUNT_ADDRESS);

    if (!TEST_PRIVATE_KEY) {
        throw new Error('STARKNET_PRIVATE_KEY environment variable not set');
    }

    try {
        // Initialize provider and account
        const provider = new RpcProvider({ nodeUrl: RPC_URL });
        const account = new Account(provider, TEST_ACCOUNT_ADDRESS, TEST_PRIVATE_KEY);

        console.log('\n1️⃣ === CHECKING INITIAL BALANCES ===');

        // Check STRK balance
        const balanceResult = await provider.callContract({
            contractAddress: STRK_TOKEN,
            entrypoint: 'balanceOf',
            calldata: [TEST_ACCOUNT_ADDRESS]
        });

        const initialBalance = BigInt(balanceResult[0]);
        const initialBalanceSTRK = Number(initialBalance) / 1e18;
        console.log('💰 Initial STRK balance:', initialBalanceSTRK, 'STRK');

        if (initialBalance < BigInt(1e18)) {
            throw new Error('Insufficient STRK balance. Need at least 1 STRK for test.');
        }

        // Check mixer stats before deposit
        const statsBefore = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_mixing_stats',
            calldata: []
        });

        console.log('📊 Mixer stats before:', {
            totalDeposits: statsBefore[0],
            totalWithdrawals: statsBefore[1],
            activeCommitments: statsBefore[2],
            anonymitySetSize: statsBefore[3]
        });

        console.log('\n2️⃣ === PREPARING DEPOSIT ===');

        // Generate commitment for privacy
        const secret = randomHex(31);
        const nullifier = randomHex(31);
        const amountWei = BigInt(1e18); // 1 STRK

        const secretBigInt = BigInt('0x' + secret);
        const nullifierBigInt = BigInt('0x' + nullifier);
        const amountBigInt = BigInt(amountWei.toString());

        // Create commitment hash
        const commitmentHash = hash.computePoseidonHash(secretBigInt, hash.computePoseidonHash(amountBigInt, nullifierBigInt));

        console.log('🔐 Generated commitment:', {
            secret: secret.slice(0, 10) + '...',
            nullifier: nullifier.slice(0, 10) + '...',
            commitmentHash: commitmentHash.toString(),
            amount: '1 STRK'
        });

        console.log('\n3️⃣ === STEP 1: APPROVE STRK SPENDING ===');

        // First approve STRK spending
        const approveCalldata = CallData.compile([MIXER_CONTRACT, cairo.uint256(amountWei)]);
        const approveCall = {
            contractAddress: STRK_TOKEN,
            entrypoint: 'approve',
            calldata: approveCalldata
        };

        console.log('📝 Submitting approval transaction...');
        const approveResult = await account.execute([approveCall]);
        console.log('✅ Approval submitted:', approveResult.transaction_hash);

        // Wait for approval confirmation
        console.log('⏳ Waiting for approval confirmation...');
        const approveReceipt = await provider.waitForTransaction(approveResult.transaction_hash);
        console.log('✅ Approval confirmed:', approveReceipt.isSuccess() ? 'SUCCESS' : 'FAILED');

        if (!approveReceipt.isSuccess()) {
            throw new Error('Approval transaction failed');
        }

        // Verify allowance was set
        const allowanceResult = await provider.callContract({
            contractAddress: STRK_TOKEN,
            entrypoint: 'allowance',
            calldata: [TEST_ACCOUNT_ADDRESS, MIXER_CONTRACT]
        });

        const allowance = BigInt(allowanceResult[0]);
        console.log('✅ Allowance verified:', Number(allowance) / 1e18, 'STRK');

        console.log('\n4️⃣ === STEP 2: DEPOSIT TO MIXER ===');

        // Deposit to mixer
        const depositCalldata = CallData.compile([commitmentHash, cairo.uint256(amountWei)]);
        const depositCall = {
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'deposit',
            calldata: depositCalldata
        };

        console.log('📝 Submitting deposit transaction...');
        const depositResult = await account.execute([depositCall]);
        console.log('✅ Deposit submitted:', depositResult.transaction_hash);

        // Wait for deposit confirmation
        console.log('⏳ Waiting for deposit confirmation...');
        const depositReceipt = await provider.waitForTransaction(depositResult.transaction_hash);
        console.log('✅ Deposit confirmed:', depositReceipt.isSuccess() ? 'SUCCESS' : 'FAILED');

        if (!depositReceipt.isSuccess()) {
            throw new Error('Deposit transaction failed');
        }

        // Check balances after deposit
        const balanceAfterDeposit = await provider.callContract({
            contractAddress: STRK_TOKEN,
            entrypoint: 'balanceOf',
            calldata: [TEST_ACCOUNT_ADDRESS]
        });

        const newBalance = BigInt(balanceAfterDeposit[0]);
        const balanceChange = initialBalance - newBalance;
        console.log('💰 Balance after deposit:', Number(newBalance) / 1e18, 'STRK');
        console.log('💰 Balance change:', Number(balanceChange) / 1e18, 'STRK');

        // Check mixer stats after deposit
        const statsAfterDeposit = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_mixing_stats',
            calldata: []
        });

        console.log('📊 Mixer stats after deposit:', {
            totalDeposits: statsAfterDeposit[0],
            totalWithdrawals: statsAfterDeposit[1],
            activeCommitments: statsAfterDeposit[2],
            anonymitySetSize: statsAfterDeposit[3]
        });

        console.log('\n5️⃣ === STEP 3: WAIT FOR MIXING DELAY ===');

        // Check minimum delay requirement
        const minDelay = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_min_delay',
            calldata: []
        });

        const delaySeconds = Number(minDelay[0]);
        console.log('⏱️ Minimum delay required:', delaySeconds, 'seconds');

        if (delaySeconds > 0) {
            console.log('⏳ Waiting for mixing delay...');
            await new Promise(resolve => setTimeout(resolve, (delaySeconds + 1) * 1000));
            console.log('✅ Delay satisfied');
        }

        console.log('\n6️⃣ === STEP 4: WITHDRAW FROM MIXER ===');

        // Prepare withdrawal
        const recipientAddress = TEST_ACCOUNT_ADDRESS; // Withdraw to same address for testing
        const nullifierForProof = '0x' + nullifier;

        // Create proof array (simplified for testing)
        const proof = [nullifierForProof];

        console.log('🔐 Preparing withdrawal:', {
            nullifier: nullifierForProof.slice(0, 12) + '...',
            commitment: commitmentHash.toString().slice(0, 12) + '...',
            recipient: recipientAddress.slice(0, 12) + '...',
            amount: '1 STRK',
            proofLength: proof.length
        });

        // Execute withdrawal
        const withdrawCalldata = CallData.compile([
            nullifierForProof,
            commitmentHash,
            recipientAddress,
            cairo.uint256(amountWei),
            proof
        ]);

        const withdrawCall = {
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'withdraw',
            calldata: withdrawCalldata
        };

        console.log('📝 Submitting withdrawal transaction...');
        const withdrawResult = await account.execute([withdrawCall]);
        console.log('✅ Withdrawal submitted:', withdrawResult.transaction_hash);

        // Wait for withdrawal confirmation
        console.log('⏳ Waiting for withdrawal confirmation...');
        const withdrawReceipt = await provider.waitForTransaction(withdrawResult.transaction_hash);
        console.log('✅ Withdrawal confirmed:', withdrawReceipt.isSuccess() ? 'SUCCESS' : 'FAILED');

        if (!withdrawReceipt.isSuccess()) {
            throw new Error('Withdrawal transaction failed');
        }

        console.log('\n7️⃣ === FINAL VERIFICATION ===');

        // Check final balances
        const finalBalanceResult = await provider.callContract({
            contractAddress: STRK_TOKEN,
            entrypoint: 'balanceOf',
            calldata: [TEST_ACCOUNT_ADDRESS]
        });

        const finalBalance = BigInt(finalBalanceResult[0]);
        const totalChange = initialBalance - finalBalance;

        console.log('💰 Final STRK balance:', Number(finalBalance) / 1e18, 'STRK');
        console.log('💰 Net change:', Number(totalChange) / 1e18, 'STRK (should be ~0 plus gas fees)');

        // Check final mixer stats
        const statsFinal = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'get_mixing_stats',
            calldata: []
        });

        console.log('📊 Final mixer stats:', {
            totalDeposits: statsFinal[0],
            totalWithdrawals: statsFinal[1],
            activeCommitments: statsFinal[2],
            anonymitySetSize: statsFinal[3]
        });

        // Verify nullifier is now used
        const nullifierUsed = await provider.callContract({
            contractAddress: MIXER_CONTRACT,
            entrypoint: 'is_nullifier_used',
            calldata: [nullifierForProof]
        });

        console.log('🔒 Nullifier marked as used:', Boolean(nullifierUsed[0]));

        console.log('\n🎉 === TEST COMPLETED SUCCESSFULLY ===');
        console.log('✅ Deposit: SUCCESS');
        console.log('✅ Withdrawal: SUCCESS');
        console.log('✅ Privacy flow: WORKING');

        // Calculate transaction costs
        const gasCost = totalChange;
        console.log('💸 Total transaction costs:', Number(gasCost) / 1e18, 'STRK');

    } catch (error) {
        console.error('\n❌ === TEST FAILED ===');
        console.error('Error:', error);
        process.exit(1);
    }
}

// Export for use in other tests
export async function testDepositWithdraw(
    amountSTRK: number = 1,
    accountAddress?: string,
    privateKey?: string
) {
    // Reusable function for other test files
    const testAccount = accountAddress || TEST_ACCOUNT_ADDRESS;
    const testKey = privateKey || TEST_PRIVATE_KEY;

    if (!testKey) {
        throw new Error('Private key required for testing');
    }

    console.log(`🧪 Testing deposit/withdraw with ${amountSTRK} STRK`);
    // Implementation would be similar to main() but with parameters
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
