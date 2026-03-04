/**
 * Standalone Cashu Mainnet Test (TypeScript Version)
 * 
 * This script tests the complete Cashu flow with real mainnet mints and Lightning Network:
 * 1. Generate a Lightning invoice for ecash minting
 * 2. Display invoice to user for manual payment
 * 3. Mint ecash tokens after payment confirmation
 * 4. Display and redeem ecash tokens
 * 5. Generate Lightning invoice for withdrawal
 * 6. Complete the withdrawal process
 */

import { CashuMint, CashuWallet, getDecodedToken, getEncodedTokenV4, MintQuoteState, type Proof, type MintQuoteResponse, type MeltQuoteResponse } from '@cashu/cashu-ts';
import * as readline from 'readline';

// Real mainnet Cashu mints (trusted)
export const MAINNET_MINTS = [
    'https://mint.minibits.cash/Bitcoin',
    'https://mint.lnwallet.app',
    'https://mint.coinos.io',
    'https://mint.lnserver.com',
    'https://mint.0xchat.com',
    'https://legend.lnbits.com/cashu/api/v1/4gr9Xcmz3XEkUNwiBiQGoC'
] as const;

export interface TestResult {
    success: boolean;
    message: string;
    token?: string;
    amount?: number;
    error?: string;
}

export interface MintFlowResult extends TestResult {
    proofs?: Proof[];
    quote?: string;
}

export interface RedemptionFlowResult extends TestResult {
    changeToken?: string;
    changeAmount?: number;
}

export class CashuMainnetTest {
    private mint: CashuMint;
    private wallet: CashuWallet;
    private rl: readline.Interface;
    private mintUrl: string;

    constructor(mintUrl: string) {
        this.mintUrl = mintUrl;
        this.mint = new CashuMint(mintUrl);
        this.wallet = new CashuWallet(this.mint);
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log(`🪙 Initializing Cashu test with mint: ${mintUrl}`);
    }

