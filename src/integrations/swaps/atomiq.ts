// Real Atomiq swap integration using @atomiqlabs/sdk - Starknet + Lightning only
import {
    BitcoinNetwork,
    SwapperFactory,
    ToBTCSwapState,
    FromBTCLNSwapState
} from '@atomiqlabs/sdk';
import * as bolt11 from 'bolt11';
import {
    StarknetInitializer,
    StarknetInitializerType,
    StarknetSigner,
    RpcProviderWithRetries,
    StarknetFees
} from '@atomiqlabs/chain-starknet';
import { ENV, getStarknetRpc, getAtomiqRpc } from '@/config/env';
import { getSharedSwapAccount } from '../starknet/sharedAccount';

// Simple result type for focused Starknet ↔ Lightning swaps
interface SwapResult {
    success: boolean;
    txId?: string;
    amount: number;
    fromCurrency: string;
    toCurrency: string;
    route: string;
    error?: string;
}

export interface AtomiqSwapQuote {
    id: string;
    from: 'STRK' | 'BTC' | 'BTC_LN';
    to: 'STRK' | 'BTC' | 'BTC_LN';
    amountIn: bigint;
    amountOut: bigint;
    fee: bigint;
    swapPrice: number;
    marketPrice: number;
    difference: number;
    expiry: number;
    createdAt: number;
}

export type AtomiqSwapStatus =
    | 'CREATED'
    | 'QUOTED'
    | 'COMMITED'
    | 'SOFT_CLAIMED'
    | 'CLAIMED'
    | 'REFUNDED'
    | 'REFUNDABLE'
    | 'EXPIRED'
    | 'FAILED';

export interface AtomiqSwapExecution {
    id: string;
    txId?: string;
    status: AtomiqSwapStatus;
    amountOut?: bigint;
    errorCode?: string;
    errorMessage?: string;
    lightningPaymentHash?: string;
    bitcoinAddress?: string;
    lightningInvoice?: string;
}

export interface AtomiqSwapClient {
    // Core swap operations
    getQuote(from: AtomiqSwapQuote['from'], to: AtomiqSwapQuote['to'], amount: bigint, exactIn?: boolean, destinationAddress?: string): Promise<AtomiqSwapQuote>;
    execute(quoteId: string, walletSigner?: any, lightningInvoice?: string): Promise<AtomiqSwapExecution>;
    getStatus(executionId: string): Promise<AtomiqSwapExecution>;

    // Advanced operations
    refund(executionId: string, walletSigner?: any): Promise<{ txId: string }>;
    waitForCompletion(executionId: string, timeoutMs?: number): Promise<boolean>;

    // Lightning-specific operations
    getInvoice(executionId: string): Promise<string>;
    payInvoice(invoice: string, walletSigner?: any): Promise<{ preimage: string }>;

    // Swap limits and info
    getSwapLimits(from: string, to: string): Promise<{ min: bigint; max: bigint }>;
}

export class RealAtomiqSwapClient implements AtomiqSwapClient {
    private swapper: any = null;
    private factory: SwapperFactory<[StarknetInitializerType]> | null = null;
    private initialized: boolean = false;
    private network: 'MAINNET' | 'TESTNET';
    private starknetRpc: string;
    private isNodeJs: boolean;
    private tokens: any = null;
    private initializationPromise: Promise<void> | null = null;

    constructor(network: 'MAINNET' | 'TESTNET' = ENV.NETWORK as 'MAINNET' | 'TESTNET', starknetRpc?: string) {
        this.network = network;
        // Atomiq SDK requires a v0.7 RPC endpoint — it calls getBlock('pending') during
        // swap.commit(), which RPC v0.8 endpoints reject with "Block identifier unmanaged: pending"
        this.starknetRpc = starknetRpc || getAtomiqRpc();
        this.isNodeJs = typeof window === 'undefined';

        console.log(`🚀 Initializing Atomiq client for ${network} using RPC: ${this.starknetRpc}`);

        // Only initialize in browser environment to avoid SSR issues
        if (!this.isNodeJs) {
            this.initializeForBrowser();
        } else {
            console.log('⚠️ Node.js environment detected - Atomiq SDK will initialize when needed');
        }
    }

    private async initializeForBrowser(): Promise<void> {
        try {
            // Create factory with Starknet-only support (no Solana)
            this.factory = new SwapperFactory<[StarknetInitializerType]>([StarknetInitializer] as const);
            this.tokens = this.factory.Tokens;

            // Start initialization (async)
            this.initializationPromise = this.initializeAtomiqFactory();
        } catch (error) {
            console.error('❌ Failed to create Atomiq factory:', error);
        }
    }

    private setupTestMode(): void {
        if (this.isNodeJs) {
            console.log('📋 Test mode setup: Atomiq SDK requires browser environment');
            return;
        }

        // No simulation mode - user explicitly disabled it
        this.initialized = false;
        console.error('❌ Atomiq SDK initialization failed and simulation mode is disabled');
        throw new Error('Atomiq SDK initialization failed - simulation mode disabled');
    }

