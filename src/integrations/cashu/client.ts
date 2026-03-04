// Real Cashu client implementation using @cashu/cashu-ts
import { CashuMint, CashuWallet, MintQuoteState, Proof, getEncodedTokenV4, getDecodedToken } from '@cashu/cashu-ts';
import { EcashProof } from '../../domain';

export interface MintQuote {
    quote: string;
    amount: bigint;
    state: 'CREATED' | 'PAID' | 'ISSUED';
    request?: string; // Lightning payment request
}

export interface MeltQuote {
    quote: string;
    amount: bigint;
    fee_reserve: bigint;
    unit?: string;
    expiry?: number;
    request?: string;
}

export interface CashuClient {
    // Core operations
    createMintQuote(amount: bigint): Promise<MintQuote>;
    checkMintQuote(quote: string): Promise<MintQuote>;
    mintProofs(amount: bigint, quote: string): Promise<EcashProof[]>;

    // Lightning operations
    createMeltQuote(invoice: string): Promise<MeltQuote>;
    meltProofs(quote: MeltQuote, proofs: EcashProof[]): Promise<{ change: EcashProof[] }>;

    // Token operations
    createToken(proofs: EcashProof[]): string;
    receive(token: string): Promise<EcashProof[]>;

    // Privacy operations
    send(amount: bigint, proofs: EcashProof[]): Promise<{ keep: EcashProof[], send: EcashProof[] }>;

    // Multi-mint support
    getMintInfo(): Promise<{ name?: string, description?: string, version?: string }>;
    getBalance(proofs: EcashProof[]): bigint;
}

export class RealCashuClient implements CashuClient {
    private mint: CashuMint;
    private wallet: CashuWallet;
    private initialized = false;
    private mintUrl: string;

