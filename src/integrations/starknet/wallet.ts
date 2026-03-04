// Starknet wallet integration for ArgentX and Braavos
import { connect, disconnect } from '@starknet-io/get-starknet';
import { Account, Provider, Contract, CallData, cairo, RpcProvider, num } from 'starknet';
import { PrivacyMixerContract, createPrivacyMixerContract } from './privacy-mixer-contract';

export type WalletType = 'argentX' | 'braavos' | 'bitkeep' | 'okx';

export interface StarknetAccount {
    address: string;
    publicKey: string;
    walletType: WalletType;
    chainId: string;
}

export interface WalletConnection {
    account: Account;
    provider: Provider;
    isConnected: boolean;
    walletType: WalletType;
}

export interface TransactionResult {
    transactionHash: string;
    status: 'PENDING' | 'ACCEPTED_ON_L2' | 'ACCEPTED_ON_L1' | 'REJECTED';
    blockNumber?: number;
    actualFee?: string;
}

export interface TokenBalance {
    symbol: string;
    address: string;
    balance: bigint;
    decimals: number;
}

export interface StarknetWalletClient {
    // Connection management
    connect(preferredWallet?: WalletType): Promise<WalletConnection>;
    disconnect(): Promise<void>;
    isConnected(): boolean;

    // Account operations
    getAccount(): StarknetAccount | null;
    getBalance(tokenAddress?: string): Promise<TokenBalance>;

    // Transaction operations
    sendTransaction(calls: Array<{
        contractAddress: string;
        entrypoint: string;
        calldata: any[];
    }>): Promise<TransactionResult>;

    waitForTransaction(txHash: string, retryInterval?: number): Promise<TransactionResult>;

    // Token operations
    transfer(tokenAddress: string, recipient: string, amount: bigint): Promise<TransactionResult>;
    approve(tokenAddress: string, spender: string, amount: bigint): Promise<TransactionResult>;

    // Multi-account support for privacy
    switchAccount(accountIndex: number): Promise<StarknetAccount>;
    listAccounts(): Promise<StarknetAccount[]>;

    // Contract interactions
    callContract(contractAddress: string, entrypoint: string, calldata: any[]): Promise<any>;

    // Privacy mixer integration methods
    initMixerContract(contractAddress: string): Promise<void>;
    depositToMixer(commitment: string, amount: bigint): Promise<string>;
    withdrawFromMixer(nullifier: string, commitment: string, recipient: string, amount: bigint, proof: string[]): Promise<string>;
    getMixerStats(): Promise<any>;
    getPrivacyMetrics(): Promise<any>;
}

export class RealStarknetWalletClient implements StarknetWalletClient {
    private connection: WalletConnection | null = null;
    private rpcProvider: RpcProvider;
    private mixerContract: PrivacyMixerContract | null = null;
    // Maintain a static/shared connection across instances to avoid duplicate wallet popups
    private static sharedConnection: WalletConnection | null = null;

    constructor(rpcUrl?: string) {
        this.rpcProvider = new RpcProvider({
            nodeUrl: rpcUrl || 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7'
        });
    }

