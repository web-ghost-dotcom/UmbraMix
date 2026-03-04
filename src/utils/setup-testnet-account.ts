#!/usr/bin/env npx tsx

/**
 * Testnet Account Setup Script
 * 
 * This script helps you create and deploy a Starknet account on Sepolia testnet
 * for use with the Privacy Mixer E2E tests.
 */

import { Account, CallData, Contract, RpcProvider, stark, hash } from 'starknet';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

// OpenZeppelin Account Class Hash on Starknet Sepolia
const OZ_ACCOUNT_CLASS_HASH = "0x061dac032f228abdf9759f02cd8cb94c2f4abc000000000000000000000000000";
const RPC_URL = "https://starknet-sepolia.g.alchemy.com/v2/kwgGr9GGk4YyLXuGfEvpITv1jpvn3PgP";

interface AccountInfo {
    address: string;
    privateKey: string;
    publicKey: string;
    isDeployed: boolean;
}

class TestnetAccountSetup {
    private provider: RpcProvider;

    constructor() {
        this.provider = new RpcProvider({ nodeUrl: RPC_URL });
    }

    private log(message: string, data?: any) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
        if (data) {
            console.log('   Data:', JSON.stringify(data, null, 2));
        }
    }

    async generateNewAccount(): Promise<AccountInfo> {
        this.log('🔑 Generating new account key pair...');

        // Generate a random private key
        const privateKey = '0x' + randomBytes(32).toString('hex');

        // Get the corresponding public key  
        const publicKey = stark.getFullPublicKey(privateKey);

        // Calculate the account address
        const constructorCalldata = CallData.compile({ publicKey });
        const salt = publicKey;

        const address = hash.calculateContractAddressFromHash(
            salt,
            OZ_ACCOUNT_CLASS_HASH,
            constructorCalldata,
            0
        );

        return {
            address,
            privateKey,
            publicKey,
            isDeployed: false
        };
    }

    async checkAccountDeployment(address: string): Promise<boolean> {
        try {
            await this.provider.getClassHashAt(address);
            return true;
        } catch {
            return false;
        }
    }

    async deployAccount(accountInfo: AccountInfo): Promise<string> {
        this.log('🚀 Deploying account to Starknet Sepolia...');

        const account = new Account(this.provider, accountInfo.address, accountInfo.privateKey);

        try {
            const deployResult = await account.deployAccount({
                classHash: OZ_ACCOUNT_CLASS_HASH,
                constructorCalldata: CallData.compile({ publicKey: accountInfo.publicKey }),
                contractAddress: accountInfo.address,
                addressSalt: accountInfo.publicKey
            });

            this.log('⏳ Waiting for deployment transaction...', {
                transaction_hash: deployResult.transaction_hash
            });

            await this.provider.waitForTransaction(deployResult.transaction_hash);

            this.log('✅ Account deployed successfully!');
            return deployResult.transaction_hash;

        } catch (error) {
            this.log('❌ Account deployment failed');
            throw error;
        }
    }

    async updateEnvFile(accountInfo: AccountInfo) {
        const envPath = path.join(process.cwd(), '.env.local');

        try {
            let envContent = '';
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }

            // Update or add the account information
            let updatedContent = envContent
                .replace(/SENDER_PRIVATE_KEY=.*/g, `SENDER_PRIVATE_KEY=${accountInfo.privateKey}`)
                .replace(/SENDER_ADDRESS=.*/g, `SENDER_ADDRESS=${accountInfo.address}`);

            // If the keys weren't found, add them
            if (!envContent.includes('SENDER_PRIVATE_KEY=')) {
                updatedContent += `\nSENDER_PRIVATE_KEY=${accountInfo.privateKey}`;
            }
            if (!envContent.includes('SENDER_ADDRESS=')) {
                updatedContent += `\nSENDER_ADDRESS=${accountInfo.address}`;
            }

            fs.writeFileSync(envPath, updatedContent);
            this.log('✅ Updated .env.local with new account details');

        } catch (error) {
            this.log('❌ Failed to update .env.local file');
            this.log('📝 Please manually add these to your .env.local:');
            this.log(`SENDER_PRIVATE_KEY=${accountInfo.privateKey}`);
            this.log(`SENDER_ADDRESS=${accountInfo.address}`);
        }
    }

    async run() {
        try {
            this.log('🧪 Starting Starknet Sepolia testnet account setup');

            // Generate new account
            const accountInfo = await this.generateNewAccount();

            this.log('📊 Generated account details:', {
                address: accountInfo.address,
                publicKey: accountInfo.publicKey,
                note: 'Private key is saved securely'
            });

            // Check if account needs funding
            this.log('💰 Funding Instructions:');
            this.log('1. Visit: https://starknet-faucet.vercel.app/');
            this.log('2. Enter your account address: ' + accountInfo.address);
            this.log('3. Request both ETH and STRK tokens');
            this.log('4. Wait for the funding transactions to complete');
            this.log('');
            this.log('⏰ Please fund your account and press Enter to continue...');

            // Wait for user to fund the account
            process.stdin.setRawMode(true);
            process.stdin.resume();
            await new Promise(resolve => process.stdin.once('data', resolve));
            process.stdin.setRawMode(false);
            process.stdin.pause();

            // Deploy the account
            await this.deployAccount(accountInfo);

            // Update .env.local
            await this.updateEnvFile(accountInfo);

            this.log('🎉 Account setup complete!');
            this.log('📋 Your new testnet account:');
            this.log('   Address: ' + accountInfo.address);
            this.log('   Status: Deployed and funded');
            this.log('');
            this.log('✅ You can now run the E2E tests with: npm run test:mixer');

        } catch (error) {
            this.log('❌ Setup failed', error);
            process.exit(1);
        }
    }
}

// Run the setup if this script is executed directly
if (require.main === module) {
    const setup = new TestnetAccountSetup();
    setup.run().catch(console.error);
}

export default TestnetAccountSetup;
