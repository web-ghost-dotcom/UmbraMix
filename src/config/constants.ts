export const MIXING_DELAY_MS = 200; // legacy placeholder
export const MIX_MIN_DELAY_MS = 1_000; // 1s minimal jitter window
export const MIX_MAX_DELAY_MS = 15_000; // 15s upper bound (tunable)
export const SPLIT_MAX_PARTS = 8;
export const SPLIT_MIN_DENOM = 1n; // smallest sat denomination for splitting
export const VERSION = '0.0.1-mvp';


export const PRIVACY_MIXER = {
    CONTRACT_ADDRESS: '0x05effdcfda86066c72c108e174c55a4f8d1249ba69f80e975d7fc814199a376b',
    CLASS_HASH: '0x00abc35fe33a082fad61df2a88160f16202d1a08cc338f1954063320063be4d5',
    STRK_TOKEN: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
    DEPLOYMENT_PARAMS: {
        OWNER: '0x01734203d1C5B2699B3dbC50223c86EC59E2B79E2d34CBE8363F0dCCdC1E9634',
        MIN_DEPOSIT: 1000000000000000000n, // 1 STRK
        MAX_DEPOSIT: 1000000000000000000000n, // 1000 STRK
        MIN_DELAY: 0n, // 0 seconds for testing
        MIN_ANONYMITY: 0n, // 0 for testing
        FEE_RATE: 10n // 1% (10000 = 100%)
    }
} as const;

export const SHARED_SWAP_ACCOUNT_ADDRESS = '0x075a05264A7D0ebB864abFbE2bbFeE33D085EB77397b939bD17d55c2e69d87D3';
