/**
 * Direct Cashu integration following standalone script pattern exactly
 * Receive token ONCE, then use received proofs for all operations
 */

/**
 * Server-side Cashu operations following standalone script pattern exactly
 * 1. Receive token ONCE and immediately melt (with built-in retry)
 * 2. Retry capability built into single API call
 * 3. Never try to receive same token twice
 */
export async function serverSideCashuMelt(
    encodedToken: string,
    invoice: string,
    quoteId?: string // Optional for backward compatibility
): Promise<{ success: true; result: { invoiceAmount: number; change: any[]; changeAmount: number; mintUrl: string } } | { success: false; error: string; details?: any; rescueToken?: string }> {
    try {
        console.log('🔍 Server-side Cashu Melt: Starting single-API melt with retry...');

        const response = await fetch('/api/cashu/receive-and-melt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                encodedToken,
                invoice
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Server-side Cashu Melt: API error:', data);

            // Handle specific insufficient balance error
            if (data.error === 'INSUFFICIENT_BALANCE') {
                return {
                    success: false,
                    error: 'Insufficient balance for invoice + fees',
                    details: data.details,
                    rescueToken: data.rescueToken
                };
            }

            return {
                success: false,
                error: data.error || 'Server-side melt failed',
                rescueToken: data.rescueToken // may be undefined — that's fine
            };
        }

        console.log('✅ Server-side Cashu Melt: Completed successfully:', data.result);

        return {
            success: true,
            result: data.result
        };

    } catch (error) {
        console.error('❌ Server-side Cashu Melt: Network error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error during melt'
        };
    }
}

/**
 * Pre-calculate maximum invoice amount that will fit in token balance
 * Fee budget accounts for:
 *   - wallet.receive() swap fee (~1-2% depending on mint)
 *   - melt fee_reserve (typically max(2, 0.02*amount) + 1)
 * We use a conservative formula so the melt never fails with "Not enough balance".
 */
export async function calculateMaxInvoiceAmount(encodedToken: string): Promise<{ success: true; maxAmount: number; availableBalance: number } | { success: false; error: string }> {
    try {
        console.log('🧮 Calculating max invoice amount from token balance...');

        // Import here to avoid issues if running client-side
        const { getDecodedToken } = await import('@cashu/cashu-ts');

        // Decode token to get available balance
        const decoded = getDecodedToken(encodedToken);
        const availableBalance = decoded.proofs.reduce((sum: number, p: any) => sum + p.amount, 0);

        // After wallet.receive() on the server, ~1-2 sats are lost to the receive
        // swap fee. Then meltProofs needs invoice_amount + fee_reserve.
        // fee_reserve ≈ max(2, ceil(0.02 * amount)) + 1  (conservative 2% estimate)
        // receive_fee ≈ max(2, ceil(0.02 * balance))
        //
        // Solve for maxAmount: maxAmount + max(2, ceil(0.02*maxAmount)) + 1 + receiveFee <= balance
        const receiveFee = Math.max(2, Math.ceil(0.02 * availableBalance));
        const effectiveBalance = availableBalance - receiveFee;

        let maxAmount = 0;
        for (let testAmount = 1; testAmount <= effectiveBalance; testAmount++) {
            const estimatedMeltFee = Math.max(2, Math.ceil(0.02 * testAmount)) + 1;
            const totalRequired = testAmount + estimatedMeltFee;

            if (totalRequired <= effectiveBalance) {
                maxAmount = testAmount;
            } else {
                break; // Found the limit
            }
        }

        console.log('✅ Max invoice calculation:', {
            availableBalance,
            receiveFee,
            effectiveBalance,
            maxAmount,
            estimatedMeltFee: Math.max(2, Math.ceil(0.02 * maxAmount)) + 1
        });

        return {
            success: true,
            maxAmount,
            availableBalance
        };

    } catch (error) {
        console.error('❌ Failed to calculate max invoice amount:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Calculation failed'
        };
    }
}

/**
 * Helper function to retrieve encoded token from storage
 */
export async function getEncodedTokenFromStorage(quoteId: string): Promise<string | null> {
    console.log('🔍 Getting encoded token from storage for quote:', quoteId);

    try {
        // Try browser localStorage first
        if (typeof window !== 'undefined') {
            const key = `slpm:cashu-token:${quoteId}`;
            const token = window.localStorage.getItem(key);
            if (token) {
                console.log('✅ Found token in localStorage');
                return token;
            }
        }

        // Try server-side storage
        if (typeof window === 'undefined') {
            try {
                const { default: TokenVault } = await import(/* webpackIgnore: true */ '@/storage/tokenVault.server');
                const tokenData = await TokenVault.get(quoteId);
                if (tokenData?.token) {
                    console.log('✅ Found token in server vault');
                    return tokenData.token;
                }
            } catch (e) {
                console.warn('⚠️ Could not access server vault:', e);
            }
        }

        console.warn('❌ No encoded token found for quote:', quoteId);
        return null;

    } catch (error) {
        console.error('❌ Error retrieving encoded token:', error);
        return null;
    }
}