    async connect(preferredWallet?: WalletType): Promise<WalletConnection> {
        try {
            // Check if we have a shared connection and validate it's still working
            if (RealStarknetWalletClient.sharedConnection) {
                try {
                    // Test the connection by trying to access the account address
                    const testAddress = RealStarknetWalletClient.sharedConnection.account.address;
                    if (testAddress) {
                        this.connection = RealStarknetWalletClient.sharedConnection;
                        console.log('🔄 Reusing existing wallet connection', {
                            address: testAddress,
                            walletType: this.connection.walletType
                        });
                        return this.connection;
                    }
                } catch (validationError) {
                    console.warn('⚠️ Cached connection is stale, creating new connection:', validationError);
                    RealStarknetWalletClient.sharedConnection = null;
                }
            }

            if (typeof window === 'undefined') {
                throw new Error('Wallet connection is only available in the browser');
            }

            // Try to connect to a specific injected wallet first
            const w = window as any;
            let injected: any | null = null;
            const want = (preferredWallet || 'argentX').toLowerCase();
            if (want === 'argentx') injected = w.starknet_argentX || null;
            if (want === 'braavos') injected = w.starknet_braavos || injected;
            if (want === 'okx') injected = w.starknet_okxwallet || injected;

            // Only use fallback modal if no injected wallet found AND no shared connection
            let provider: any = injected;
            if (!provider) {
                console.log('🔍 No injected wallet found, trying modal fallback...');
                try {
                    provider = await connect({ modalMode: 'always' } as any);
                } catch (modalError) {
                    console.warn('⚠️ Modal connection failed:', modalError);
                    // ignore and handle below
                }
            }

            if (!provider) {
                throw new Error('No compatible Starknet wallet found');
            }

            // Ask for permissions/enable
            if (typeof provider.enable === 'function') {
                await provider.enable({ showModal: false }).catch(() => { });
            }

            const walletType = this.detectWalletType(provider);
            const account = (provider.account || provider) as unknown as Account;

            // IMPORTANT: Use the wallet's provider, not our RPC provider for wallet operations
            // This ensures we maintain the wallet context for balance queries
            const walletProvider = provider.provider || this.rpcProvider;

            this.connection = {
                account,
                provider: walletProvider, // Use wallet's provider to maintain wallet context
                isConnected: true,
                walletType,
            };

            // Cache globally for subsequent client instances
            RealStarknetWalletClient.sharedConnection = this.connection;
            console.log('✅ New wallet connection established and cached', {
                address: this.connection.account.address,
                walletType: this.connection.walletType,
                providerType: walletProvider === this.rpcProvider ? 'RPC' : 'Wallet'
            });

            return this.connection;
        } catch (error) {
            throw new Error(`Failed to connect to Starknet wallet: ${error}`);
        }
    }

    async disconnect(): Promise<void> {
        if (this.connection) {
            await disconnect();
            this.connection = null;
            // Clear shared connection so next connect will prompt for wallet selection
            RealStarknetWalletClient.sharedConnection = null;
        }
    }

    isConnected(): boolean {
        return this.connection?.isConnected || false;
    }

    getAccount(): StarknetAccount | null {
        if (!this.connection) return null;

        return {
            address: this.connection.account.address,
            publicKey: '', // Public key extraction varies by wallet
            walletType: this.connection.walletType,
            chainId: 'SN_MAIN' // Default to mainnet
        };
    }

    async getBalance(tokenAddress?: string): Promise<TokenBalance> {
        if (!this.connection) {
            throw new Error('Wallet not connected');
        }

        // Handle native STRK vs ERC-20 tokens
        if (!tokenAddress || tokenAddress.toLowerCase() === 'strk' || tokenAddress.toLowerCase() === 'native') {
            // Get native STRK balance using the official STRK token contract
            // Native STRK is actually an ERC-20 token on Starknet
            const NATIVE_STRK_CONTRACT = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'; // Sepolia STRK
            try {
                // Use the same approach as the E2E test - direct contract creation and balance_of call
                const ERC20_ABI = [
                    {
                        name: 'balance_of',
                        type: 'function',
                        inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
                        outputs: [{ type: 'core::integer::u256' }],
                        state_mutability: 'view'
                    }
                ];

                // Use our configured RPC provider instead of wallet's provider for reliability
                // This ensures we use the stable Alchemy endpoint instead of the wallet's default
                const strkContract = new Contract(ERC20_ABI, NATIVE_STRK_CONTRACT, this.rpcProvider);
                const balance = await strkContract.balance_of(this.connection.account.address);

                console.log('💰 STRK balance check via contract:', {
                    address: this.connection.account.address,
                    contract: NATIVE_STRK_CONTRACT,
                    balance: balance.toString()
                });

                return {
                    symbol: 'STRK',
                    address: NATIVE_STRK_CONTRACT,
                    balance: BigInt(balance.toString()),
                    decimals: 18 // STRK has 18 decimals
                };
            } catch (error) {
                console.error('Failed to get STRK balance via contract:', error);
                throw new Error(`Failed to get STRK balance: ${error}`);
            }
        } else {
            // Handle ERC-20 tokens using same pattern as test
            try {
                const ERC20_ABI = [
                    {
                        name: 'balance_of',
                        type: 'function',
                        inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
                        outputs: [{ type: 'core::integer::u256' }],
                        state_mutability: 'view'
                    },
                    {
                        name: 'decimals',
                        type: 'function',
                        inputs: [],
                        outputs: [{ type: 'core::integer::u8' }],
                        state_mutability: 'view'
                    },
                    {
                        name: 'symbol',
                        type: 'function',
                        inputs: [],
                        outputs: [{ type: 'core::felt252' }],
                        state_mutability: 'view'
                    }
                ];

                // Use our configured RPC provider instead of wallet's provider for reliability
                const tokenContract = new Contract(ERC20_ABI, tokenAddress, this.rpcProvider);

                const balance = await tokenContract.balance_of(this.connection.account.address);
                const decimals = await tokenContract.decimals();
                const symbol = await tokenContract.symbol();

                console.log('💰 Token balance check via contract:', {
                    address: this.connection.account.address,
                    contract: tokenAddress,
                    balance: balance.toString(),
                    decimals: decimals.toString(),
                    symbol: symbol.toString()
                });

                return {
                    symbol: num.toHex(symbol), // Convert felt to string
                    address: tokenAddress,
                    balance: BigInt(balance.toString()),
                    decimals: Number(decimals.toString())
                };
            } catch (error) {
                throw new Error(`Failed to get token balance: ${error}`);
            }
        }
    }

