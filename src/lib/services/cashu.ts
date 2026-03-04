export async function mintEcash(amountSats: number) {
    await delay(700);
    return { proofs: [{ amount: amountSats, id: Math.random().toString(36).slice(2) }] };
}

export async function splitEcash(amountSats: number, parts: number) {
    await delay(500);
    const each = Math.floor(amountSats / parts);
    return Array.from({ length: parts }, (_, i) => ({ amount: each, id: `p${i}` }));
}

export async function routeThroughMints(proofs: any[], hops: number) {
    await delay(600 + hops * 200);
    return { proofs: proofs.map((p) => ({ ...p, hop: (p.hop || 0) + hops })) };
}

export async function redeemEcash(amountSats: number) {
    await delay(700);
    return { success: true };
}

function delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}