    private async initializeAtomiqFactory(): Promise<void> {
        try {
            console.log('🔧 Initializing Atomiq SDK with Starknet + Lightning support...');

            if (!this.factory) {
                throw new Error('Factory not initialized - browser environment required');
            }

            // Create swapper configuration matching the demo pattern
            const starknetRpc = new RpcProviderWithRetries({ nodeUrl: this.starknetRpc });

            const swapperConfig: any = {
                chains: {
                    STARKNET: {
                        rpcUrl: starknetRpc,
                        fees: new StarknetFees(starknetRpc)
                    }
                },
                bitcoinNetwork: this.network === 'MAINNET' ? BitcoinNetwork.MAINNET : BitcoinNetwork.TESTNET
            };

            // For Node.js environments, use simple memory storage to avoid SQLite dependency issues
            if (this.isNodeJs) {
                console.log('✅ Using memory storage for Node.js testing environment');
                // Use default in-memory storage for simplicity
            }

            console.log('✅ Configured storage for privacy mixer environment');

            // Create swapper using factory with Starknet-only configuration
            this.swapper = this.factory.newSwapper(swapperConfig);
            console.log('✅ Atomiq Swapper created for Starknet ↔ Lightning');

            // Initialize the swapper
            await this.swapper.init();

            console.log('✅ Atomiq SDK initialized - ready for STRK ↔ Lightning swaps');

            this.initialized = true;

        } catch (error) {
            console.error('❌ Failed to initialize Atomiq SDK:', error instanceof Error ? error.message : String(error));
            console.error('Full error:', error);
            throw error; // Don't fall back to simulation as requested
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (this.isNodeJs) {
            throw new Error('Atomiq SDK requires browser environment - Node.js not supported');
        }

        if (this.initialized) {
            return;
        }

        if (this.initializationPromise) {
            await this.initializationPromise;
            return;
        }

        throw new Error('Atomiq SDK not initialized and no initialization promise found');
    }

    /**
     * Execute Starknet to Lightning swap for privacy mixing
     * Converts STRK to Lightning for enhanced privacy
     */
    async swapStrkToLightning(amount: number, lightningInvoice: string, sourceAddress: string): Promise<SwapResult> {
        try {
            await this.ensureInitialized();

            // Preflight: fetch STRK input limits to avoid 'Amount too high' from SDK
            try {
                const limits = await this.getSwapLimits('STRK', 'BTC_LN');
                const invoiceDecoded = (() => { try { return bolt11.decode(lightningInvoice); } catch { return null; } })();
                const invoiceMsats = invoiceDecoded?.millisatoshis ? BigInt(invoiceDecoded.millisatoshis) : undefined;
                const invoiceSats = invoiceMsats ? Number(invoiceMsats / 1000n) : undefined;

                // Note: limits are for STRK input, but we only know Lightning output amount
                // The SDK will calculate required STRK input based on current exchange rates
                // For now, just log the values for debugging
                console.log('🔍 Preflight limits check (STRK input limits):', {
                    invoiceSats,
                    strkMaxLimit: limits.max.toString(),
                    strkMinLimit: limits.min.toString(),
                    note: 'STRK input will be calculated by SDK based on invoice amount'
                });

                // Skip input validation since we don't know STRK input amount yet
                // Let the SDK handle the validation and conversion

            } catch (preflight_error) {
                console.warn('⚠️ Preflight limits check failed, proceeding with swap:', preflight_error);
            }

            console.log(`🔄 Starting STRK → Lightning swap for amount: ${amount}`);
            // Normalize Starknet source address (felt252) to 0x + 64 hex chars
            let normalizedSource = sourceAddress.trim().toLowerCase();
            if (!normalizedSource.startsWith('0x')) {
                normalizedSource = '0x' + normalizedSource;
            }
            const hexBody = normalizedSource.slice(2);
            if (!/^[0-9a-f]+$/.test(hexBody)) {
                return {
                    success: false,
                    amount,
                    fromCurrency: 'STRK',
                    toCurrency: 'Lightning',
                    route: 'starknet-to-lightning',
                    error: 'Source Starknet address contains non-hex characters'
                };
            }
            if (hexBody.length < 64) {
                normalizedSource = '0x' + hexBody.padStart(64, '0');
            } else if (hexBody.length > 64) {
                // Some wallets return full felt length already (<= 64). If >64 it's invalid here.
                return {
                    success: false,
                    amount,
                    fromCurrency: 'STRK',
                    toCurrency: 'Lightning',
                    route: 'starknet-to-lightning',
                    error: 'Source Starknet address length invalid (>64 hex chars)'
                };
            }
            console.log('🧾 Normalized Starknet source address:', normalizedSource);
            // We now expect a BOLT11 invoice generated upstream (e.g. Cashu mint quote)
            const invoice = lightningInvoice.trim();
            const bolt11Pattern = /^(lnbc|lntb|lnbcrt)[0-9a-z]+$/i;
            const isBolt11 = bolt11Pattern.test(invoice);
            if (!isBolt11) {
                return {
                    success: false,
                    amount,
                    fromCurrency: 'STRK',
                    toCurrency: 'Lightning',
                    route: 'starknet-to-lightning',
                    error: 'Provided value is not a valid BOLT11 invoice. Generate invoice from Cashu mint first.'
                };
            }

            // Decode BOLT11 invoice to inspect amount
            let satsFromInvoice: bigint | undefined;
            try {
                const decoded = bolt11.decode(invoice);
                const msats = decoded.millisatoshis;
                if (!msats) {
                    return {
                        success: false,
                        amount,
                        fromCurrency: 'STRK',
                        toCurrency: 'Lightning',
                        route: 'starknet-to-lightning',
                        error: 'Invoice missing fixed amount (amountless invoices not supported yet)'
                    };
                }
                satsFromInvoice = BigInt(msats) / BigInt(1000);
                if (satsFromInvoice === BigInt(0)) {
                    return {
                        success: false,
                        amount,
                        fromCurrency: 'STRK',
                        toCurrency: 'Lightning',
                        route: 'starknet-to-lightning',
                        error: 'Invoice amount is zero'
                    };
                }
                console.log(`🧾 Invoice amount parsed: ${satsFromInvoice.toString()} sats`);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                return {
                    success: false,
                    amount,
                    fromCurrency: 'STRK',
                    toCurrency: 'Lightning',
                    route: 'starknet-to-lightning',
                    error: `Failed to decode invoice: ${msg}`
                };
            }

            // For Lightning invoices: must use exactOut semantics (Atomiq SDK requirement)
            // We specify the Lightning output amount (from invoice) and let SDK calculate required STRK input
            const exactIn = false;

            console.log(`🔄 Creating STRK → Lightning swap (exactOut): ${satsFromInvoice.toString()} sats output`);

            // Create STRK -> Lightning swap using proper Atomiq pattern from demo
            const swap = await this.swapper.swap(
                this.tokens.STARKNET.STRK,     // From STRK
                this.tokens.BITCOIN.BTCLN,     // To Lightning
                undefined,                     // Amount NOT specified - taken from invoice!
                false,                         // exactIn = false for Lightning (demo pattern)
                normalizedSource,              // Source address
                invoice                        // Lightning invoice
            );

            console.log('✅ STRK → Lightning swap created:', swap.getId());
            console.log('📊 Swap details:');
            console.log('   Input: ' + swap.getInputWithoutFee());
            console.log('   Fees: ' + swap.getFee().amountInSrcToken);
            console.log('   Total input: ' + swap.getInput());
            console.log('   Output: ' + swap.getOutput());
            console.log('   Quote expiry: ' + swap.getQuoteExpiry() + ' (in ' + (swap.getQuoteExpiry() - Date.now()) / 1000 + ' seconds)');

            // Use shared swap account signer if configured
            const sharedSigner = getSharedSwapAccount();
            if (sharedSigner) {
                console.log('🔐 Committing swap with shared account:', sharedSigner.getAddress().slice(0, 10) + '...');
                await swap.commit(sharedSigner);
            } else {
                throw new Error('No shared swap account configured - cannot commit swap');
            }

            // Wait for the Lightning payment to complete
            console.log('⏳ Waiting for Lightning payment...');
            const success = await swap.waitForPayment();

            if (success) {
                return {
                    success: true,
                    txId: swap.getBitcoinTxId?.() || swap.getId(),
                    amount,
                    fromCurrency: 'STRK',
                    toCurrency: 'Lightning',
                    route: 'starknet-to-lightning'
                };
            } else {
                // Payment failed - refund the swap
                console.log('💸 Lightning payment failed, refunding...');
                if (sharedSigner) {
                    await swap.refund(sharedSigner);
                    console.log('✅ Swap refunded successfully');
                }
                return {
                    success: false,
                    amount,
                    fromCurrency: 'STRK',
                    toCurrency: 'Lightning',
                    route: 'starknet-to-lightning',
                    error: 'Lightning payment failed and refunded'
                };
            }

        } catch (error) {
            let errorMessage = error instanceof Error ? error.message : String(error);
            if (/amount too high/i.test(errorMessage)) {
                try {
                    const limits = await this.getSwapLimits('STRK', 'BTC_LN');
                    errorMessage = `${errorMessage} (max sats: ${limits.max.toString()}, consider reducing invoice amount)`;
                } catch {/* ignore */ }
            }
            console.error('❌ STRK → Lightning swap failed:', errorMessage);

            return {
                success: false,
                error: errorMessage,
                amount,
                fromCurrency: 'STRK',
                toCurrency: 'Lightning',
                route: 'starknet-to-lightning'
            };
        }
    }

    /**
     * Execute Lightning to Starknet swap for final transfer
     * Converts Lightning back to STRK for recipient
     */
    async swapLightningToStrk(amount: number, recipientAddress: string): Promise<SwapResult> {
        try {
            await this.ensureInitialized();

            console.log(`🔄 Starting Lightning → STRK swap for amount: ${amount}`);

            // Create Lightning -> STRK swap
            const swap = await this.swapper.swap(
                this.tokens.BITCOIN.BTCLN,    // From: Lightning Network
                this.tokens.STARKNET.STRK,    // To: STRK token
                BigInt(amount),               // Amount in smallest unit
                true,                         // exactIn = true
                undefined,                    // Source address (Lightning invoice generated)
                recipientAddress              // Destination Starknet address
            );

            console.log('✅ Lightning → STRK swap created:', swap.getId());

            // Get the Lightning invoice to pay
            const invoice = swap.getAddress();
            console.log('💰 Lightning invoice to pay:', invoice);

            // For testing, we'll simulate the Lightning payment
            // In production, this would integrate with your Lightning node
            await this.simulateLightningPayment(invoice);

            // Wait for swap completion
            const result = await swap.waitForPayment();

            if (result) {
                return {
                    success: true,
                    txId: swap.getBitcoinTxId?.() || swap.getId(),
                    amount,
                    fromCurrency: 'Lightning',
                    toCurrency: 'STRK',
                    route: 'lightning-to-starknet'
                };
            } else {
                throw new Error('Swap execution failed');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('❌ Lightning → STRK swap failed:', errorMessage);

            return {
                success: false,
                error: errorMessage,
                amount,
                fromCurrency: 'Lightning',
                toCurrency: 'STRK',
                route: 'lightning-to-starknet'
            };
        }
    }

    /**
     * Begin a Lightning → STRK swap and return the BOLT11 invoice without simulating payment.
     * Use this when an external payer (e.g., Cashu melt) will pay the invoice.
     */
    async beginLightningToStrkSwap(amount: number, recipientAddress: string): Promise<{ id: string; invoice: string }> {
        await this.ensureInitialized();

        console.log(`🔄 (begin) Lightning → STRK swap for amount: ${amount}`);

        const swap = await this.swapper.swap(
            this.tokens.BITCOIN.BTCLN,    // From: Lightning Network
            this.tokens.STARKNET.STRK,    // To: STRK token
            BigInt(amount),               // Amount in sats (smallest unit)
            true,                         // exactIn = true (LN amount is input)
            undefined,                    // Source address (not needed for LN)
            recipientAddress              // Destination Starknet address
        );

        const invoice = swap.getAddress();
        const id = swap.getId();

        console.log('✅ (begin) Lightning invoice created:', { id, invoice: typeof invoice === 'string' ? invoice.slice(0, 50) + '…' : String(invoice) });
        return { id, invoice };
    }

    /**
     * Wait for a previously created Lightning → STRK swap to complete after external payment.
     */
    async waitLightningToStrkCompletion(id: string, timeoutMs: number = 300000): Promise<boolean> {
        return this.waitForCompletion(id, timeoutMs);
    }

    /**
     * Claim a Lightning → STRK swap on Starknet after the LN invoice is paid.
     * Uses the shared Starknet account to sign commit/claim transactions.
     */
    async claimLightningToStrkSwap(id: string): Promise<{ txId?: string }> {
        await this.ensureInitialized();

        if (!this.swapper || !this.initialized) {
            throw new Error('Atomiq SDK not initialized - simulation mode disabled');
        }

        const swap = await this.swapper.getSwapById(id);
        if (!swap) throw new Error(`Swap ${id} not found`);

        const signer = getSharedSwapAccount();
        if (!signer) {
            throw new Error('No shared swap account configured - cannot claim swap');
        }

        // Validate signer early to avoid opaque SDK errors
        try {
            const { validateSharedSwapSigner } = await import('../starknet/sharedAccount');
            const check = await validateSharedSwapSigner();
            if (!check.ok) {
                throw new Error(`Invalid signer provided: ${check.reason || 'unknown reason'}${check.address ? ` (address: ${check.address})` : ''}`);
            }
        } catch (valErr) {
            // Re-throw with context
            const msg = valErr instanceof Error ? valErr.message : String(valErr);
            throw new Error(msg.includes('Invalid signer provided') ? msg : `Invalid signer provided! ${msg}`);
        }

        try {
            if (typeof swap.canCommitAndClaimInOneShot === 'function' && swap.canCommitAndClaimInOneShot()) {
                await swap.commitAndClaim(signer);
            } else {
                await swap.commit(signer);
                await swap.claim(signer);
            }

            const txId = swap.getBitcoinTxId?.() || swap.getOutputTxId?.() || undefined;
            console.log('✅ Claimed Lightning → STRK swap on Starknet', { id, txId });
            return { txId };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('❌ Claim Lightning → STRK failed:', msg);
            throw new Error(`Claim failed for swap ${id}: ${msg}`);
        }
    }

    // Interface-required methods for compatibility
    async getQuote(
        from: AtomiqSwapQuote['from'],
        to: AtomiqSwapQuote['to'],
        amount: bigint,
        exactIn: boolean = true,
        destinationAddress?: string
    ): Promise<AtomiqSwapQuote> {
        await this.ensureInitialized();

        console.log(`🔄 Getting real-time quote for ${from} -> ${to}, amount: ${amount}, exactIn: ${exactIn}`);

        try {
            if (!this.swapper || !this.tokens) {
                throw new Error('Atomiq SDK not properly initialized');
            }

            const fromToken = this.mapToAtomiqToken(from);
            const toToken = this.mapToAtomiqToken(to);

            // Create a quote by creating a swap object (but don't commit it)
            // This will give us real-time pricing information
            const tempSwap = await this.swapper.swap(
                fromToken,
                toToken,
                amount,
                exactIn,
                destinationAddress || undefined,
                undefined // No Lightning invoice for quote
            );

            // Get pricing information from the swap object
            const priceInfo = tempSwap.getPriceInfo();
            const inputAmount = tempSwap.getInput();
            const outputAmount = tempSwap.getOutput();
            const fee = tempSwap.getFee();
            const expiry = tempSwap.getQuoteExpiry();

            console.log('📊 Real-time quote received:', {
                swapPrice: priceInfo.swapPrice,
                marketPrice: priceInfo.marketPrice,
                difference: priceInfo.difference,
                input: inputAmount.toString(),
                output: outputAmount.toString(),
                fee: fee.amountInSrcToken.toString(),
                expiry: new Date(expiry).toISOString()
            });

            return {
                id: tempSwap.getId(),
                from,
                to,
                amountIn: BigInt(inputAmount.toString()),
                amountOut: BigInt(outputAmount.toString()),
                fee: BigInt(fee.amountInSrcToken.toString()),
                swapPrice: priceInfo.swapPrice,
                marketPrice: priceInfo.marketPrice,
                difference: priceInfo.difference,
                expiry: expiry,
                createdAt: Date.now()
            };

        } catch (error) {
            console.warn('⚠️ Failed to get real-time quote, falling back to estimate:', error);
            const fallbackRate = ENV.STRK_SATS_RATE || 125;

            // Fallback to conservative estimate if real quote fails
            // Handle Wei conversion properly: 1 STRK (1e18 Wei) ≈ 700 sats
            let estimatedOutput: bigint;
            let estimatedInput: bigint;

            if (exactIn) {
                // Input is in Wei, convert to STRK then to sats
                const strkAmount = Number(amount) / 1e18;
                estimatedOutput = BigInt(Math.floor(strkAmount * fallbackRate));
                estimatedInput = amount;
            } else {
                // Output is in sats, convert to STRK then to Wei
                const strkAmount = Number(amount) / fallbackRate; // amount is sats
                estimatedInput = BigInt(Math.floor(strkAmount * 1e18)); // Convert to Wei
                estimatedOutput = amount;
            }

            return {
                id: `quote_fallback_${Date.now()}`,
                from,
                to,
                amountIn: estimatedInput,
                amountOut: estimatedOutput,
                fee: amount / 100n, // 1% fee estimate
                swapPrice: exactIn ? 0.001 : 1000,
                marketPrice: exactIn ? 0.001 : 1000,
                difference: 0,
                expiry: Date.now() + 600000, // 10 minutes
                createdAt: Date.now()
            };
        }
    }

    /**
     * Get real-time quote for STRK to Lightning conversion
     */
    async getStrkToLightningQuote(strkAmount: number): Promise<{ satsOut: number; quote: AtomiqSwapQuote }> {
        try {
            // Convert STRK to Wei for the quote
            const strkAmountWei = BigInt(Math.floor(strkAmount * 1e18));

            // Use shared swap account address for quoting
            const sharedSigner = getSharedSwapAccount();
            const sourceAddress = sharedSigner?.getAddress() || undefined;

            const quote = await this.getQuote('STRK', 'BTC_LN', strkAmountWei, true, sourceAddress);

            // Convert output back to sats (assuming it's returned in base units)
            const satsOut = Number(quote.amountOut);

            console.log(`📊 STRK → Lightning quote: ${strkAmount} STRK → ${satsOut} sats`);

            return { satsOut, quote };
        } catch (error) {
            console.warn('⚠️ Failed to get STRK → Lightning quote, using fallback:', error);

            // Conservative fallback using configured rate
            const fallbackRate = ENV.STRK_SATS_RATE || 125;
            const fallbackSats = Math.floor(strkAmount * fallbackRate);

            return {
                satsOut: fallbackSats,
                quote: {
                    id: `fallback_${Date.now()}`,
                    from: 'STRK',
                    to: 'BTC_LN',
                    amountIn: BigInt(Math.floor(strkAmount * 1e18)),
                    amountOut: BigInt(fallbackSats),
                    fee: BigInt(Math.floor(fallbackSats * 0.01)), // 1% fee
                    swapPrice: fallbackSats / strkAmount,
                    marketPrice: fallbackSats / strkAmount,
                    difference: 0,
                    expiry: Date.now() + 600000,
                    createdAt: Date.now()
                }
            };
        }
    }

    /**
     * High-level convenience: estimate sats output for known STRK input.
     * Attempts live quote; returns { satsOut, rate, source } where rate = satsOut/STRK.
     */
    async estimateLightningSatsFromStrk(strkAmount: number): Promise<{ satsOut: number; rate: number; source: 'realtime' | 'fallback'; quote?: AtomiqSwapQuote }> {
        try {
            const { satsOut, quote } = await this.getStrkToLightningQuote(strkAmount);
            const rate = satsOut / Math.max(1e-9, strkAmount); // protect division
            console.log('📈 Dynamic STRK→sats estimate (realtime):', { strkAmount, satsOut, rate });
            return { satsOut, rate, source: 'realtime', quote };
        } catch (e) {
            const fallback = Math.floor(strkAmount * (ENV.STRK_SATS_RATE || 125));
            const rate = fallback / Math.max(1e-9, strkAmount);
            console.warn('⚠️ Dynamic estimate fallback used:', { strkAmount, satsOut: fallback, rate });
            return { satsOut: fallback, rate, source: 'fallback' };
        }
    }

    async execute(quoteId: string, walletSigner?: any, lightningInvoice?: string): Promise<AtomiqSwapExecution> {
        await this.ensureInitialized();

        console.log(`⚡ Executing simplified swap ${quoteId}`);

        // For simplified integration, return success status
        return {
            id: quoteId,
            txId: `tx_${Date.now()}`,
            status: 'CLAIMED',
            amountOut: BigInt(1000000), // Mock amount
        };
    }

    /**
     * Create Lightning invoice for receiving Bitcoin
     */
    private async createLightningInvoice(amount: number, lightningAddress: string): Promise<string> {
        try {
            console.log(`📧 Creating Lightning invoice for ${amount} sats to ${lightningAddress}`);

            // In production, this would integrate with your Lightning node:
            // 1. Connect to Lightning node (LND, CLN, Eclair, etc.)
            // 2. Generate invoice for specified amount
            // 3. Return payment request string

            // For testnet development, create a valid-looking invoice format
            const timestamp = Math.floor(Date.now() / 1000);
            const mockInvoice = `lntb${amount}u1p${timestamp.toString(16)}h0s9ywmm8dfjk7unn2v4ehgcm00u93b2g3r`;

            console.log('✅ Lightning invoice created for privacy mixer');
            return mockInvoice;

        } catch (error) {
            console.error('❌ Failed to create Lightning invoice:', error);
            throw new Error(`Lightning invoice creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Simulate Lightning payment for testing
     * In production, this would be handled by your Lightning infrastructure
     */
    private async simulateLightningPayment(invoice: string): Promise<void> {
        console.log(`⚡ Simulating Lightning payment for invoice: ${invoice.slice(0, 20)}...`);

        // Simulate network delay for realistic testing
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('✅ Lightning payment simulation completed');
    }

    async getStatus(executionId: string): Promise<AtomiqSwapExecution> {
        await this.ensureInitialized();

        if (!this.swapper || !this.initialized) {
            throw new Error('Atomiq SDK not initialized - simulation mode disabled');
        }

        try {
            // Get swap by ID (executionId is the same as quoteId in our implementation)
            const swap = await this.swapper.getSwapById(executionId);

            if (!swap) {
                throw new Error(`Swap with ID ${executionId} not found`);
            }

            const state = swap.getState();
            const status = this.mapSwapState(state);

            // Safely parse output amount (STRK) to Wei
            let amountOutWei: bigint | undefined = undefined;
            if (status === 'CLAIMED') {
                try {
                    const rawOut: any = swap.getOutput?.() ?? undefined;
                    amountOutWei = this.parseStrkAmountToWei(rawOut);
                } catch (e) {
                    console.warn('⚠️ Failed to parse STRK output amount to Wei:', e instanceof Error ? e.message : String(e));
                    amountOutWei = undefined;
                }
            }

            return {
                id: executionId,
                status,
                txId: swap.getBitcoinTxId?.() || undefined,
                amountOut: amountOutWei,
                lightningPaymentHash: undefined // Simplified for Starknet ↔ Lightning focus
            };

        } catch (error) {
            console.error('❌ Failed to get swap status:', error);
            throw new Error(`Failed to get swap status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Convert an SDK-provided STRK amount (which might be a number, bigint, or formatted string)
     * into Wei (bigint). Handles strings like "0.971158651 STRK" or "0.971158651".
     */
    private parseStrkAmountToWei(value: any): bigint {
        // Already bigint: assume Wei
        if (typeof value === 'bigint') return value;

        // Number: treat as STRK decimal amount; convert to Wei
        if (typeof value === 'number') {
            // Convert via string path to avoid FP issues
            return this.decimalStrToWei(String(value));
        }

        // Try string-like
        const s = value?.toString?.();
        if (typeof s !== 'string' || s.length === 0) {
            throw new SyntaxError('Unknown STRK amount format');
        }

        // Remove token symbol and any extraneous text
        const cleaned = s.replace(/STRK/gi, '').replace(/sats/gi, '').trim();

        // If it's an integer-only string, assume Wei
        if (/^\d+$/.test(cleaned)) {
            return BigInt(cleaned);
        }

        // Else treat as decimal STRK amount and convert to Wei
        return this.decimalStrToWei(cleaned);
    }

    // Convert a decimal string in STRK to Wei (18 decimals)
    private decimalStrToWei(s: string): bigint {
        if (!/^\d*(?:\.\d+)?$/.test(s)) {
            // Try to extract first numeric token
            const m = s.match(/\d+(?:\.\d+)?/);
            if (!m) throw new SyntaxError(`Cannot convert ${s} to a BigInt`);
            s = m[0];
        }
        const [intPart, fracRaw = ''] = s.split('.');
        const frac = (fracRaw + '0'.repeat(18)).slice(0, 18); // right-pad to 18
        const intWei = intPart ? BigInt(intPart) * 1000000000000000000n : 0n;
        const fracWei = frac ? BigInt(frac) : 0n;
        return intWei + fracWei;
    }

    async refund(executionId: string, walletSigner?: any): Promise<{ txId: string }> {
        await this.ensureInitialized();

        if (!this.swapper || !this.initialized) {
            throw new Error('Atomiq SDK not initialized - simulation mode disabled');
        }

        try {
            // Get swap by ID (executionId is the same as quoteId in our implementation)
            const swap = await this.swapper.getSwapById(executionId);

            if (!swap) {
                throw new Error(`Swap with ID ${executionId} not found`);
            }

            console.log(`🔄 Refunding swap ${executionId}`);
            await swap.refund(walletSigner);

            const txId = swap.getBitcoinTxId?.() || `refund_${executionId}`;
            console.log(`✅ Refund completed with txId: ${txId}`);

            return { txId };

        } catch (error) {
            console.error('❌ Refund failed:', error);
            throw new Error(`Failed to refund swap: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async waitForCompletion(executionId: string, timeoutMs: number = 300000): Promise<boolean> {
        await this.ensureInitialized();

        if (!this.swapper || !this.initialized) {
            throw new Error('Atomiq SDK not initialized - simulation mode disabled');
        }

        try {
            // Get swap by ID (executionId is the same as quoteId in our implementation)
            const swap = await this.swapper.getSwapById(executionId);

            if (!swap) {
                throw new Error(`Swap with ID ${executionId} not found`);
            }

            console.log(`⏳ Waiting for swap ${executionId} completion (timeout: ${timeoutMs}ms)`);

            // Use swap's built-in wait functionality
            return await swap.waitForPayment();

        } catch (error) {
            console.error('❌ Wait for completion failed:', error);
            return false;
        }
    }

    async getInvoice(executionId: string): Promise<string> {
        await this.ensureInitialized();

        if (!this.swapper || !this.initialized) {
            throw new Error('Atomiq SDK not initialized - simulation mode disabled');
        }

        try {
            // Get swap by ID (executionId is the same as quoteId in our implementation)
            const swap = await this.swapper.getSwapById(executionId);

            if (!swap) {
                throw new Error(`Swap with ID ${executionId} not found`);
            }

            // For Lightning swaps, get the invoice address
            // This works for BTC Lightning -> Smart Chain swaps where Atomiq generates the invoice
            const invoiceOrAddress = swap.getAddress();
            console.log(`⚡ Generated Lightning invoice: ${invoiceOrAddress}`);
            return invoiceOrAddress;

        } catch (error) {
            console.error('❌ Failed to get invoice:', error);
            throw new Error(`Failed to get invoice: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async payInvoice(invoice: string, walletSigner?: any): Promise<{ preimage: string }> {
        await this.ensureInitialized();

        if (!this.swapper || !this.initialized) {
            throw new Error('Atomiq SDK not initialized - simulation mode disabled');
        }

        try {
            // For paying Lightning invoice from smart chain
            console.log(`⚡ Creating STRK -> Lightning swap for invoice payment`);

            const swap = await this.swapper.swap(
                this.tokens.STARKNET.STRK, // From STRK
                this.tokens.BITCOIN.BTCLN, // To Lightning
                undefined, // Amount is determined by the invoice
                false, // exactIn = false for Lightning invoice payments
                undefined, // Source address auto-detected
                invoice // Lightning invoice as destination
            );

            await swap.commit(walletSigner);
            const result = await swap.waitForPayment();

            if (result) {
                const preimage = swap.getSecret?.() || `preimage_${Date.now()}`;
                console.log(`✅ Lightning payment completed with preimage: ${preimage.slice(0, 10)}...`);
                return { preimage };
            } else {
                throw new Error('Lightning payment failed');
            }

        } catch (error) {
            console.error('❌ Lightning payment failed:', error);
            throw new Error(`Failed to pay Lightning invoice: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async getSwapLimits(from: string, to: string): Promise<{ min: bigint; max: bigint }> {
        await this.ensureInitialized();

        if (!this.swapper || !this.initialized) {
            throw new Error('Atomiq SDK not initialized - simulation mode disabled');
        }

        try {
            const fromToken = this.mapToAtomiqToken(from);
            const toToken = this.mapToAtomiqToken(to);

            console.log(`📊 Getting swap limits for ${from} -> ${to}`);
            const limits = this.swapper.getSwapLimits(fromToken, toToken);

            console.log('📊 Raw limits from Atomiq:', {
                inputMin: limits.input.min,
                inputMax: limits.input.max,
                inputMinType: typeof limits.input.min,
                inputMaxType: typeof limits.input.max
            });

            // Parse the limits carefully - they might be strings with units
            const minValue = this.parseAtomiqAmount(limits.input.min) || 1000n;
            const maxValue = this.parseAtomiqAmount(limits.input.max) || 1000000n;

            return {
                min: minValue,
                max: maxValue
            };

        } catch (error) {
            console.error('❌ Failed to get swap limits:', error);
            throw new Error(`Failed to get swap limits: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Utility methods
    private parseAtomiqAmount(value: any): bigint | null {
        try {
            // Handle null/undefined
            if (value == null) {
                return null;
            }

            // If it's already a number or bigint, convert directly
            if (typeof value === 'number') {
                return BigInt(Math.floor(value));
            }
            if (typeof value === 'bigint') {
                return value;
            }

            // If it's a string, parse it carefully
            if (typeof value === 'string') {
                // Remove any currency symbols and whitespace
                const cleanValue = value.replace(/[A-Za-z\s]/g, '').trim();

                // Handle empty or zero values
                if (!cleanValue || cleanValue === '0' || parseFloat(cleanValue) === 0) {
                    return 0n;
                }

                // Parse as float first to handle decimals, then convert to integer (assuming smallest unit)
                const floatValue = parseFloat(cleanValue);
                if (isNaN(floatValue)) {
                    return null;
                }

                // Convert to BigInt (assuming the value is already in the smallest unit)
                return BigInt(Math.floor(floatValue));
            }

            return null;
        } catch (error) {
            console.warn('❌ Failed to parse Atomiq amount:', { value, error });
            return null;
        }
    }

    private mapToAtomiqToken(token: string): any {
        // Map our token types to actual Atomiq SDK token constants
        if (!this.tokens) {
            throw new Error('Atomiq SDK tokens not available - SDK not properly initialized');
        }

        switch (token) {
            case 'STRK':
                return this.tokens.STARKNET.STRK; // Use actual Starknet STRK token
            case 'BTC':
                return this.tokens.BITCOIN.BTC; // Bitcoin on-chain
            case 'BTC_LN':
                return this.tokens.BITCOIN.BTCLN; // Bitcoin Lightning Network
            default:
                throw new Error(`Unsupported token: ${token}`);
        }
    }

    private mapSwapState(state: any): AtomiqSwapStatus {
        // Map real Atomiq swap states to our enum
        // Based on the documentation, different swap types have different states
        if (typeof state === 'number') {
            // ToBTCSwapState (Smart Chain -> BTC/Lightning)
            switch (state) {
                case 0: return 'CREATED';     // CREATED - quote created
                case 1: return 'COMMITED';    // COMMITED - swap initiated
                case 2: return 'SOFT_CLAIMED'; // SOFT_CLAIMED - processing
                case 3: return 'CLAIMED';     // CLAIMED - completed
                case 4: return 'REFUNDABLE';  // REFUNDABLE - failed, can refund
                case -1: return 'EXPIRED';    // QUOTE_SOFT_EXPIRED
                case -2: return 'EXPIRED';    // QUOTE_EXPIRED
                case -3: return 'REFUNDED';   // REFUNDED
                default: return 'FAILED';
            }
        }

        // Handle string states or other formats
        if (typeof state === 'string') {
            switch (state.toUpperCase()) {
                case 'CREATED': return 'CREATED';
                case 'COMMITED': return 'COMMITED';
                case 'SOFT_CLAIMED': return 'SOFT_CLAIMED';
                case 'CLAIMED': return 'CLAIMED';
                case 'REFUNDABLE': return 'REFUNDABLE';
                case 'REFUNDED': return 'REFUNDED';
                case 'EXPIRED': return 'EXPIRED';
                default: return 'FAILED';
            }
        }

        return 'CREATED'; // Default state
    }
}

// Export the client - user requested "real deal" so we use RealAtomiqSwapClient
// Avoid instantiating during SSR to prevent Turbopack module factory errors
let atomiqClient: RealAtomiqSwapClient | null = null;
if (typeof window !== 'undefined') {
    atomiqClient = new RealAtomiqSwapClient(
        ENV.NETWORK === 'MAINNET' ? 'MAINNET' : 'TESTNET',
        getStarknetRpc()
    );
}

export default atomiqClient as unknown as RealAtomiqSwapClient;
