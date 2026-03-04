import { OrchestratorEvent } from '@/lib/types';
import { RealStarknetWalletClient } from '@/integrations/starknet/wallet';
import { ENV } from '@/config/env';
import { PRIVACY_MIXER } from '@/config/constants';
import { num, CallData, cairo } from 'starknet';
import { generateCommitmentArtifacts, generateSecret } from '@/utils/zk';

// Starknet addresses (mainnet)
const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'; // STRK on mainnet
const MIXER_CONTRACT_ADDRESS = ENV.MIXER_CONTRACT_ADDRESS || PRIVACY_MIXER.CONTRACT_ADDRESS; // Use environment config first

export async function stepDeposit(amountStrk: number, onEvent: (e: OrchestratorEvent) => void) {
    console.log('💰 UmbraMix Deposit: Starting deposit step');
    console.log('💰 UmbraMix Deposit: Amount requested:', amountStrk, 'STRK');

    try {
        // Fast sanity check: current deployed contract min deposit is 1 STRK (1e18 wei)
        // (See PRIVACY_MIXER.DEPLOYMENT_PARAMS.MIN_DEPOSIT). If user enters < 1 it will revert
        // on-chain with a generic Execute failed (assert Amount below minimum) which is hard
        // to decode client-side right now.
        const configuredMinDepositWei = PRIVACY_MIXER.DEPLOYMENT_PARAMS.MIN_DEPOSIT; // bigint (wei)
        const configuredMinDepositStrk = Number(configuredMinDepositWei) / 1e18; // for log (only safe here since value is small: 1e18)
        if (amountStrk < configuredMinDepositStrk) {
            const friendlyMsg = `Requested amount ${amountStrk} STRK is below current minimum deposit (${configuredMinDepositStrk} STRK). Increase amount or redeploy with lower MIN_DEPOSIT.`;
            console.warn('⚠️ UmbraMix Deposit: Early rejection -', friendlyMsg);
            onEvent({ type: 'deposit:error', message: friendlyMsg });
            throw new Error(friendlyMsg);
        }

        onEvent({ type: 'deposit:initiated', message: 'Connecting to Starknet wallet...' });
        console.log('💰 UmbraMix Deposit: Initializing wallet client...');

        // Initialize Starknet wallet client
        const walletClient = new RealStarknetWalletClient(ENV.STARKNET_RPC);

        // Connect to wallet (ArgentX/Braavos)
        console.log('💰 UmbraMix Deposit: Connecting wallet...');
        const connection = await walletClient.connect();
        console.log('💰 UmbraMix Deposit: Wallet connected:', {
            address: connection.account.address,
            walletType: connection.walletType
        });

        onEvent({ type: 'deposit:wallet_connected', message: 'Wallet connected successfully' });

        // Initialize mixer contract
        console.log('💰 UmbraMix Deposit: Initializing privacy mixer contract...');
        await walletClient.initMixerContract(MIXER_CONTRACT_ADDRESS);
        console.log('💰 UmbraMix Deposit: Mixer contract initialized');

        // Check STRK balance
        console.log('💰 UmbraMix Deposit: Checking STRK balance...');
        const balance = await walletClient.getBalance(STRK_TOKEN_ADDRESS);
        // Use decimal math carefully – avoid floating point drift by converting string
        const scaled = BigInt(Math.round(Number(amountStrk) * 10 ** balance.decimals));
        const amountWei = scaled;

        // Validate amount doesn't exceed felt limit (2^251 - 1)
        const FELT_MAX = BigInt('0x800000000000011000000000000000000000000000000000000000000000000') - BigInt(1);
        if (amountWei > FELT_MAX) {
            throw new Error(`Amount too large for Starknet felt: ${amountWei.toString()}`);
        }

        console.log('💰 UmbraMix Deposit: Balance check:', {
            tokenAddress: STRK_TOKEN_ADDRESS,
            symbol: balance.symbol,
            onChainBalanceWei: balance.balance.toString(),
            onChainBalanceSTRK: Number(balance.balance) / Math.pow(10, balance.decimals),
            decimals: balance.decimals,
            requestedAmountWei: amountWei.toString(),
            requestedAmountSTRK: amountStrk,
            requestedAmountHex: '0x' + amountWei.toString(16),
            minDepositWei: configuredMinDepositWei.toString(),
            minDepositSTRK: configuredMinDepositStrk
        });

        if (balance.balance < amountWei) {
            throw new Error(`Insufficient STRK balance. Required: ${amountStrk} STRK, Available: ${Number(balance.balance) / Math.pow(10, balance.decimals)} STRK`);
        }

        onEvent({ type: 'deposit:balance_checked', message: `Balance confirmed: ${Number(balance.balance) / Math.pow(10, balance.decimals)} STRK available` });

        // Generate correct commitment/nullifier per contract spec
        console.log('💰 UmbraMix Deposit: Generating commitment & nullifier (contract spec)...');
        const secretHex = generateSecret();
        const amountBigInt = BigInt(amountWei.toString());
        const artifacts = generateCommitmentArtifacts(secretHex, amountBigInt);
        console.log('💰 UmbraMix Deposit: Generated artifacts:', {
            secret: artifacts.secret.slice(0, 10) + '...',
            commitment: artifacts.commitment,
            nullifier: artifacts.nullifier.slice(0, 10) + '...'
        });

        onEvent({ type: 'deposit:balance_checked', message: 'Privacy commitment generated' });

        // Combine approve + deposit into a single multicall — one Braavos popup.
        // The withdrawal is intentionally NOT included here because the contract
        // enforces a minimum mixing delay (4s), so deposit+withdraw cannot be in
        // the same block. The withdrawal is triggered by the user as a separate
        // click gesture in the UI (step 2).
        console.log('💰 UmbraMix Deposit: Submitting approve + deposit multicall...');

        const commitmentFelt = artifacts.commitment.startsWith('0x')
            ? artifacts.commitment : '0x' + artifacts.commitment;

        const multicallResult = await walletClient.sendTransaction([
            // call 1: approve STRK spending by mixer
            {
                contractAddress: STRK_TOKEN_ADDRESS,
                entrypoint: 'approve',
                calldata: CallData.compile([MIXER_CONTRACT_ADDRESS, cairo.uint256(amountWei)])
            },
            // call 2: deposit into privacy mixer
            {
                contractAddress: MIXER_CONTRACT_ADDRESS,
                entrypoint: 'deposit',
                calldata: CallData.compile([commitmentFelt, cairo.uint256(amountWei)])
            }
        ]);
        console.log('💰 UmbraMix Deposit: Approve+Deposit multicall submitted:', multicallResult);

        onEvent({ type: 'deposit:transfer_submitted', message: `Approve+Deposit submitted: ${multicallResult.transactionHash}` });

        // Wait for multicall confirmation
        console.log('💰 UmbraMix Deposit: Waiting for approve+deposit confirmation...');
        const confirmedTx = await walletClient.waitForTransaction(multicallResult.transactionHash);
        console.log('💰 UmbraMix Deposit: Approve+Deposit confirmed:', confirmedTx);

        if (confirmedTx.status === 'REJECTED') {
            throw new Error('Approve+Deposit transaction was rejected by the network');
        }

        onEvent({ type: 'deposit:confirmed', message: 'STRK deposited into privacy mixer', progress: 20 });
        console.log('💰 UmbraMix Deposit: Step completed successfully');

        const commitmentHashHex = artifacts.commitment;

        return {
            transactionHash: confirmedTx.transactionHash,
            amount: amountStrk,
            amountWei: amountWei.toString(),
            walletAddress: connection.account.address,
            commitmentHash: commitmentHashHex,
            secret: artifacts.secret,
            nullifier: artifacts.nullifier,
            mixerContractAddress: MIXER_CONTRACT_ADDRESS,
            withdrawalReady: true
        };

    } catch (error) {
        // Attempt to refine common failure causes
        let refined = error instanceof Error ? error.message : 'Unknown deposit error';
        if (/Execute failed/i.test(refined)) {
            refined = refined + ' (Possible causes: amount below MIN_DEPOSIT, insufficient allowance, or token transfer_from failure)';
        }
        console.error('❌ UmbraMix Deposit: Step failed:', error);
        onEvent({ type: 'deposit:error', message: refined });
        throw new Error(refined);
    }
}
