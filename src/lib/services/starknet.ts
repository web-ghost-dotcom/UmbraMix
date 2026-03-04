// DEPRECATED: This file contained mock implementations
// Real Starknet integration is now handled by:
// - /src/integrations/starknet/wallet.ts (Real wallet client)
// - /src/integrations/starknet/privacy-mixer-contract.ts (Contract interface)  
// - /src/orchestrator/steps/deposit.ts (Real deposit implementation)
// - /src/orchestrator/steps/withdraw.ts (Real withdrawal implementation)

import { MixRequest } from '../types';

export async function connectWallet(walletId: string) {
    console.warn('🚧 DEPRECATED: connectWallet() - Use RealStarknetWalletClient instead');
    throw new Error('This mock function has been replaced with real Starknet integration');
}

export async function depositSTRK(amount: number) {
    console.warn('🚧 DEPRECATED: depositSTRK() - Use stepDeposit() instead');
    throw new Error('This mock function has been replaced with real mixer contract integration');
}

export async function withdrawSTRK(amount: number, destinations: string[]) {
    console.warn('🚧 DEPRECATED: withdrawSTRK() - Use stepWithdraw() instead');
    throw new Error('This mock function has been replaced with real mixer contract integration');
}

export async function estimateAnonymitySet(req: MixRequest) {
    // Keep this as it's still used for local estimation
    const base = req.privacyLevel === 'maximum' ? 150 : req.privacyLevel === 'enhanced' ? 80 : 30;
    const extras = (req.enableSplitOutputs ? req.splitCount * 2 : 0) +
        (req.enableRandomizedMints ? 15 : 0) +
        (req.enableTimeDelays ? 10 : 0);
    await delay(200);
    return base + extras;
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
