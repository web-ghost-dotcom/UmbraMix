// Starknet address validation utility

/**
 * Validates a Starknet address format.
 * A valid Starknet address is a hex string 0x-prefixed, up to 66 chars total (0x + 64 hex digits).
 * Returns { valid: boolean, error?: string }
 */
export function validateStarknetAddress(address: string): { valid: boolean; error?: string } {
    if (!address || typeof address !== 'string') {
        return { valid: false, error: 'Address is required' };
    }

    const trimmed = address.trim();

    if (!trimmed.startsWith('0x') && !trimmed.startsWith('0X')) {
        return { valid: false, error: 'Address must start with 0x' };
    }

    const hexPart = trimmed.slice(2);

    if (hexPart.length === 0) {
        return { valid: false, error: 'Address is too short' };
    }

    if (hexPart.length > 64) {
        return { valid: false, error: 'Address is too long (max 66 chars including 0x)' };
    }

    if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
        return { valid: false, error: 'Address contains invalid characters (only hex digits allowed)' };
    }

    // Check it's not the zero address
    if (/^0+$/.test(hexPart)) {
        return { valid: false, error: 'Cannot send to the zero address' };
    }

    return { valid: true };
}

/**
 * Validates the STRK amount for mixing.
 * Returns { valid: boolean, error?: string }
 */
export function validateMixAmount(amount: number): { valid: boolean; error?: string } {
    if (isNaN(amount) || amount <= 0) {
        return { valid: false, error: 'Amount must be greater than 0' };
    }

    if (amount < 1) {
        return { valid: false, error: 'Minimum mix amount is 1 STRK' };
    }

    if (amount > 10000) {
        return { valid: false, error: 'Maximum mix amount is 10,000 STRK' };
    }

    return { valid: true };
}
