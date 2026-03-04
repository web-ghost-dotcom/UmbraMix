'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
    HomeIcon,
    LockClosedIcon,
    ClipboardDocumentIcon,
    CheckCircleIcon,
    TrashIcon,
    ArrowPathIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
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

function getMintName(url: string) {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
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
                        // cashu tokens are base64 encoded with a cashu prefix
                        const parts = token.replace('cashuA', '').replace('cashuB', '');
                        const decoded = JSON.parse(atob(parts));
                        mintUrl = decoded?.mint || decoded?.token?.[0]?.mint || 'unknown';
                        const proofs = decoded?.token?.[0]?.proofs || decoded?.proofs || [];
                        amountSats = proofs.reduce((s: number, p: { amount?: number }) => s + (p.amount || 0), 0);
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
            alert('Verification failed. Check console for details.');
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
    const mintGroups = useMemo(() => {
        const groups: Record<string, { count: number; sats: number }> = {};
        tokens.forEach(t => {
            const name = getMintName(t.mintUrl);
            if (!groups[name]) groups[name] = { count: 0, sats: 0 };
            groups[name].count++;
            groups[name].sats += t.amountSats;
        });
        return groups;
    }, [tokens]);

    return (
        <div className="min-h-screen text-white">
            <div className="relative z-10 container mx-auto px-4 py-8 max-w-5xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 animate-fade-in-up">
                    <div className="flex items-center gap-4">
                        <Link href="/mixer" className="flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle hover:bg-white/10 transition-colors text-sm press-effect">
                            <HomeIcon className="w-4 h-4" />
                            <span>Mixer</span>
                        </Link>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
                                <LockClosedIcon className="w-5 h-5 text-violet-400" />
                            </div>
                            <span className="text-gradient">Token Vault</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowImport(!showImport)} className="flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle hover:bg-white/10 transition-colors text-sm press-effect">
                            <ArrowUpTrayIcon className="w-4 h-4" />
                            Import
                        </button>
                        <button onClick={exportBackup} disabled={tokens.length === 0} className="flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle hover:bg-white/10 transition-colors text-sm press-effect disabled:opacity-40 disabled:pointer-events-none">
                            <ArrowDownTrayIcon className="w-4 h-4" />
                            Backup
                        </button>
                    </div>
                </div>

                {/* Import Panel */}
                {showImport && (
                    <div className="glass rounded-2xl p-5 mb-6 animate-fade-in-scale">
                        <h3 className="font-semibold text-gray-200 mb-3">Import Cashu Token</h3>
                        <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder="Paste cashuA... or cashuB... token here"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 font-mono h-24 resize-none transition-all"
                        />
                        <div className="flex gap-2 mt-3">
                            <button onClick={handleImport} disabled={!importText.trim()} className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-40 transition-colors press-effect shadow-lg shadow-violet-600/20">
                                Import Token
                            </button>
                            <button onClick={() => { setShowImport(false); setImportText(''); }} className="px-4 py-2 rounded-xl glass-subtle hover:bg-white/10 text-gray-300 text-sm transition-colors press-effect">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    <div className="glass-subtle rounded-2xl p-4 text-center hover:scale-[1.02] transition-transform">
                        <div className="text-2xl font-bold text-violet-400">{totalSats.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 mt-1">Total Sats</div>
                    </div>
                    <div className="glass-subtle rounded-2xl p-4 text-center hover:scale-[1.02] transition-transform">
                        <div className="text-2xl font-bold text-white">{tokens.length}</div>
                        <div className="text-xs text-gray-500 mt-1">Tokens</div>
                    </div>
                    <div className="glass-subtle rounded-2xl p-4 text-center hover:scale-[1.02] transition-transform">
                        <div className="text-2xl font-bold text-blue-400">{Object.keys(mintGroups).length}</div>
                        <div className="text-xs text-gray-500 mt-1">Mints</div>
                    </div>
                    <div className="glass-subtle rounded-2xl p-4 text-center hover:scale-[1.02] transition-transform">
                        <div className="text-2xl font-bold text-emerald-400">{tokens.filter(t => !t.spent).length}</div>
                        <div className="text-xs text-gray-500 mt-1">Unspent</div>
                    </div>
                </div>

                {/* Per-Mint Breakdown */}
                {Object.keys(mintGroups).length > 0 && (
                    <div className="glass rounded-2xl p-5 mb-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <h3 className="font-semibold text-gray-200 mb-3">Balances by Mint</h3>
                        <div className="space-y-2">
                            {Object.entries(mintGroups).map(([mint, info]) => (
                                <div key={mint} className="flex items-center justify-between glass-subtle rounded-xl px-4 py-2.5 text-sm">
                                    <span className="text-gray-400 font-mono text-xs">{mint}</span>
                                    <div className="text-right">
                                        <span className="text-violet-400 font-medium">{info.sats.toLocaleString()} sats</span>
                                        <span className="text-gray-600 text-xs ml-2">({info.count} tokens)</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Token List */}
                {isLoading ? (
                    <div className="text-center py-16">
                        <ArrowPathIcon className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-3" />
                        <p className="text-gray-500">Loading tokens...</p>
                    </div>
                ) : tokens.length === 0 ? (
                    <div className="text-center py-16 glass rounded-2xl animate-fade-in-scale">
                        <LockClosedIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 mb-1">No tokens in vault</p>
                        <p className="text-gray-500 text-sm">Complete a privacy mix or import a token to get started.</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {tokens.map((t, idx) => (
                            <div key={t.id} className={`glass-subtle rounded-2xl p-4 transition-all hover:bg-white/[0.06] animate-stagger-in ${t.spent ? 'opacity-50' : ''}`} style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-sm text-gray-200">{t.id.slice(0, 16)}...</span>
                                            {t.spent && (
                                                <span className="text-xs px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">SPENT</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Mint: <span className="text-gray-400">{getMintName(t.mintUrl)}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-semibold text-violet-400">{t.amountSats.toLocaleString()} <span className="text-sm text-gray-500">sats</span></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                                    <button
                                        onClick={() => copyToken(t.id, t.token)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subtle hover:bg-white/10 transition-colors text-xs text-gray-300 press-effect"
                                    >
                                        {copiedId === t.id ? <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
                                        {copiedId === t.id ? 'Copied!' : 'Copy Token'}
                                    </button>
                                    <button
                                        onClick={() => verifyToken(t.id, t.token, t.mintUrl)}
                                        disabled={verifying === t.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subtle hover:bg-white/10 transition-colors text-xs text-gray-300 press-effect disabled:opacity-40"
                                    >
                                        {verifying === t.id ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheckIcon className="w-3.5 h-3.5" />}
                                        Verify
                                    </button>
                                    <button
                                        onClick={() => deleteToken(t.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subtle hover:bg-red-500/10 transition-colors text-xs text-gray-300 hover:text-red-400 ml-auto press-effect"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 glass-subtle rounded-2xl p-4 text-sm border border-yellow-500/10">
                    <div className="flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-yellow-300/70">
                            Tokens are stored locally in your browser. Always create backups using the &quot;Backup&quot; button.
                            Lost tokens cannot be recovered. Treat them like cash.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