    async sendTransaction(calls: Array<{
        contractAddress: string;
        entrypoint: string;
        calldata: any[];
    }>): Promise<TransactionResult> {
        if (!this.connection) {
            throw new Error('Wallet not connected');
        }

        try {
            const result = await this.connection.account.execute(calls);

            return {
                transactionHash: result.transaction_hash,
                status: 'PENDING'
            };
        } catch (error) {
            throw new Error(`Transaction failed: ${error}`);
        }
    }

    async waitForTransaction(
        txHash: string,
        retryInterval: number = 5000
    ): Promise<TransactionResult> {
        if (!this.connection) {
            throw new Error('Wallet not connected');
        }

        try {
            const receipt = await this.rpcProvider.waitForTransaction(txHash);

            return {
                transactionHash: txHash,
                status: receipt.isSuccess() ? 'ACCEPTED_ON_L2' : 'REJECTED',
                blockNumber: (receipt as any).block_number || undefined,
                actualFee: (receipt as any).actual_fee?.toString() || undefined
            };
        } catch (error) {
            throw new Error(`Failed to wait for transaction: ${error}`);
        }
    }

    async transfer(
        tokenAddress: string,
        recipient: string,
        amount: bigint
    ): Promise<TransactionResult> {
        // Handle native STRK vs ERC-20 tokens
        if (!tokenAddress || tokenAddress.toLowerCase() === 'strk' || tokenAddress.toLowerCase() === 'native') {
            // Native STRK transfer - direct account execution
            const calls = [{
                contractAddress: recipient,
                entrypoint: '__default__', // Native transfer entrypoint
                calldata: CallData.compile([cairo.uint256(amount)])
            }];

            return this.sendTransaction(calls);
        } else {
            // ERC-20 token transfer
            const calls = [{
                contractAddress: tokenAddress,
                entrypoint: 'transfer',
                calldata: CallData.compile([recipient, cairo.uint256(amount)])
            }];

            return this.sendTransaction(calls);
        }
    }

    async approve(
        tokenAddress: string,
        spender: string,
        amount: bigint
    ): Promise<TransactionResult> {
        // Native STRK doesn't need approval - only ERC-20 tokens do
        if (!tokenAddress || tokenAddress.toLowerCase() === 'strk' || tokenAddress.toLowerCase() === 'native') {
            throw new Error('Native STRK does not require approval - use direct transfer');
        }

        // ERC-20 token approval
        const calls = [{
            contractAddress: tokenAddress,
            entrypoint: 'approve',
            calldata: CallData.compile([spender, cairo.uint256(amount)])
        }];

        return this.sendTransaction(calls);
    }

    async switchAccount(accountIndex: number): Promise<StarknetAccount> {
        // This would depend on wallet's multi-account support
        // For now, return current account
        const account = this.getAccount();
        if (!account) {
            throw new Error('No account connected');
        }
        return account;
    }

