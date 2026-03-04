'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
    ClockIcon,
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

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    COMPLETED: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', icon: CheckCircleIcon },
    FAILED: { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-400', icon: XCircleIcon },
    MIXING: { bg: 'bg-violet-500/10 border-violet-500/20', text: 'text-violet-400', icon: ArrowPathIcon },
    CANCELLED: { bg: 'bg-zinc-500/10 border-zinc-500/20', text: 'text-zinc-400', icon: XCircleIcon },
    CREATED: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', icon: ExclamationTriangleIcon },
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
            const amount = s.targetAmounts.reduce((a, b) => Number(a) + Number(b), 0);
            return sum + amount;
        }, 0);
        return { total: sessions.length, completed, totalVolume };
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
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Transaction History</h1>
                    <p className="text-zinc-400">View and manage your past mixing sessions.</p>
                </div>
                <button
                    onClick={exportCSV}
                    disabled={filtered.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="dashboard-card p-4">
                    <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Total Mixes</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
                </div>
                <div className="dashboard-card p-4">
                    <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Completed</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.completed}</p>
                </div>
                <div className="dashboard-card p-4">
                    <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Total Volume</p>
                    <p className="text-2xl font-bold text-violet-400 mt-1">{(Number(stats.totalVolume)).toFixed(2)} STRK</p>
                </div>
                <div className="dashboard-card p-4">
                    <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Success Rate</p>
                    <p className="text-2xl font-bold text-sky-400 mt-1">
                        {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                    </p>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="w-5 h-5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by ID, status..."
                        className="w-full bg-zinc-900/50 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 transition-all placeholder-zinc-600"
                    />
                </div>
                <div className="flex gap-2 bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                    {(['all', 'COMPLETED', 'FAILED', 'MIXING'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === f
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="dashboard-card overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center">
                        <ArrowPathIcon className="w-8 h-8 text-zinc-600 animate-spin mx-auto mb-3" />
                        <p className="text-zinc-500">Loading history...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <ClockIcon className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                        <p className="text-zinc-400 font-medium">No transactions found</p>
                        <p className="text-zinc-500 text-sm mt-1">Try adjusting your filters or search query.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        <div className="grid grid-cols-12 gap-4 p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider bg-white/[0.02]">
                            <div className="col-span-4 sm:col-span-3">Session ID</div>
                            <div className="col-span-3 sm:col-span-2">Status</div>
                            <div className="col-span-2 hidden sm:block">Amount</div>
                            <div className="col-span-3 hidden sm:block">Date</div>
                            <div className="col-span-5 sm:col-span-2 text-right">Actions</div>
                        </div>

                        {filtered.map((session) => {
                            const style = STATUS_STYLES[session.state] || STATUS_STYLES.CREATED;
                            const Icon = style.icon;
                            const totalAmount = session.targetAmounts.reduce((a, b) => Number(a) + Number(b), 0);

                            return (
                                <div key={session.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/[0.02] transition-colors group text-sm">
                                    <div className="col-span-4 sm:col-span-3 flex items-center gap-3 overflow-hidden">
                                        <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0`}>
                                            <Icon className={`w-4 h-4 ${style.text}`} />
                                        </div>
                                        <div className="truncate">
                                            <div className="font-mono text-white truncate" title={session.id}>
                                                {session.id.slice(0, 8)}...
                                            </div>
                                            <div className="text-xs text-zinc-500">
                                                {session.currency}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-3 sm:col-span-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text}`}>
                                            {session.state}
                                        </span>
                                    </div>

                                    <div className="col-span-2 hidden sm:block font-mono text-zinc-300">
                                        {totalAmount.toFixed(4)}
                                    </div>

                                    <div className="col-span-3 hidden sm:block text-zinc-500 text-xs">
                                        {formatDate(session.createdAt)}
                                    </div>

                                    <div className="col-span-5 sm:col-span-2 text-right">
                                        <Link
                                            href={`/dashboard/session/${session.id}`}
                                            className="text-violet-400 hover:text-violet-300 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            Details
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
