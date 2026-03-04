import { RpcProvider, Account, ec, CallData, hash, Contract } from 'starknet';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const CONFIG = {
    RPC_URL: process.env.STARKNET_RPC || 'https://starknet-sepolia.g.alchemy.com/v2/kwgGr9GGk4YyLXuGfEvpITv1jpvn3PgP',
    PRIVATE_KEY: process.env.SENDER_PRIVATE_KEY!,
    PROVIDED_ADDRESS: process.env.SENDER_ADDRESS!,
    ETH_TOKEN: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // Sepolia ETH
    STRK_TOKEN: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', // Sepolia STRK
};

// Braavos account class hash (this is the standard Braavos account class hash)
const BRAAVOS_ACCOUNT_CLASS_HASH = '0x03131fa018d520a037686ce3efddeab8f28895662f019ca3ca18a626650f7d1e';

async function deployBraavosAccount() {
    console.log('🚀 Deploying Braavos Account on Starknet Sepolia Testnet');
    console.log('='.repeat(60));

    const provider = new RpcProvider({ nodeUrl: CONFIG.RPC_URL });

    // Calculate public key from private key
    const publicKey = ec.starkCurve.getStarkKey(CONFIG.PRIVATE_KEY);
    console.log('🔑 Private Key:', CONFIG.PRIVATE_KEY);
    console.log('🔑 Public Key:', publicKey);
    console.log('📍 Expected Address:', CONFIG.PROVIDED_ADDRESS);

    try {
        // Check if account is already deployed
        const classHash = await provider.getClassHashAt(CONFIG.PROVIDED_ADDRESS);
        console.log('✅ Account is already deployed! Class hash:', classHash);

        // Check balances
        await checkBalances(provider, CONFIG.PROVIDED_ADDRESS);
        return;

    } catch (error) {
        console.log('📝 Account not deployed yet, proceeding with deployment...');
    }

    try {
        // For Braavos, we need to use the correct constructor calldata
        // Braavos uses a specific constructor format
        const constructorCalldata = CallData.compile({
            public_key: publicKey
        });

        // Calculate the contract address
        const contractAddress = hash.calculateContractAddressFromHash(
            publicKey, // salt (Braavos uses public key as salt)
            BRAAVOS_ACCOUNT_CLASS_HASH,
            constructorCalldata,
            0 // deployer address (0 for deploy_account)
        );

        console.log('🧮 Calculated Address:', contractAddress);
        console.log('📋 Expected Address:  ', CONFIG.PROVIDED_ADDRESS);

        if (contractAddress.toLowerCase() !== CONFIG.PROVIDED_ADDRESS.toLowerCase()) {
            console.log('⚠️  Address mismatch! The provided address may not be correct for this private key.');
            console.log('');
            console.log('🔧 Solutions:');
            console.log('1. Use the calculated address:', contractAddress);
            console.log('2. Or check if you have the correct private key for the provided address');
            console.log('3. Make sure you are using the Braavos account format');

            // Ask user if they want to continue with calculated address
            console.log('');
            console.log('Would you like to:');
            console.log('A) Update .env.local with the calculated address');
            console.log('B) Use your Braavos wallet to get the correct private key');
            console.log('');
            console.log('For option A, update your .env.local file:');
            console.log(`SENDER_ADDRESS=${contractAddress}`);

            return;
        }

        // Create account instance for deployment
        const account = new Account(provider, contractAddress, CONFIG.PRIVATE_KEY);

        // Deploy the account
        console.log('📤 Deploying account...');

        const deployResponse = await account.deployAccount({
            classHash: BRAAVOS_ACCOUNT_CLASS_HASH,
            constructorCalldata,
            contractAddress,
            addressSalt: publicKey,
        });

        console.log('🔄 Transaction hash:', deployResponse.transaction_hash);
        console.log('⏳ Waiting for transaction confirmation...');

        // Wait for transaction
        await provider.waitForTransaction(deployResponse.transaction_hash);

        console.log('✅ Account deployed successfully!');
        console.log('📍 Deployed Address:', contractAddress);

        // Check balances after deployment
        await checkBalances(provider, contractAddress);

    } catch (error) {
        console.error('❌ Deployment failed:', error);

        if (error instanceof Error && error.message.includes('insufficient account balance')) {
            console.log('');
            console.log('💡 You need some ETH for deployment fees. Please:');
            console.log('1. Visit a Starknet Sepolia faucet (e.g., https://starknet-faucet.vercel.app)');
            console.log('2. Request some ETH for address:', CONFIG.PROVIDED_ADDRESS);
            console.log('3. Wait a few minutes and try again');
        }
    }
}

async function checkBalances(provider: RpcProvider, address: string) {
    console.log('');
    console.log('💰 Checking balances...');

    try {
        // Check ETH balance
        const ethBalance = await provider.callContract({
            contractAddress: CONFIG.ETH_TOKEN,
            entrypoint: 'balance_of',
            calldata: [address]
        });

        const ethAmount = BigInt(ethBalance[0]) / BigInt(10 ** 18);
        console.log(`💎 ETH Balance: ${ethAmount} ETH`);

        // Check STRK balance
        const strkBalance = await provider.callContract({
            contractAddress: CONFIG.STRK_TOKEN,
            entrypoint: 'balance_of',
            calldata: [address]
        });

        const strkAmount = BigInt(strkBalance[0]) / BigInt(10 ** 18);
        console.log(`⚡ STRK Balance: ${strkAmount} STRK`);

        if (ethAmount === 0n && strkAmount === 0n) {
            console.log('');
            console.log('⚠️  No funds detected. You may need to:');
            console.log('1. Request funds from Starknet Sepolia faucets');
            console.log('2. Transfer some ETH/STRK to this address for testing');
        }

    } catch (error) {
        console.log('❌ Error checking balances:', error instanceof Error ? error.message : String(error));
    }
}

async function main() {
    try {
        await deployBraavosAccount();

        console.log('');
        console.log('🎉 Setup complete! You can now run the E2E test:');
        console.log('npm run test:mixer');

    } catch (error) {
        console.error('💥 Error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
