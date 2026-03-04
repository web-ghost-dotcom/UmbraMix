import { promises as fs } from 'fs';
import { join } from 'path';
import { EcashProof, MixingSession } from '@/domain';
import { StorageAdapter } from './adapter';

interface Stored<T> { data: T }

export class FileSystemStorage implements StorageAdapter {
    constructor(private baseDir: string = '.data') { }

    private async ensureDir(sub: string) {
        await fs.mkdir(join(this.baseDir, sub), { recursive: true });
    }

    private sessionPath(id: string) { return join(this.baseDir, 'sessions', id + '.json'); }
    private proofsPath(sessionId: string) { return join(this.baseDir, 'proofs', sessionId + '.json'); }

    async saveSession(session: MixingSession): Promise<void> {
        await this.ensureDir('sessions');
        await fs.writeFile(this.sessionPath(session.id), JSON.stringify({ data: session }, null, 2));
    }

    async getSession(id: string): Promise<MixingSession | undefined> {
        try {
            const raw = await fs.readFile(this.sessionPath(id), 'utf8');
            return (JSON.parse(raw) as Stored<MixingSession>).data;
        } catch { return undefined; }
    }

    async listSessions(): Promise<MixingSession[]> {
        await this.ensureDir('sessions');
        const files = await fs.readdir(join(this.baseDir, 'sessions'));
        const sessions: MixingSession[] = [];
        for (const f of files) {
            try {
                const raw = await fs.readFile(join(this.baseDir, 'sessions', f), 'utf8');
                sessions.push((JSON.parse(raw) as Stored<MixingSession>).data);
            } catch { /* skip */ }
        }
        return sessions;
    }

    async updateSessionPartial(id: string, patch: Partial<MixingSession>): Promise<MixingSession | undefined> {
        const existing = await this.getSession(id);
        if (!existing) return undefined;
        const updated: MixingSession = { ...existing, ...patch, updatedAt: Date.now() };
        await this.saveSession(updated);
        return updated;
    }

    async saveProofs(sessionId: string, proofs: EcashProof[]): Promise<void> {
        await this.ensureDir('proofs');
        const existing = await this.getProofs(sessionId);
        const merged: Record<string, EcashProof> = {};
        for (const p of existing) merged[p.secret] = p;
        for (const p of proofs) merged[p.secret] = p;
        await fs.writeFile(this.proofsPath(sessionId), JSON.stringify({ data: Object.values(merged) }, null, 2));
    }

    private async getProofs(sessionId: string): Promise<EcashProof[]> {
        try {
            const raw = await fs.readFile(this.proofsPath(sessionId), 'utf8');
            return (JSON.parse(raw) as Stored<EcashProof[]>).data;
        } catch { return []; }
    }

    async markProofsSpent(sessionId: string, secrets: string[]): Promise<void> {
        const proofs = await this.getProofs(sessionId);
        const updated = proofs.map(p => secrets.includes(p.secret) ? { ...p, spent: true } : p);
        await this.saveProofs(sessionId, updated);
    }
}
