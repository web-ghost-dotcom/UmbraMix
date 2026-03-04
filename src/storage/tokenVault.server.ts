// Server-only token vault for persisting Cashu tokens by quoteId
// Storage backend: AES-256-GCM encrypted JSON file under .data/cashu-tokens.enc
// Encryption key is derived from TOKEN_VAULT_SECRET env var or auto-generated.

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StoredTokenRecord {
    quote: string;
    token: string;
    mintUrl: string;
    amountSats: number;
    proofsCount?: number;
    createdAt: number; // epoch ms
}

interface VaultFileShape {
    version: number;
    records: Record<string, StoredTokenRecord>; // keyed by quote
}

const DATA_DIR = path.join(process.cwd(), '.data');
const VAULT_FILE_ENC = path.join(DATA_DIR, 'cashu-tokens.enc');
const VAULT_FILE_LEGACY = path.join(DATA_DIR, 'cashu-tokens.json');
const KEY_FILE = path.join(DATA_DIR, '.vault-key');

// ---------- Encryption helpers ----------

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * Derive a 256-bit key.
 * If TOKEN_VAULT_SECRET env var is set, derive from it.
 * Otherwise, generate a random key and persist it to .data/.vault-key
 */
async function getEncryptionKey(): Promise<Buffer> {
    const envSecret = process.env.TOKEN_VAULT_SECRET;
    if (envSecret) {
        // Deterministic derivation from secret
        return crypto.scryptSync(envSecret, 'slpm-token-vault', 32);
    }
    // Fall back to auto-generated key file
    try {
        const hex = await fs.readFile(KEY_FILE, 'utf8');
        return Buffer.from(hex.trim(), 'hex');
    } catch {
        const key = crypto.randomBytes(32);
        await ensureDir();
        await fs.writeFile(KEY_FILE, key.toString('hex'), { mode: 0o600 });
        return key;
    }
}

function encrypt(plaintext: string, key: Buffer): Buffer {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: [iv (12)] [tag (16)] [ciphertext ...]
    return Buffer.concat([iv, tag, encrypted]);
}

function decrypt(blob: Buffer, key: Buffer): string {
    const iv = blob.subarray(0, IV_LEN);
    const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = blob.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf8');
}

// ---------- File helpers ----------

async function ensureDir(): Promise<void> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (_) {
        // ignore
    }
}

async function loadFile(): Promise<VaultFileShape> {
    await ensureDir();
    const key = await getEncryptionKey();

    // Try encrypted file first
    try {
        const blob = await fs.readFile(VAULT_FILE_ENC);
        const json = decrypt(blob, key);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object' && parsed.records) {
            return { version: parsed.version || 2, records: parsed.records };
        }
    } catch { /* encrypted file may not exist yet */ }

    // Fall back to legacy plaintext file (one-time migration)
    try {
        const raw = await fs.readFile(VAULT_FILE_LEGACY, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.records) {
            const data: VaultFileShape = { version: 2, records: parsed.records };
            // Migrate: save encrypted and remove plaintext
            await saveFile(data);
            await fs.unlink(VAULT_FILE_LEGACY).catch(() => { });
            return data;
        }
    } catch { /* legacy file may not exist */ }

    return { version: 2, records: {} };
}

async function saveFile(data: VaultFileShape): Promise<void> {
    const key = await getEncryptionKey();
    const json = JSON.stringify(data);
    const blob = encrypt(json, key);
    await fs.writeFile(VAULT_FILE_ENC, blob);
}

const TokenVault = {
    async get(quote: string): Promise<StoredTokenRecord | null> {
        const data = await loadFile();
        return data.records[quote] || null;
    },

    async set(record: StoredTokenRecord): Promise<void> {
        const data = await loadFile();
        data.records[record.quote] = record;
        await saveFile(data);
    },

    async has(quote: string): Promise<boolean> {
        const rec = await this.get(quote);
        return !!rec;
    },

    async list(limit = 100): Promise<StoredTokenRecord[]> {
        const data = await loadFile();
        const all = Object.values(data.records);
        all.sort((a, b) => b.createdAt - a.createdAt);
        return all.slice(0, limit);
    }
};

export default TokenVault;
