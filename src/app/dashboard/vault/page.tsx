'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    LockClosedIcon,
    ClipboardDocumentIcon,
    CheckCircleIcon,
    TrashIcon,
    ArrowPathIcon,
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';

interface VaultToken {
    id: string;
    token: string;
    mintUrl: string;
    amountSats: number;
    createdAt: number;
    spent: boolean;
    quote?: string;
}

export default function VaultPage() {
    const [tokens, setTokens] = useState<VaultToken[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [verifying, setVerifying] = useState<string | null>(null);
    const [importText, setImportText] = useState('');
    const [showImport, setShowImport] = useState(false);

    const loadTokens = useCallback(() => {
        setIsLoading(true);
        if (typeof window === 'undefined') return;

        try {
            const loaded: VaultToken[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('umbramix:cashu-token:')) {
                    const token = localStorage.getItem(key) || '';
                    const quoteId = key.replace('umbramix:cashu-token:', '');

                    // Try to extract amount/mint info from the token
                    let amountSats = 0;
                    let mintUrl = 'unknown';
                    try {
                        let decoded;
                        // cashu tokens are base64 encoded with a cashu prefix
                        const parts = token.replace('cashuA', '').replace('cashuB', '');
                        if (parts) {
                            decoded = JSON.parse(atob(parts));
                            // Handle both v3 and v4 token formats roughly
                            mintUrl = decoded?.mint || decoded?.token?.[0]?.mint || 'unknown';
                            const proofs = decoded?.token?.[0]?.proofs || decoded?.proofs || [];
                            amountSats = proofs.reduce((s: number, p: { amount?: number }) => s + (p.amount || 0), 0);
                        }
                    } catch { /* token might not be decodeable */ }

                    loaded.push({
                        id: quoteId,
                        token,
                        mintUrl,
                        amountSats,
                        createdAt: Date.now(), // we don't store this in localStorage, approximate
                        spent: false,
                        quote: quoteId,
                    });
                }
            }
            loaded.sort((a, b) => b.amountSats - a.amountSats);
            setTokens(loaded);
        } catch (e) {
            console.error('Failed to load tokens:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadTokens(); }, [loadTokens]);

    const copyToken = useCallback(async (id: string, token: string) => {
        await navigator.clipboard.writeText(token);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }, []);

    const deleteToken = useCallback((id: string) => {
        if (!confirm('Remove this token from local storage? Make sure you have backed it up.')) return;
        localStorage.removeItem(`umbramix:cashu-token:${id}`);
        setTokens(prev => prev.filter(t => t.id !== id));
    }, []);

    const verifyToken = useCallback(async (id: string, token: string, mintUrl: string) => {
        setVerifying(id);
        try {
            if (mintUrl === 'unknown') {
                alert('Cannot verify: mint URL unknown for this token.');
                return;
            }
            // Use the Cashu mint's /v1/check endpoint
            const parts = token.replace('cashuA', '').replace('cashuB', '');
            const decoded = JSON.parse(atob(parts));
            const proofs = decoded?.token?.[0]?.proofs || decoded?.proofs || [];
            const Ys = proofs.map((p: { secret: string }) => p.secret);

            // Note: This is a simplified check. Real implementation would need full NUT-07.
            // Assuming we can hit the mint directly (CORS might block this in browser).
            const resp = await fetch(`${mintUrl}/v1/checkstate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Ys }),
            });

            if (resp.ok) {
                const data = await resp.json();
                const anySpent = data?.states?.some((s: { state: string }) => s.state === 'SPENT') ?? false;
                setTokens(prev => prev.map(t => t.id === id ? { ...t, spent: anySpent } : t));
                alert(anySpent ? '⚠️ Some proofs in this token are SPENT.' : '✅ Token is valid and unspent!');
            } else {
                alert('Verification failed: mint returned an error.');
            }
        } catch (e) {
            console.error('Verify error:', e);
            alert('Verification failed. Check console for details (CORS might block direct mint access).');
        } finally {
            setVerifying(null);
        }
    }, []);

    const handleImport = useCallback(() => {
        const trimmed = importText.trim();
        if (!trimmed.startsWith('cashu')) {
            alert('Invalid token format. Cashu tokens start with "cashuA" or "cashuB".');
            return;
        }
        const id = `imported-${Date.now()}`;
        localStorage.setItem(`umbramix:cashu-token:${id}`, trimmed);
        setImportText('');
        setShowImport(false);
        loadTokens();
    }, [importText, loadTokens]);

    const exportBackup = useCallback(() => {
        const backup = tokens.map(t => ({ id: t.id, token: t.token, mintUrl: t.mintUrl, amountSats: t.amountSats }));
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `umbramix-tokens-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [tokens]);

    const totalSats = useMemo(() => tokens.filter(t => !t.spent).reduce((s, t) => s + t.amountSats, 0), [tokens]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Token Vault</h1>
                    <p className="text-zinc-400">Securely store and manage your Cashu tokens locally.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowImport(!showImport)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors text-sm font-bold text-white shadow-lg shadow-violet-600/20"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4" />
                        Import Token
                    </button>
                    <button
                        onClick={exportBackup}
                        disabled={tokens.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Backup
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="dashboard-card p-4">
                    <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Stored Value</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{totalSats.toLocaleString()} Sats</p>
                </div>
                <div className="dashboard-card p-4">
                    <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Token Count</p>
                    <p className="text-2xl font-bold text-white mt-1">{tokens.length}</p>
                </div>
                <div className="dashboard-card p-4">
                    <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Mints</p>
                    <p className="text-2xl font-bold text-violet-400 mt-1">{new Set(tokens.map(t => t.mintUrl)).size}</p>
                </div>
            </div>

            {/* Import Panel */}
            {showImport && (
                <div className="dashboard-card p-6 animate-fade-in-scale">
                    <h3 className="text-lg font-bold text-white mb-4">Import Cashu Token</h3>
                    <textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="Paste cashuA... or cashuB... token here"
                        className="w-full h-32 bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 mb-4"
                    />
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowImport(false)}
                            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!importText.trim()}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Import Token
                        </button>
                    </div>
                </div>
            )}

            {/* Token List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="p-12 text-center dashboard-card">
                        <ArrowPathIcon className="w-8 h-8 text-zinc-600 animate-spin mx-auto mb-3" />
                        <p className="text-zinc-500">Loading vault...</p>
                    </div>
                ) : tokens.length === 0 ? (
                    <div className="p-16 text-center dashboard-card flex flex-col items-center justify-center">
                        <LockClosedIcon className="w-16 h-16 text-zinc-700 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-300">Vault is Empty</h3>
                        <p className="text-zinc-500 max-w-sm mt-2 mb-6">
                            Tokens generated from mixing or imported manually will appear here.
                        </p>
                        <button
                            onClick={() => setShowImport(true)}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                        >
                            Import First Token
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {tokens.map((token) => (
                            <div key={token.id} className="dashboard-card p-5 hover:border-violet-500/30 transition-colors group">
                                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                                            <LockClosedIcon className="w-6 h-6 text-violet-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                                {token.amountSats} Sats
                                                {token.spent && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Spent</span>}
                                            </h3>
                                            <p className="text-xs text-zinc-500 font-mono mt-1 break-all line-clamp-1 max-w-md">
                                                {token.token.substring(0, 32)}...
                                            </p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                                                <span className="bg-white/5 px-2 py-0.5 rounded">
                                                    Mint: {(() => { try { return new URL(token.mintUrl).hostname; } catch { return token.mintUrl || 'Unknown'; } })()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                        <button
                                            onClick={() => copyToken(token.id, token.token)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
                                        >
                                            {copiedId === token.id ? (
                                                <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                                <ClipboardDocumentIcon className="w-4 h-4" />
                                            )}
                                            {copiedId === token.id ? 'Copied' : 'Copy'}
                                        </button>

                                        <button
                                            onClick={() => verifyToken(token.id, token.token, token.mintUrl)}
                                            disabled={verifying === token.id}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
                                        >
                                            <ArrowPathIcon className={`w-4 h-4 ${verifying === token.id ? 'animate-spin' : ''}`} />
                                            Verify
                                        </button>

                                        <button
                                            onClick={() => deleteToken(token.id)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
