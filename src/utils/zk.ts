// Shared zero-knowledge related helpers aligning EXACTLY with Cairo contract logic
// Contract formulas (see contract/src/privacy_mixer.cairo):
// commitment = Poseidon(secret, amount.low, amount.high)
// nullifier  = Poseidon(secret, commitment)
// proof      = [secret, hash(recipient), hash(amount.low, amount.high)]

import { hash, num, uint256 } from 'starknet';

export interface CommitmentArtifacts {
    commitment: string; // hex 0x
    nullifier: string;  // hex 0x
    secret: string;     // hex 0x (felt)
    amountLow: bigint;
    amountHigh: bigint;
}

export function generateSecret(): string {
    // 31 random bytes -> fits in felt252
    const bytes = crypto.getRandomValues(new Uint8Array(31));
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateCommitmentArtifacts(secretHex: string, amount: bigint): CommitmentArtifacts {
    if (!secretHex.startsWith('0x')) throw new Error('secret must be 0x-prefixed');
    const secretBig = BigInt(secretHex);
    const { low, high } = uint256.bnToUint256(amount);
    const commitment = hash.computePoseidonHashOnElements([secretBig, BigInt(low), BigInt(high)]);
    const nullifier = hash.computePoseidonHashOnElements([secretBig, BigInt(commitment)]);
    return {
        commitment: num.toHex(commitment),
        nullifier: num.toHex(nullifier),
        secret: secretHex,
        amountLow: BigInt(low),
        amountHigh: BigInt(high)
    };
}

export function generateProof(secretHex: string, amount: bigint, recipientHex: string): string[] {
    const secretBig = BigInt(secretHex);
    const recipientBig = BigInt(recipientHex);
    const { low, high } = uint256.bnToUint256(amount);
    const recipientHash = hash.computePoseidonHashOnElements([recipientBig]);
    const amountHash = hash.computePoseidonHashOnElements([BigInt(low), BigInt(high)]);
    return [secretHex, num.toHex(recipientHash), num.toHex(amountHash)];
}

export function recomputeCommitment(secretHex: string, amount: bigint): string {
    const secretBig = BigInt(secretHex);
    const { low, high } = uint256.bnToUint256(amount);
    const commitment = hash.computePoseidonHashOnElements([secretBig, BigInt(low), BigInt(high)]);
    return num.toHex(commitment);
}

export function recomputeNullifier(secretHex: string, commitmentHex: string): string {
    const secretBig = BigInt(secretHex);
    const commitmentBig = BigInt(commitmentHex);
    const nullifier = hash.computePoseidonHashOnElements([secretBig, commitmentBig]);
    return num.toHex(nullifier);
}
