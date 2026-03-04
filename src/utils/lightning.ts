// Utility functions for Lightning Network operations

/**
 * Generates a valid mock Lightning invoice (bolt11 format) for testing
 * @param amountSats Amount in satoshis
 * @param description Optional description for the invoice
 * @param suffix Optional suffix for unique identification
 * @returns A properly formatted mock bolt11 invoice
 */
export function generateMockInvoice(
    amountSats: number,
    description?: string,
    suffix?: string
): string {
    // Convert sats to milli-satoshis for bolt11 format
    const amountMsat = amountSats * 1000;

    // Generate a mock invoice with proper bolt11 structure
    // Format: lnbc[amount][multiplier]1[data]
    // Where multiplier: p=pico (10^-12), n=nano (10^-9), u=micro (10^-6), m=milli (10^-3)

    let amountStr = '';
    if (amountMsat >= 1000) {
        amountStr = Math.floor(amountMsat / 1000).toString() + 'm'; // milli-bitcoin
    } else if (amountMsat >= 1) {
        amountStr = amountMsat.toString() + 'p'; // pico-bitcoin (msat)
    }

    // Generate mock data section (normally contains payment hash, expiry, etc.)
    const mockId = suffix || Math.random().toString(36).substring(2, 10);
    const mockData = `pp5qqqsysgq9q5sqqqqqq5sqqqqq5qz8d5qhqqqqqeqq8z5sq9q5sqqqq8z5sq5qqqqqqqqqqqqqqq${mockId}`;

    return `lnbc${amountStr}1${mockData}`;
}

/**
 * Validates if a string looks like a Lightning invoice
 * @param invoice The invoice string to validate
 * @returns true if it looks like a valid invoice format
 */
export function isValidInvoiceFormat(invoice: string): boolean {
    // Basic format check: starts with ln, has minimum length
    return invoice.startsWith('ln') && invoice.length > 50;
}

/**
 * Extracts amount from a mock invoice for testing
 * @param invoice Mock lightning invoice
 * @returns Amount in satoshis, or 0 if cannot parse
 */
export function extractMockInvoiceAmount(invoice: string): number {
    try {
        const match = invoice.match(/^lnbc(\d+)([pmnu]?)1/);
        if (!match) return 0;

        const amount = parseInt(match[1]);
        const multiplier = match[2];

        switch (multiplier) {
            case 'p': return Math.floor(amount / 1000); // pico to sats
            case 'n': return amount * 1000; // nano to sats  
            case 'u': return amount * 1000000; // micro to sats
            case 'm': return amount * 100000000; // milli to sats
            default: return amount; // assume sats
        }
    } catch {
        return 0;
    }
}