    async listAccounts(): Promise<StarknetAccount[]> {
        // This would query the wallet for all available accounts
        // For now, return current account
        const account = this.getAccount();
        return account ? [account] : [];
    }

    async callContract(
        contractAddress: string,
        entrypoint: string,
        calldata: any[]
    ): Promise<any> {
        if (!this.connection) {
            throw new Error('Wallet not connected');
        }

        return this.rpcProvider.callContract({
            contractAddress,
            entrypoint,
            calldata
        });
    }

    // Privacy mixer contract integration
    async initMixerContract(contractAddress: string): Promise<void> {
        if (!this.connection) {
            throw new Error('No wallet connected');
        }

        try {
            // Create contract directly since we already have the connected account
            this.mixerContract = new PrivacyMixerContract(
                contractAddress,
                this.connection.account,
                this.rpcProvider
            );
        } catch (error) {
            console.error('Failed to initialize mixer contract:', error);
            throw error;
        }
    }

    async depositToMixer(commitment: string, amount: bigint): Promise<string> {
        if (!this.mixerContract) {
            throw new Error('Mixer contract not initialized. Call initMixerContract first.');
        }
        if (!this.connection) {
            throw new Error('No wallet connected');
        }

        try {
            // Use sendTransaction directly instead of Contract wrapper.
            // The wallet's injected account proxy is not a real starknet.js Account
            // instance, so Contract.connect(account) doesn't recognise it as a signer
            // and the call never triggers the wallet signing popup.
            // Going through sendTransaction → connection.account.execute() works
            // (same path the working approve() uses).
            const commitmentFelt = commitment.startsWith('0x') ? commitment : '0x' + commitment;
            const contractAddress = this.mixerContract.getAddress();
            console.log('💰 depositToMixer: Building raw transaction', {
                contractAddress,
                commitment: commitmentFelt,
                amountWei: amount.toString()
            });

            const calls = [{
                contractAddress,
                entrypoint: 'deposit',
                calldata: CallData.compile([commitmentFelt, cairo.uint256(amount)])
            }];

            const result = await this.sendTransaction(calls);
            return result.transactionHash;
        } catch (error) {
            console.error('Failed to deposit to mixer:', error);
            throw error;
        }
    }

    async withdrawFromMixer(
        nullifier: string,
        commitment: string,
        recipient: string,
        amount: bigint,
        proof: string[]
    ): Promise<string> {
        if (!this.mixerContract) {
            throw new Error('Mixer contract not initialized. Call initMixerContract first.');
        }
        if (!this.connection) {
            throw new Error('No wallet connected');
        }

        try {
            // Use sendTransaction directly – same fix as depositToMixer.
            const nullifierFelt = nullifier.startsWith('0x') ? nullifier : '0x' + nullifier;
            const commitmentFelt = commitment.startsWith('0x') ? commitment : '0x' + commitment;
            const contractAddress = this.mixerContract.getAddress();
            console.log('💰 withdrawFromMixer: Building raw transaction', {
                contractAddress,
                nullifier: nullifierFelt,
                commitment: commitmentFelt,
                recipient,
                amountWei: amount.toString()
            });

            const calls = [{
                contractAddress,
                entrypoint: 'withdraw',
                calldata: CallData.compile([
                    nullifierFelt,
                    commitmentFelt,
                    recipient,
                    cairo.uint256(amount),
                    proof
                ])
            }];

            const result = await this.sendTransaction(calls);
            return result.transactionHash;
        } catch (error) {
            console.error('Failed to withdraw from mixer:', error);
            throw error;
        }
    }

    async getMixerStats(): Promise<any> {
        if (!this.mixerContract) {
            throw new Error('Mixer contract not initialized. Call initMixerContract first.');
        }

        return await this.mixerContract.get_mixing_stats();
    }

    async getPrivacyMetrics(): Promise<any> {
        if (!this.mixerContract) {
            throw new Error('Mixer contract not initialized. Call initMixerContract first.');
        }

        return await this.mixerContract.verify_privacy_guarantees();
    }

    private detectWalletType(starknet: any): WalletType {
        // Detect wallet type based on provider details
        if (starknet.id?.includes('argentX')) return 'argentX';
        if (starknet.id?.includes('braavos')) return 'braavos';
        if (starknet.id?.includes('bitkeep')) return 'bitkeep';
        if (starknet.id?.includes('okx')) return 'okx';

        // Default fallback
        return 'argentX';
    }
}