    private async question(prompt: string): Promise<string> {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    private async waitForEnter(message: string): Promise<void> {
        await this.question(`${message}\nPress Enter to continue...`);
    }

    private async displayInvoice(invoice: string, amount: number): Promise<void> {
        console.log('\n' + '='.repeat(80));
        console.log('⚡ LIGHTNING INVOICE TO PAY ⚡');
        console.log('='.repeat(80));
        console.log(`Amount: ${amount} sats`);
        console.log('');
        console.log('Invoice (copy this):');
        console.log('-'.repeat(40));
        console.log(invoice);
        console.log('-'.repeat(40));
        console.log('');
        console.log('Instructions:');
        console.log('1. Copy the invoice above');
        console.log('2. Open your Lightning wallet (Phoenix, Wallet of Satoshi, etc.)');
        console.log('3. Paste and pay the invoice');
        console.log('4. Wait for payment confirmation');
        console.log('='.repeat(80));
    }

    private async displayEcashToken(token: string, amount: number): Promise<void> {
        console.log('\n' + '='.repeat(80));
        console.log('🎫 ECASH TOKEN GENERATED 🎫');
        console.log('='.repeat(80));
        console.log(`Amount: ${amount} sats`);
        console.log('');
        console.log('Token (copy this for future redemption):');
        console.log('-'.repeat(40));
        console.log(token);
        console.log('-'.repeat(40));
        console.log('');
        console.log('This token represents your ecash and can be:');
        console.log('- Sent to others (peer-to-peer payments)');
        console.log('- Redeemed for Lightning sats');
        console.log('- Stored securely offline');
        console.log('- Split into smaller denominations');
        console.log('='.repeat(80));
    }

    public async initialize(): Promise<TestResult> {
        try {
            console.log('🔗 Connecting to Cashu mint...');
            await this.wallet.loadMint();
            console.log('✅ Connected successfully!');

            // Display mint info
            const mintInfo = await this.mint.getInfo();
            console.log('\n📋 Mint Information:');
            console.log(`Name: ${mintInfo.name || 'Unknown'}`);
            console.log(`Description: ${mintInfo.description || 'No description'}`);
            console.log(`Version: ${mintInfo.version || 'Unknown'}`);
            console.log(`URL: ${this.mintUrl}`);

            return {
                success: true,
                message: 'Successfully connected to mint'
            };

        } catch (error) {
            const errorMessage = `Failed to connect to mint: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('❌', errorMessage);
            return {
                success: false,
                message: errorMessage,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    public async testMintFlow(): Promise<MintFlowResult> {
        console.log('\n🏭 STARTING MINT FLOW');
        console.log('==================');

        try {
            // Get amount from user
            const amountStr = await this.question('Enter amount in sats to mint (e.g., 1000): ');
            const amount = parseInt(amountStr);

            if (isNaN(amount) || amount <= 0) {
                throw new Error('Invalid amount entered');
            }

            console.log(`\n📋 Creating mint quote for ${amount} sats...`);

            // Create mint quote
            const mintQuote: MintQuoteResponse = await this.wallet.createMintQuote(amount);
            console.log(`✅ Quote created: ${mintQuote.quote}`);

            if (!mintQuote.request) {
                throw new Error('No Lightning invoice received from mint');
            }

            // Display invoice for payment
            await this.displayInvoice(mintQuote.request, amount);
            await this.waitForEnter('Pay the invoice in your Lightning wallet, then');

            // Check payment status with timeout
            console.log('\n⏳ Checking payment status...');
            const proofs = await this.waitForPaymentAndMint(mintQuote.quote, amount);

            // Create token
            const token = getEncodedTokenV4({
                mint: this.mintUrl,
                proofs: proofs
            });

            await this.displayEcashToken(token, amount);

            return {
                success: true,
                message: 'Mint flow completed successfully',
                token,
                amount,
                proofs,
                quote: mintQuote.quote
            };

        } catch (error) {
            const errorMessage = `Mint flow failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('❌', errorMessage);
            return {
                success: false,
                message: errorMessage,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private async waitForPaymentAndMint(quote: string, amount: number): Promise<Proof[]> {
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes with 10s intervals

        while (attempts < maxAttempts) {
            try {
                const quoteStatus = await this.wallet.checkMintQuote(quote);

                if (quoteStatus.state === MintQuoteState.PAID) {
                    console.log('✅ Payment confirmed!');
                    break;
                }

                if (quoteStatus.state === MintQuoteState.ISSUED) {
                    console.log('✅ Payment confirmed and tokens already issued!');
                    break;
                }

                console.log(`⏳ Payment pending... (attempt ${attempts + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                attempts++;

            } catch (error) {
                console.error('❌ Error checking quote:', error);
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }

        if (attempts >= maxAttempts) {
            throw new Error('Payment not confirmed within timeout period (5 minutes)');
        }

        // Mint the proofs
        console.log('\n🏭 Minting ecash proofs...');
        const proofs = await this.wallet.mintProofs(amount, quote);
        console.log(`✅ Minted ${proofs.length} proofs with total value: ${proofs.reduce((sum, p) => sum + p.amount, 0)} sats`);

        return proofs;
    }

    public async testRedemptionFlow(inputToken?: string): Promise<RedemptionFlowResult> {
        console.log('\n💸 STARTING REDEMPTION FLOW');
        console.log('==========================');

        try {
            let ecashToken = inputToken;

            if (!ecashToken) {
                ecashToken = await this.question('Enter ecash token to redeem (or press Enter to skip): ');
                if (!ecashToken.trim()) {
                    return {
                        success: false,
                        message: 'No token provided for redemption'
                    };
                }
            }

            // Decode and validate token
            const tokenInfo = this.validateToken(ecashToken);
            if (!tokenInfo.success) {
                return tokenInfo;
            }

            // Check if token mint matches current mint
            const decoded = getDecodedToken(ecashToken);
            if (decoded.mint !== this.mintUrl) {
                console.log('\n⚠️  MINT MISMATCH WARNING ⚠️');
                console.log('='.repeat(50));
                console.log(`Token mint: ${decoded.mint}`);
                console.log(`Current mint: ${this.mintUrl}`);
                console.log('');
                console.log('❌ This token can only be redeemed by its original mint!');
                console.log('');
                console.log('Options:');
                console.log('1. Restart test with correct mint');
                console.log('2. Continue anyway (will fail)');

                const choice = await this.question('Choose option (1 or 2): ');

                if (choice.trim() === '1') {
                    console.log('\n🔄 Please restart the test and select the correct mint:');
                    console.log(`Correct mint: ${decoded.mint}`);
                    return {
                        success: false,
                        message: 'Restart required with correct mint'
                    };
                }

                console.log('\n⚠️  Continuing with mismatched mint (this will likely fail)...');
            }

            // Receive the token to know exactly how many sats are available
            const receivedProofs = await this.wallet.receive(ecashToken);
            const totalReceived = receivedProofs.reduce((sum, p) => sum + p.amount, 0);
            console.log(`\n💰 Available balance from token: ${totalReceived} sats`);

            // Helper: loop until the invoice + fee fits the available token amount
            async function preflightSizedMeltQuote(wallet: CashuWallet, initialInvoice: string, available: number, prompt: (msg: string) => Promise<string>): Promise<{ quote: MeltQuoteResponse; invoice: string }> {
                let currentInvoice = initialInvoice;
                while (true) {
                    const quote = await wallet.createMeltQuote(currentInvoice);
                    const required = quote.amount + quote.fee_reserve;
                    console.log(`\n📋 Melt quote:`);
                    console.log(`- Invoice amount: ${quote.amount} sats`);
                    console.log(`- Fee reserve:   ${quote.fee_reserve} sats`);
                    console.log(`- Total needed:  ${required} sats`);

                    if (required <= available) {
                        return { quote, invoice: currentInvoice };
                    }

                    const buffer = 1; // keep 1 sat buffer to avoid rounding issues
                    const recommended = Math.max(0, available - quote.fee_reserve - buffer);
                    console.log('\n⚠️  Invoice too high for available balance.');
                    console.log(`➡️  Recommended invoice amount: ${recommended} sats`);
                    console.log('Please create a NEW Lightning invoice in your wallet for the recommended amount (or lower),');
                    currentInvoice = await prompt('Enter NEW Lightning invoice: ');
                    if (!currentInvoice.trim()) {
                        throw new Error('No Lightning invoice provided');
                    }
                }
            }

            // Get Lightning invoice; preflight and guide user to the correct amount if needed
            console.log('\n💰 Prepare Lightning invoice for withdrawal...');
            console.log('Tip: You can enter an invoice for your desired amount.');
            console.log('If it exceeds available balance after fees, I will compute a recommended amount.');
            let invoice = await this.question('Enter Lightning invoice for withdrawal: ');
            if (!invoice.trim()) {
                return { success: false, message: 'No Lightning invoice provided' };
            }

            // Preflight to ensure invoice+fees fit
            const { quote: meltQuote, invoice: sizedInvoice } = await preflightSizedMeltQuote(this.wallet, invoice, totalReceived, async (msg) => this.question(msg));

            console.log('\n💰 Processing withdrawal...');

            // Proceed to melt the proofs using the sized quote
            const meltResult = await this.wallet.meltProofs(meltQuote, receivedProofs);

            console.log('✅ Withdrawal completed successfully!');

            let changeToken: string | undefined;
            let changeAmount = 0;

            if (meltResult.change && meltResult.change.length > 0) {
                changeAmount = meltResult.change.reduce((sum, p) => sum + p.amount, 0);
                console.log(`💰 Change received: ${changeAmount} sats`);

                // Create token for change
                changeToken = getEncodedTokenV4({
                    mint: this.mintUrl,
                    proofs: meltResult.change
                });

                console.log('\n🎫 Change token (save this):');
                console.log('-'.repeat(40));
                console.log(changeToken);
                console.log('-'.repeat(40));
            }

            return {
                success: true,
                message: 'Redemption completed successfully',
                changeToken,
                changeAmount,
                amount: meltQuote.amount
            };

        } catch (error) {
            const errorMessage = `Redemption failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('❌', errorMessage);
            return {
                success: false,
                message: errorMessage,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    public validateToken(token: string): TestResult & { mint?: string; amount?: number; proofCount?: number } {
        try {
            const decoded = getDecodedToken(token);
            const totalAmount = decoded.proofs.reduce((sum: number, p: any) => sum + p.amount, 0);

            console.log('\n✅ Token is valid!');
            console.log(`Mint: ${decoded.mint}`);
            console.log(`Unit: ${decoded.unit}`);
            console.log(`Proofs: ${decoded.proofs.length}`);
            console.log(`Total amount: ${totalAmount} sats`);

            // Check if mint is trusted
            const isTrusted = MAINNET_MINTS.includes(decoded.mint as any);
            console.log(`Trusted mint: ${isTrusted ? '✅ Yes' : '⚠️ No (proceed with caution)'}`);

            return {
                success: true,
                message: 'Token validated successfully',
                mint: decoded.mint,
                amount: totalAmount,
                proofCount: decoded.proofs.length
            };

        } catch (error) {
            const errorMessage = `Invalid token: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('❌', errorMessage);
            return {
                success: false,
                message: errorMessage,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    public async runFullTest(): Promise<TestResult> {
        try {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return initResult;
            }

            console.log('\n🚀 STARTING CASHU MAINNET TEST');
            console.log('==============================');

            const testChoice = await this.question(`
Choose test option:
1. Full flow (mint + redeem)
2. Mint only
3. Redeem only
4. Token validation only
Enter choice (1-4): `);

            switch (testChoice.trim()) {
                case '1': {
                    console.log('\n🔄 Running full flow test...');
                    const mintResult = await this.testMintFlow();
                    if (!mintResult.success) {
                        return mintResult;
                    }

                    await this.waitForEnter('\n✅ Mint flow completed. Ready to test redemption?');
                    const redeemResult = await this.testRedemptionFlow(mintResult.token);

                    if (redeemResult.success) {
                        return {
                            success: true,
                            message: 'Full flow test completed successfully'
                        };
                    }
                    return redeemResult;
                }

                case '2': {
                    console.log('\n🏭 Running mint-only test...');
                    return await this.testMintFlow();
                }

                case '3': {
                    console.log('\n💸 Running redemption-only test...');
                    return await this.testRedemptionFlow();
                }

                case '4': {
                    console.log('\n🔍 Running token validation test...');
                    const token = await this.question('Enter token to validate: ');
                    return this.validateToken(token);
                }

                default: {
                    return {
                        success: false,
                        message: 'Invalid test option selected'
                    };
                }
            }

        } catch (error) {
            const errorMessage = `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('\n❌', errorMessage);
            return {
                success: false,
                message: errorMessage,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        } finally {
            this.cleanup();
        }
    }

    public cleanup(): void {
        this.rl.close();
    }

    // Static utility methods
    public static async selectMint(recommendedMint?: string): Promise<string> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        try {
            if (recommendedMint) {
                console.log('\n🎯 RECOMMENDED MINT (for token redemption):');
                console.log(`➡️  ${recommendedMint}`);
                console.log('');

                const useRecommended = await new Promise<string>((resolve) => {
                    rl.question('Use recommended mint? (y/n): ', resolve);
                });

                if (useRecommended.toLowerCase().startsWith('y')) {
                    return recommendedMint;
                }
            }

            console.log('\n📋 Available Mainnet Mints:');
            MAINNET_MINTS.forEach((mint, index) => {
                const isRecommended = mint === recommendedMint ? ' ⭐ RECOMMENDED' : '';
                console.log(`${index + 1}. ${mint}${isRecommended}`);
            });

            const mintChoice = await new Promise<string>((resolve) => {
                rl.question(`\nSelect mint (1-${MAINNET_MINTS.length}) or enter custom URL: `, resolve);
            });

            const mintIndex = parseInt(mintChoice) - 1;

            if (!isNaN(mintIndex) && mintIndex >= 0 && mintIndex < MAINNET_MINTS.length) {
                return MAINNET_MINTS[mintIndex];
            } else if (mintChoice.startsWith('http')) {
                return mintChoice;
            } else {
                throw new Error('Invalid mint selection');
            }

        } finally {
            rl.close();
        }
    }

    public static detectMintFromToken(token: string): string | null {
        try {
            const decoded = getDecodedToken(token);
            return decoded.mint;
        } catch {
            return null;
        }
    }
}

// Main execution function
export async function runCashuMainnetTest(): Promise<void> {
    console.log('🪙 Cashu Mainnet Standalone Test');
    console.log('================================');

    try {
        const selectedMint = await CashuMainnetTest.selectMint();
        console.log(`\n🎯 Selected mint: ${selectedMint}`);

        const tester = new CashuMainnetTest(selectedMint);
        const result = await tester.runFullTest();

        if (result.success) {
            console.log('\n🎉 Test completed successfully!');
            console.log('✅', result.message);
        } else {
            console.log('\n❌ Test failed!');
            console.log('Error:', result.message);
        }

    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    }
}

// Run if called directly
if (require.main === module) {
    runCashuMainnetTest().catch(console.error);
}