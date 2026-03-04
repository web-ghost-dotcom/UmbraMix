'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
    HomeIcon,
    ClockIcon,
    FunnelIcon,
    ArrowDownTrayIcon,
    MagnifyingGlassIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { getIndexedDBStorage } from '@/storage/indexedDb';
import type { MixingSession } from '@/domain';

type FilterStatus = 'all' | 'COMPLETED' | 'FAILED' | 'MIXING' | 'CANCELLED';

function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(ts: number) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    COMPLETED: { bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-400', icon: CheckCircleIcon },
    FAILED: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', icon: XCircleIcon },
    MIXING: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', icon: ArrowPathIcon },
    CANCELLED: { bg: 'bg-gray-500/10 border-gray-500/20', text: 'text-gray-400', icon: XCircleIcon },
    CREATED: { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400', icon: ExclamationTriangleIcon },
    DEPOSITED: { bg: 'bg-violet-600/10 border-violet-500/20', text: 'text-violet-400', icon: ArrowPathIcon },
};

export default function HistoryPage() {
    const [sessions, setSessions] = useState<MixingSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

    useEffect(() => {
        (async () => {
            try {
                const db = getIndexedDBStorage();
                const all = await db.listSessions();
                all.sort((a, b) => b.createdAt - a.createdAt);
                setSessions(all);
            } catch (e) {
                console.error('Failed to load history:', e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const filtered = useMemo(() => {
        let result = sessions;
        if (filterStatus !== 'all') {
            result = result.filter(s => s.state === filterStatus);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(s =>
                s.id.toLowerCase().includes(q) ||
                s.withdrawalAddress?.toLowerCase().includes(q) ||
                s.state.toLowerCase().includes(q)
            );
        }
        return result;
    }, [sessions, filterStatus, search]);

    const stats = useMemo(() => {
        const completed = sessions.filter(s => s.state === 'COMPLETED').length;
        const totalVolume = sessions.reduce((sum, s) => {
            const amount = s.targetAmounts.reduce((a, b) => a + b, 0n);
            return sum + amount;
        }, 0n);
        const avgAnonymity = sessions.length > 0
            ? sessions.filter(s => s.deposits.length > 0).length
            : 0;
        return { total: sessions.length, completed, totalVolume, avgAnonymity };
    }, [sessions]);

    const exportCSV = useCallback(() => {
        const header = 'Session ID,State,Currency,Created,Updated,Destination,Amounts\n';
        const rows = filtered.map(s => {
            const amounts = s.targetAmounts.map(a => (Number(a) / 1e18).toFixed(4)).join(';');
            return `${s.id},${s.state},${s.currency},${formatDate(s.createdAt)},${formatDate(s.updatedAt)},${s.withdrawalAddress || ''},${amounts}`;
        }).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `umbramix-history-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filtered]);

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
                            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                                <ClockIcon className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-gradient-blue">Mix History</span>
                        </h1>
                    </div>
                    <button onClick={exportCSV} disabled={filtered.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-xl glass-subtle hover:bg-white/10 transition-colors text-sm press-effect disabled:opacity-40 disabled:pointer-events-none">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    <div className="glass-subtle rounded-2xl p-4 text-center hover:scale-[1.02] transition-transform">
                        <div className="text-2xl font-bold text-white">{stats.total}</div>
                        <div className="text-xs text-gray-500 mt-1">Total Mixes</div>
                    </div>
                    <div className="glass-subtle rounded-2xl p-4 text-center hover:scale-[1.02] transition-transform">
                        <div className="text-2xl font-bold text-emerald-400">{stats.completed}</div>
                        <div className="text-xs text-gray-500 mt-1">Completed</div>
                    </div>
                    <div className="glass-subtle rounded-2xl p-4 text-center hover:scale-[1.02] transition-transform">
                        <div className="text-2xl font-bold text-violet-400">{(Number(stats.totalVolume) / 1e18).toFixed(2)}</div>
                        <div className="text-xs text-gray-500 mt-1">Total STRK</div>
                    </div>
                    <div className="glass-subtle rounded-2xl p-4 text-center hover:scale-[1.02] transition-transform">
                        <div className="text-2xl font-bold text-blue-400">{stats.total - stats.completed}</div>
                        <div className="text-xs text-gray-500 mt-1">Pending/Failed</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by session ID, address, or state..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <FunnelIcon className="w-4 h-4 text-gray-500" />
                        {(['all', 'COMPLETED', 'FAILED', 'MIXING', 'CANCELLED'] as FilterStatus[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilterStatus(f)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all press-effect ${filterStatus === f
                                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30 shadow-sm shadow-violet-500/10'
                                    : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                                    }`}
                            >
                                {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Session List */}
                {isLoading ? (
                    <div className="text-center py-16">
                        <ArrowPathIcon className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-3" />
                        <p className="text-gray-500">Loading history...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 glass rounded-2xl animate-fade-in-scale">
                        <ClockIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 mb-1">No mix sessions found</p>
                        <p className="text-gray-500 text-sm">
                            {sessions.length === 0 ? 'Start your first privacy mix to see history here.' : 'No sessions match the current filters.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {filtered.map((session, idx) => {
                            const style = STATUS_STYLES[session.state] || STATUS_STYLES.CREATED;
                            const Icon = style.icon;
                            const totalAmount = session.targetAmounts.reduce((a, b) => a + b, 0n);
                            const amountStr = (Number(totalAmount) / 1e18).toFixed(4);

                            return (
                                <div key={session.id} className="glass-subtle rounded-2xl p-4 transition-all hover:bg-white/[0.06] animate-stagger-in" style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bg}`}>
                                                <Icon className={`w-4 h-4 ${style.text}`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm text-gray-200">{session.id.slice(0, 12)}...</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-lg border ${style.bg} ${style.text}`}>
                                                        {session.state}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {formatDate(session.createdAt)} • {timeAgo(session.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-semibold text-white">{amountStr} <span className="text-sm text-gray-500">STRK</span></div>
                                            <div className="text-xs text-gray-600">{session.currency}</div>
                                        </div>
                                    </div>
                                    {session.withdrawalAddress && (
                                        <div className="mt-3 pt-3 border-t border-white/5 text-xs">
                                            <span className="text-gray-500">Destination: </span>
                                            <span className="font-mono text-gray-400">{session.withdrawalAddress.slice(0, 14)}...{session.withdrawalAddress.slice(-8)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination info */}
                {filtered.length > 0 && (
                    <div className="text-center text-xs text-gray-600 mt-4">
                        Showing {filtered.length} of {sessions.length} sessions
                    </div>
                )}
            </div>
        </div>
    );
}