// Mock implementation for testing
export class MockStarknetWalletClient implements StarknetWalletClient {
    private connected = false;
    private mockAccount: StarknetAccount = {
        address: '0x123...mock',
        publicKey: '0xabc...mock',
        walletType: 'argentX',
        chainId: 'SN_MAIN'
    };

    async connect(preferredWallet?: WalletType): Promise<WalletConnection> {
        this.connected = true;
        return {
            account: {} as Account,
            provider: {} as Provider,
            isConnected: true,
            walletType: preferredWallet || 'argentX'
        };
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    getAccount(): StarknetAccount | null {
        return this.connected ? this.mockAccount : null;
    }

    async getBalance(tokenAddress?: string): Promise<TokenBalance> {
        return {
            symbol: 'STRK',
            address: tokenAddress || '0x123...strk',
            balance: BigInt(1000000),
            decimals: 18
        };
    }

    async sendTransaction(calls: any): Promise<TransactionResult> {
        return {
            transactionHash: '0x' + Date.now().toString(16),
            status: 'PENDING'
        };
    }

    async waitForTransaction(txHash: string): Promise<TransactionResult> {
        return {
            transactionHash: txHash,
            status: 'ACCEPTED_ON_L2',
            blockNumber: 123456
        };
    }

    async transfer(tokenAddress: string, recipient: string, amount: bigint): Promise<TransactionResult> {
        return this.sendTransaction([]);
    }

    async approve(tokenAddress: string, spender: string, amount: bigint): Promise<TransactionResult> {
        return this.sendTransaction([]);
    }

    async switchAccount(accountIndex: number): Promise<StarknetAccount> {
        return this.mockAccount;
    }

    async listAccounts(): Promise<StarknetAccount[]> {
        return [this.mockAccount];
    }

    async callContract(contractAddress: string, entrypoint: string, calldata: any[]): Promise<any> {
        return { result: ['0x123'] };
    }

    async initMixerContract(_contractAddress: string): Promise<void> {
        // Mock implementation - no-op
    }

    async depositToMixer(_commitment: string, _amount: bigint): Promise<string> {
        return '0x' + Date.now().toString(16);
    }

    async withdrawFromMixer(
        _nullifier: string,
        _commitment: string,
        _recipient: string,
        _amount: bigint,
        _proof: string[]
    ): Promise<string> {
        return '0x' + Date.now().toString(16);
    }

    async getMixerStats(): Promise<any> {
        return {
            total_deposits: 1000n,
            total_withdrawals: 500n,
            active_commitments: 500n,
            anonymity_set_size: 100n,
            mixing_efficiency: 95n,
        };
    }

    async getPrivacyMetrics(): Promise<any> {
        return {
            min_anonymity_set: 10n,
            avg_mixing_time: 3600n,
            unlinkability_score: 95n,
            temporal_privacy_score: 90n,
        };
    }
}

// Wallet connection manager
export class StarknetWalletManager {
    private clients = new Map<WalletType, StarknetWalletClient>();
    private activeClient: StarknetWalletClient | null = null;

    constructor() {
        // Initialize supported wallet clients
        this.clients.set('argentX', new RealStarknetWalletClient());
        this.clients.set('braavos', new RealStarknetWalletClient());
        this.clients.set('okx', new RealStarknetWalletClient());
    }

    async connectWallet(preferredWallet?: WalletType): Promise<WalletConnection> {
        const client = preferredWallet ?
            this.clients.get(preferredWallet) :
            this.clients.get('argentX');

        if (!client) {
            throw new Error(`Unsupported wallet: ${preferredWallet}`);
        }

        const connection = await client.connect(preferredWallet);
        this.activeClient = client;
        return connection;
    }

    getActiveClient(): StarknetWalletClient | null {
        return this.activeClient;
    }

    async disconnectAll(): Promise<void> {
        if (this.activeClient) {
            await this.activeClient.disconnect();
            this.activeClient = null;
        }
    }

    getSupportedWallets(): WalletType[] {
        return Array.from(this.clients.keys());
    }
}
