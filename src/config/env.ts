// Centralized environment parsing and defaults

export const ENV = {
    NETWORK: (process.env.NEXT_PUBLIC_NETWORK || 'MAINNET') as 'MAINNET' | 'TESTNET',

    // Starknet RPC Configuration
    STARKNET_RPC: process.env.NEXT_PUBLIC_STARKNET_RPC || process.env.STARKNET_RPC || '',
    STARKNET_PRIVATE_KEY: process.env.STARKNET_PRIVATE_KEY || '',
    SHARED_SWAP_ACCOUNT_PRIVATE_KEY: process.env.SHARED_SWAP_ACCOUNT_PRIVATE_KEY || process.env.NEXT_PUBLIC_SHARED_SWAP_ACCOUNT_PRIVATE_KEY || '',
    // Optional: allow overriding address via env (falls back to constant)
    SHARED_SWAP_ACCOUNT_ADDRESS: process.env.SHARED_SWAP_ACCOUNT_ADDRESS || '',

    // Privacy Mixer Contract
    MIXER_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_MIXER_CONTRACT_ADDRESS || process.env.MIXER_CONTRACT_ADDRESS || '',

    // Lightning Network Configuration
    LND_URL: process.env.NEXT_PUBLIC_LND_URL || process.env.LND_URL || '',
    LND_MACAROON: process.env.NEXT_PUBLIC_LND_MACAROON || process.env.LND_MACAROON || '',
    LND_TLS: process.env.NEXT_PUBLIC_LND_TLS || process.env.LND_TLS || '',

    // Cashu Configuration
    CASHU_MINTS: (process.env.NEXT_PUBLIC_CASHU_MINTS || process.env.CASHU_MINTS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    CASHU_DEFAULT_MINT:
        process.env.NEXT_PUBLIC_CASHU_MINT || process.env.CASHU_MINT || 'https://mint.coinos.io',

    // Privacy behavior overrides
    CASHU_SINGLE_MINT:
        (process.env.NEXT_PUBLIC_CASHU_SINGLE_MINT || process.env.CASHU_SINGLE_MINT || 'false') === 'true',
    DISABLE_CASHU_SPLIT:
        (process.env.NEXT_PUBLIC_DISABLE_CASHU_SPLIT || process.env.DISABLE_CASHU_SPLIT || 'false') === 'true',

    // Rate / Pricing Overrides
    // If STRK_BTC_RATE provided (BTC per STRK), convert to sats; else use explicit STRK_SATS_RATE; else default 125
    STRK_BTC_RATE: Number(process.env.NEXT_PUBLIC_STRK_BTC_RATE || process.env.STRK_BTC_RATE || '0'),
    STRK_SATS_RATE: (() => {
        const explicit = process.env.NEXT_PUBLIC_STRK_SATS_RATE || process.env.STRK_SATS_RATE;
        if (explicit) return Number(explicit);
        const btcPerStrk = Number(process.env.NEXT_PUBLIC_STRK_BTC_RATE || process.env.STRK_BTC_RATE || '0');
        if (btcPerStrk && !isNaN(btcPerStrk) && btcPerStrk > 0) {
            return Math.floor(btcPerStrk * 100_000_000); // sats
        }
        return 125; // updated conservative default
    })(),
    DISABLE_ATOMIQ_PRICE_FETCH: (process.env.NEXT_PUBLIC_DISABLE_ATOMIQ_PRICE_FETCH || process.env.DISABLE_ATOMIQ_PRICE_FETCH || 'false') === 'true',
    ALLOW_SWAP_PRICE_FALLBACK: process.env.ALLOW_SWAP_PRICE_FALLBACK === 'true' || false // Real swaps only
};

export type Network = typeof ENV.NETWORK;

// Get default RPC based on network if not configured
export function getStarknetRpc(): string {
    if (ENV.STARKNET_RPC) {
        return ENV.STARKNET_RPC;
    }

    // Use network-specific defaults
    switch (ENV.NETWORK) {
        case 'MAINNET':
            return 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_8/kwgGr9GGk4YyLXuGfEvpITv1jpvn3PgP';
        case 'TESTNET':
            return 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
        default:
            return 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_8/kwgGr9GGk4YyLXuGfEvpITv1jpvn3PgP';  // Default to mainnet now
    }
}

/**
 * RPC URL specifically for the Atomiq SDK.
 * Uses the configured Alchemy RPC (v0.8) which supports CORS from the browser.
 */
export function getAtomiqRpc(): string {
    // Allow explicit override
    const override = process.env.NEXT_PUBLIC_ATOMIQ_RPC || process.env.ATOMIQ_RPC;
    if (override) return override;

    // Use the configured Alchemy RPC directly (v0.8, CORS-enabled)
    const configuredRpc = ENV.STARKNET_RPC;
    if (configuredRpc) return configuredRpc;

    // Fallback: BlastAPI v0.8
    switch (ENV.NETWORK) {
        case 'MAINNET':
            return 'https://starknet-mainnet.public.blastapi.io/rpc/v0_8';
        case 'TESTNET':
            return 'https://starknet-sepolia.public.blastapi.io/rpc/v0_8';
        default:
            return 'https://starknet-mainnet.public.blastapi.io/rpc/v0_8';
    }
}

// Configuration validation
export function validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Critical validations
    if (!ENV.NETWORK || !['MAINNET', 'TESTNET'].includes(ENV.NETWORK)) {
        errors.push('Invalid network configuration');
    }

    if (!ENV.CASHU_DEFAULT_MINT) {
        errors.push('No Cashu mint configured');
    }

    // Testnet readiness warnings
    if (!ENV.STARKNET_RPC) {
        warnings.push(`Using default ${ENV.NETWORK} Starknet RPC - configure STARKNET_RPC for better reliability`);
    }

    if (!ENV.LND_URL) {
        warnings.push('Lightning node URL not configured - using fallback mode');
    }

    if (ENV.CASHU_MINTS.length === 0) {
        warnings.push('No multi-mint configuration - using single mint mode');
    }

    if (!ENV.STARKNET_PRIVATE_KEY && typeof window === 'undefined') {
        warnings.push('No Starknet private key configured for server-side operations');
    }

    // Shared swap account checks (prototype central account approach)
    if (!ENV.SHARED_SWAP_ACCOUNT_PRIVATE_KEY) {
        warnings.push('Shared swap account private key not set (SHARED_SWAP_ACCOUNT_PRIVATE_KEY) - STRK -> Lightning swaps may fail to sign');
    }

    // Log warnings
    warnings.forEach(warning => console.warn(warning));

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

// Check if configuration is ready for testnet testing
export function isTestnetReady(): boolean {
    const checks = [
        ENV.NETWORK === 'TESTNET' &&
        ENV.STARKNET_RPC &&
        ENV.STARKNET_PRIVATE_KEY &&
        ENV.CASHU_DEFAULT_MINT
    ];

    return checks.every(Boolean);
}

// Check if configuration is ready for mainnet operations
export function isMainnetReady(): boolean {
    const isClientSide = typeof window !== 'undefined';

    const checks = [
        ENV.NETWORK === 'MAINNET' &&
        ENV.STARKNET_RPC &&
        (isClientSide || ENV.STARKNET_PRIVATE_KEY) && // Private key only required server-side
        ENV.CASHU_DEFAULT_MINT &&
        ENV.LND_URL && ENV.LND_MACAROON  // Lightning required for mainnet
    ];

    return checks.every(Boolean);
}

// Get network configuration status
export function getNetworkStatus(): {
    network: string;
    starknetRpc: boolean;
    privateKey: boolean;
    cashuMint: boolean;
    lightningNode: boolean;
    lightningConfigured: boolean;
    cashuMints: number;
    ready: boolean;
    warnings: string[];
} {
    const lightningConfigured = Boolean(ENV.LND_URL && ENV.LND_MACAROON);
    const isReady = ENV.NETWORK === 'MAINNET' ? isMainnetReady() : isTestnetReady();

    return {
        network: ENV.NETWORK,
        starknetRpc: Boolean(ENV.STARKNET_RPC),
        privateKey: Boolean(ENV.STARKNET_PRIVATE_KEY),
        cashuMint: Boolean(ENV.CASHU_DEFAULT_MINT),
        lightningNode: Boolean(ENV.LND_URL),
        lightningConfigured,
        cashuMints: ENV.CASHU_MINTS.length,
        ready: isReady,
        warnings: (() => {
            const warnings = [];
            const isClientSide = typeof window !== 'undefined';

            if (!ENV.STARKNET_RPC) warnings.push('STARKNET_RPC not configured');
            if (!ENV.STARKNET_PRIVATE_KEY && !isClientSide) warnings.push('STARKNET_PRIVATE_KEY not configured');
            if (!ENV.CASHU_DEFAULT_MINT) warnings.push('CASHU_DEFAULT_MINT not configured');
            if (ENV.NETWORK === 'MAINNET') {
                if (!ENV.LND_URL) warnings.push('Lightning node (LND_URL) required for mainnet');
                if (!ENV.LND_MACAROON) warnings.push('Lightning authentication (LND_MACAROON) required for mainnet');
            }
            return warnings;
        })()
    };
}

// Backward compatibility
export function getTestnetStatus() {
    return getNetworkStatus();
}

// Initialize configuration validation
export const CONFIG_STATUS = validateConfig();