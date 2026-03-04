'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ClockIcon,
    LockClosedIcon,
    CalendarDaysIcon,
    ArrowRightIcon,
    CubeTransparentIcon,
} from '@heroicons/react/24/outline';
import { getIndexedDBStorage } from '@/storage/indexedDb';
import type { MixingSession } from '@/domain';

function StatCard({
    title,
    value,
    icon: Icon,
    colorClass,
    href
}: {
    title: string;
    value: string;
    icon: any;
    colorClass: string;
    href: string;
}) {
    return (
        <Link href={href} className="dashboard-card p-6 flex items-start justify-between group card-hover">
            <div>
                <p className="text-sm font-medium text-gray-400">{title}</p>
                <p className={`text-2xl font-bold mt-2 ${colorClass}`}>{value}</p>
            </div>
            <div className={`p-3 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors`}>
                <Icon className={`w-6 h-6 ${colorClass}`} />
            </div>
        </Link>
    );
}

export default function DashboardPage() {
    const [stats, setStats] = useState({
        totalMixes: 0,
        totalVolume: 0,
        activeMixes: 0,
        vaultBalance: 0,
        scheduledMixes: 0,
    });
    const [recentActivity, setRecentActivity] = useState<MixingSession[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const db = getIndexedDBStorage();
                const sessions = await db.listSessions();

                // Calculate stats
                const totalMixes = sessions.length;
                const totalVolume = sessions.reduce((acc, s) => {
                    const amount = s.targetAmounts.reduce((a, b) => a + Number(b), 0);
                    return acc + amount;
                }, 0) / 1e18;

                const activeMixes = sessions.filter(s => ['CREATED', 'DEPOSITED', 'MIXING'].includes(s.state)).length;

                // Get vault balance from localStorage (simple check)
                let vaultBalance = 0;
                if (typeof window !== 'undefined') {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key?.startsWith('umbramix:cashu-token:')) {
                            // Rough estimate without full decode
                            vaultBalance += 1; // Count tokens for now, simpler
                        }
                    }
                }

                setStats({
                    totalMixes,
                    totalVolume,
                    activeMixes,
                    vaultBalance,
                    scheduledMixes: 0 // TODO: get from hook
                });

                setRecentActivity(sessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5));
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white mb-2">Dashboard Overview</h1>
                <p className="text-gray-400">Welcome back to UmbraMix. Here&apos;s what&apos;s happening.</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                    href="/dashboard/mixer"
                    className="col-span-1 sm:col-span-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-6 shadow-lg shadow-violet-900/20 hover:shadow-violet-900/40 transition-all hover:-translate-y-1 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
                    <div className="relative z-10">
                        <h3 className="text-lg font-bold text-white mb-1">Start New Mix</h3>
                        <p className="text-violet-100 text-sm mb-4">Anonymize your funds with zk-SNARKs.</p>
                        <div className="flex items-center gap-2 text-white font-medium bg-white/20 w-fit px-4 py-2 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                            Launch Mixer <ArrowRightIcon className="w-4 h-4" />
                        </div>
                    </div>
                </Link>

                <Link
                    href="/dashboard/schedule"
                    className="dashboard-card p-6 flex flex-col justify-center group card-hover relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CalendarDaysIcon className="w-8 h-8 text-purple-400 mb-3" />
                    <h3 className="font-semibold text-white">Schedule Mix</h3>
                    <p className="text-xs text-gray-500 mt-1">Setup recurring transfers</p>
                </Link>

                <Link
                    href="/dashboard/vault"
                    className="dashboard-card p-6 flex flex-col justify-center group card-hover relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <LockClosedIcon className="w-8 h-8 text-emerald-400 mb-3" />
                    <h3 className="font-semibold text-white">Token Vault</h3>
                    <p className="text-xs text-gray-500 mt-1">Manage private tokens</p>
                </Link>
            </div>

            {/* Stats Overview */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-4">Analytics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Volume"
                        value={`${stats.totalVolume.toFixed(2)} STRK`}
                        icon={CubeTransparentIcon}
                        colorClass="text-violet-400"
                        href="/dashboard/history"
                    />
                    <StatCard
                        title="Total Mixes"
                        value={stats.totalMixes.toString()}
                        icon={ClockIcon}
                        colorClass="text-zinc-400"
                        href="/dashboard/history"
                    />
                    <StatCard
                        title="Active Sessions"
                        value={stats.activeMixes.toString()}
                        icon={CubeTransparentIcon}
                        colorClass="text-emerald-400"
                        href="/dashboard/mixer"
                    />
                    <StatCard
                        title="Vault Tokens"
                        value={stats.vaultBalance.toString()}
                        icon={LockClosedIcon}
                        colorClass="text-amber-400"
                        href="/dashboard/vault"
                    />
                </div>
            </div>

            {/* Recent Activity */}
            <div className="pb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                    <Link href="/dashboard/history" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                        View All
                    </Link>
                </div>

                <div className="dashboard-card overflow-hidden">
                    {recentActivity.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No recent activity found.
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {recentActivity.map((session) => (
                                <div key={session.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${session.state === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                                            session.state === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                                                'bg-blue-500/10 text-blue-400'
                                            }`}>
                                            <CubeTransparentIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">
                                                Mix Session <span className="text-gray-500 text-xs ml-1">#{session.id.slice(0, 8)}</span>
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(session.createdAt).toLocaleDateString()} • {session.state}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-white">
                                            {(Number(session.targetAmounts.reduce((a, b) => a + b, 0n)) / 1e18).toFixed(4)} STRK
                                        </p>
                                        <p className="text-xs text-gray-500">{session.currency}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
