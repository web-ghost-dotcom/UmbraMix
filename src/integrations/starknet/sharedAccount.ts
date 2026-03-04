import { Account, RpcProvider, ec, cairo, CallData } from 'starknet';
import { StarknetSigner } from '@atomiqlabs/chain-starknet';
import { SHARED_SWAP_ACCOUNT_ADDRESS } from '@/config/constants';
import { ENV, getStarknetRpc } from '@/config/env';
import { PRIVACY_MIXER } from '@/config/constants';

// Lazy singleton for shared swap account (prototype only)
let sharedAccount: Account | null = null;
let sharedSigner: StarknetSigner | null = null;
let sharedProvider: RpcProvider | null = null;

export function getSharedSwapAccount(): StarknetSigner | null {
    if (sharedSigner) return sharedSigner;
    if (!ENV.SHARED_SWAP_ACCOUNT_PRIVATE_KEY) {
        return null; // Not configured
    }

    const address = (ENV.SHARED_SWAP_ACCOUNT_ADDRESS || SHARED_SWAP_ACCOUNT_ADDRESS).toLowerCase();
    const provider = new RpcProvider({ nodeUrl: getStarknetRpc() });
    sharedProvider = provider;

    try {
        // Validate private key (basic length/hex check)
        const pk = ENV.SHARED_SWAP_ACCOUNT_PRIVATE_KEY.startsWith('0x')
            ? ENV.SHARED_SWAP_ACCOUNT_PRIVATE_KEY
            : '0x' + ENV.SHARED_SWAP_ACCOUNT_PRIVATE_KEY;

        if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
            console.warn('Shared swap account private key format unexpected');
        }

        // Derive public key just for logging (not strictly needed)
        try {
            const pub = ec.starkCurve.getStarkKey(pk);
            console.log('🔐 Shared swap account loaded (pubkey prefix):', pub.slice(0, 10) + '...');
        } catch (e) {
            console.warn('Could not derive public key for shared swap account:', e);
        }

        sharedAccount = new Account(provider, address, pk);
        sharedSigner = new StarknetSigner(sharedAccount);
        return sharedSigner;
    } catch (e) {
        console.error('Failed to instantiate shared swap account:', e);
        return null;
    }
}

export function getSharedSwapProvider(): RpcProvider | null {
    return sharedProvider;
}

export function getSharedSwapAccountRaw(): Account | null {
    // Get the raw Account for contracts that need it
    if (!sharedSigner) {
        // Try to initialize if not already done
        getSharedSwapAccount();
    }
    return sharedAccount;
}

// Quick runtime validation to catch mismatched private key/address early
export async function validateSharedSwapSigner(): Promise<{ ok: boolean; reason?: string; address?: string }> {
    try {
        const signer = getSharedSwapAccount();
        const acct = getSharedSwapAccountRaw();
        const provider = getSharedSwapProvider();
        if (!signer || !acct || !provider) {
            return { ok: false, reason: 'Shared swap signer not configured (missing env or provider)' };
        }

        // Try to fetch nonce as a lightweight liveness check
        try {
            const nonce = await acct.getNonce();
            console.log('✅ Shared swap account validation OK', { address: acct.address, nonce: nonce?.toString?.() || String(nonce) });
            return { ok: true, address: acct.address };
        } catch (e) {
            console.warn('⚠️ Shared swap account nonce check failed', { address: acct.address, error: e instanceof Error ? e.message : String(e) });
            return { ok: false, reason: 'Account nonce fetch failed (address may be wrong or not deployed)', address: acct.address };
        }
    } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
}

export function getSharedSwapAddress(): string | null {
    if (!sharedSigner) getSharedSwapAccount();
    return sharedAccount?.address || null;
}

// Transfer STRK from the shared account to a recipient (amount in Wei)
export async function transferStrkFromShared(to: string, amountWei: bigint): Promise<string> {
    const acct = getSharedSwapAccountRaw();
    if (!acct) throw new Error('Shared swap account not configured');

    const token = PRIVACY_MIXER.STRK_TOKEN;
    const call = {
        contractAddress: token,
        entrypoint: 'transfer',
        calldata: CallData.compile([to, cairo.uint256(amountWei)])
    } as const;

    const res = await acct.execute([call]);
    const txHash = (res as any).transaction_hash || (res as any).hash || 'unknown_tx';
    console.log('🚚 Shared STRK forward transfer submitted:', { to, amountWei: amountWei.toString(), txHash });
    return txHash;
}