    constructor(mintUrl: string) {
        this.mintUrl = mintUrl;
        this.mint = new CashuMint(mintUrl);
        this.wallet = new CashuWallet(this.mint);

        // For Node.js environments, add better error handling
        if (typeof window === 'undefined') {
            console.log(`🪙 Initializing Cashu client for testnet mint: ${mintUrl}`);
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            try {
                console.log(`🔗 Connecting to Cashu mint: ${this.mintUrl}`);
                await this.wallet.loadMint();
                this.initialized = true;
                console.log(`✅ Cashu mint connected successfully`);
            } catch (error) {
                console.warn(`⚠️ Failed to connect to Cashu mint: ${error instanceof Error ? error.message : String(error)}`);
                throw new Error(`Cashu mint connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    async createMintQuote(amount: bigint): Promise<MintQuote> {
        await this.ensureInitialized();
        const mintQuote = await this.wallet.createMintQuote(Number(amount));

        return {
            quote: mintQuote.quote,
            amount: BigInt(mintQuote.amount),
            state: mintQuote.state === MintQuoteState.PAID ? 'PAID' :
                mintQuote.state === MintQuoteState.ISSUED ? 'ISSUED' : 'CREATED',
            request: mintQuote.request
        };
    }

    async checkMintQuote(quote: string): Promise<MintQuote> {
        await this.ensureInitialized();
        const mintQuote = await this.wallet.checkMintQuote(quote);

        return {
            quote: mintQuote.quote,
            amount: BigInt(mintQuote.amount || 0),
            state: mintQuote.state === MintQuoteState.PAID ? 'PAID' :
                mintQuote.state === MintQuoteState.ISSUED ? 'ISSUED' : 'CREATED',
            request: mintQuote.request
        };
    }

    async mintProofs(amount: bigint, quote: string): Promise<EcashProof[]> {
        await this.ensureInitialized();
        const proofs = await this.wallet.mintProofs(Number(amount), quote);

        return proofs.map(this.convertToEcashProof);
    }

    async createMeltQuote(invoice: string): Promise<MeltQuote> {
        await this.ensureInitialized();
        // If running in browser, proxy via Next API to avoid CORS
        if (typeof window !== 'undefined') {
            const res = await fetch('/api/cashu/melt-quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice, mintUrl: this.mintUrl })
            });
            if (!res.ok) throw new Error(`melt-quote failed: ${await res.text()}`);
            const meltQuote = await res.json();
            return {
                quote: meltQuote.quote,
                amount: BigInt(meltQuote.amount),
                fee_reserve: BigInt(meltQuote.fee_reserve),
                unit: meltQuote.unit,
                expiry: meltQuote.expiry,
                request: meltQuote.request
            };
        }
        const meltQuote = await this.wallet.createMeltQuote(invoice);

        return {
            quote: meltQuote.quote,
            amount: BigInt(meltQuote.amount),
            fee_reserve: BigInt(meltQuote.fee_reserve),
            unit: meltQuote.unit,
            expiry: meltQuote.expiry,
            request: meltQuote.request
        };
    }

    async meltProofs(quote: MeltQuote, proofs: EcashProof[]): Promise<{ change: EcashProof[] }> {
        await this.ensureInitialized();
        const cashuProofs = proofs.map(this.convertFromEcashProof);
        // If running in browser, proxy via Next API to avoid CORS
        if (typeof window !== 'undefined') {
            console.log('🔧 [Cashu Client] Browser path: preparing melt request...', {
                quoteId: quote.quote?.substring(0, 20) + '...',
                proofsCount: cashuProofs.length,
                totalAmount: cashuProofs.reduce((sum, p) => sum + Number(p.amount), 0),
                mintUrl: this.mintUrl
            });

            // Avoid BigInt serialization issues by converting to strings
            const serializableQuote = {
                quote: quote.quote,
                amount: quote.amount.toString(),
                fee_reserve: quote.fee_reserve.toString(),
                unit: quote.unit,
                expiry: quote.expiry,
                request: quote.request
            };

            console.log('⚡ [Cashu Client] Sending melt request to server proxy...', {
                proofsFormat: cashuProofs.length > 0 ? {
                    firstProofFields: Object.keys(cashuProofs[0]),
                    firstProofAmount: cashuProofs[0].amount,
                    firstProofAmountType: typeof cashuProofs[0].amount
                } : 'no proofs'
            });
            const res = await fetch('/api/cashu/melt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quote: serializableQuote, proofs: cashuProofs, mintUrl: this.mintUrl })
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('❌ [Cashu Client] Melt request failed:', {
                    status: res.status,
                    statusText: res.statusText,
                    error: errorText
                });
                throw new Error(`melt failed: ${errorText}`);
            }

            const payload = await res.json();
            console.log('✅ [Cashu Client] Melt response received:', {
                changeProofs: payload.change?.length || 0,
                changeAmount: payload.change?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
            });

            const change = (payload.change || []).map(this.convertToEcashProof);
            return { change };
        }

        // Node/server path: call mint directly
        const meltQuoteResponse = {
            quote: quote.quote,
            amount: Number(quote.amount),
            fee_reserve: Number(quote.fee_reserve),
            state: 'UNPAID' as const,
            expiry: Math.floor(Date.now() / 1000) + 3600,
            payment_preimage: null,
            request: '',
            unit: 'sat'
        };
        const meltResponse = await this.wallet.meltProofs(meltQuoteResponse, cashuProofs);
        return { change: meltResponse.change?.map(this.convertToEcashProof) || [] };
    }

    async send(amount: bigint, proofs: EcashProof[]): Promise<{ keep: EcashProof[], send: EcashProof[] }> {
        await this.ensureInitialized();
        const cashuProofs = proofs.map(this.convertFromEcashProof);
        const { keep, send } = await this.wallet.send(Number(amount), cashuProofs);

        return {
            keep: keep.map(this.convertToEcashProof),
            send: send.map(this.convertToEcashProof)
        };
    }

    createToken(proofs: EcashProof[]): string {
        const cashuProofs = proofs.map(this.convertFromEcashProof);
        return getEncodedTokenV4({
            mint: this.mint.mintUrl,
            proofs: cashuProofs
        });
    }

    async receive(token: string): Promise<EcashProof[]> {
        await this.ensureInitialized();
        const receiveProofs = await this.wallet.receive(token);
        return receiveProofs.map(this.convertToEcashProof);
    }

    async getMintInfo(): Promise<{ name?: string, description?: string, version?: string }> {
        await this.ensureInitialized();
        const info = await this.mint.getInfo();
        return {
            name: info.name,
            description: info.description,
            version: info.version
        };
    }

    getBalance(proofs: EcashProof[]): bigint {
        return proofs.reduce((sum, proof) => sum + proof.amount, 0n);
    }

    // Utility methods for proof conversion
    private convertToEcashProof(proof: Proof): EcashProof {
        return {
            secret: proof.secret,
            signature: proof.C,
            amount: BigInt(proof.amount),
            currency: 'SAT',
            keysetId: proof.id
        };
    }

    private convertFromEcashProof(proof: EcashProof): Proof {
        return {
            secret: proof.secret,
            C: proof.signature,
            amount: Number(proof.amount),
            id: proof.keysetId
        };
    }
}

// Multi-mint manager for routing diversification
export class MultiMintCashuManager {
    private clients: Map<string, RealCashuClient> = new Map();
    private mintUrls: string[];

    constructor(mintUrls: string[]) {
        this.mintUrls = mintUrls;
        mintUrls.forEach(url => {
            this.clients.set(url, new RealCashuClient(url));
        });
    }

    // Select mint based on privacy strategy (random selection for now)
    selectMint(): RealCashuClient {
        const randomIndex = Math.floor(Math.random() * this.mintUrls.length);
        const selectedUrl = this.mintUrls[randomIndex];
        return this.clients.get(selectedUrl)!;
    }

    // Get all mints for distributed operations
    getAllMints(): RealCashuClient[] {
        return Array.from(this.clients.values());
    }

    // Split tokens across multiple mints for privacy
    async distributeSend(
        totalAmount: bigint,
        proofs: EcashProof[],
        numberOfMints: number = 2
    ): Promise<{ distributions: Array<{ mint: RealCashuClient, proofs: EcashProof[] }> }> {
        const mintsToUse = this.mintUrls.slice(0, numberOfMints);
        const amountPerMint = totalAmount / BigInt(numberOfMints);
        const distributions = [];

        for (const mintUrl of mintsToUse) {
            const client = this.clients.get(mintUrl)!;
            // In real implementation, would need to convert proofs between mints
            // For now, just distribute existing proofs
            const relevantProofs = proofs.filter(p =>
                this.getBalance([p]) <= amountPerMint
            );
            distributions.push({ mint: client, proofs: relevantProofs });
        }

        return { distributions };
    }

    private getBalance(proofs: EcashProof[]): bigint {
        return proofs.reduce((sum, proof) => sum + proof.amount, 0n);
    }
}

// Legacy mock client for backward compatibility
export class MockCashuClient implements CashuClient {
    async createMintQuote(amount: bigint): Promise<MintQuote> {
        return { quote: `q_${Date.now()}`, amount, state: 'CREATED' };
    }
    async checkMintQuote(quote: string): Promise<MintQuote> {
        return { quote, amount: 0n, state: 'PAID' };
    }
    async mintProofs(amount: bigint, quote: string): Promise<EcashProof[]> {
        const proof: EcashProof = {
            secret: `sec_${quote}`,
            signature: `sig_${quote}`,
            amount,
            currency: 'SAT',
            keysetId: 'mock',
        };
        return [proof];
    }
    async createMeltQuote(invoice: string): Promise<MeltQuote> {
        return { quote: `melt_${Date.now()}`, amount: 1000n, fee_reserve: 10n };
    }
    async meltProofs(_quote: MeltQuote, _proofs: EcashProof[]): Promise<{ change: EcashProof[] }> {
        return { change: [] };
    }
    createToken(_proofs: EcashProof[]): string {
        return 'mock_token';
    }
    async receive(_token: string): Promise<EcashProof[]> {
        return [];
    }
    async send(amount: bigint, proofs: EcashProof[]): Promise<{ keep: EcashProof[], send: EcashProof[] }> {
        return { keep: proofs, send: [] };
    }
    async getMintInfo(): Promise<{ name?: string, description?: string, version?: string }> {
        return { name: 'Mock Mint', description: 'Test mint', version: '1.0.0' };
    }
    getBalance(proofs: EcashProof[]): bigint {
        return proofs.reduce((sum, proof) => sum + proof.amount, 0n);
    }
}
