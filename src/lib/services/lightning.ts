export async function createInvoice(amountSats: number) {
    await delay(400);
    return { invoice: 'lnbc' + Math.random().toString(36).slice(2), amountSats };
}

export async function payInvoice(invoice: string) {
    await delay(900);
    return { preimage: Math.random().toString(16).slice(2), paid: true };
}

function delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}
