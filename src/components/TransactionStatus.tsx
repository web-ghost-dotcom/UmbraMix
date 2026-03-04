import React from 'react';
import {
    ClockIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    EyeSlashIcon,
    BanknotesIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

interface Transaction {
    id: string;
    type: 'deposit' | 'mix' | 'withdraw';
    amount: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    timestamp: number;
    privacyScore: number;
    fromNetwork: string;
    toNetwork: string;
    anonymitySetSize?: number;
}

interface TransactionStatusProps {
    transactions: Transaction[];
    currentMixingSession?: {
        id: string;
        phase: 'setup' | 'deposit' | 'mixing' | 'withdraw';
        progress: number;
        anonymitySetSize: number;
        estimatedTime: number;
    };
}

export default function TransactionStatus({ transactions, currentMixingSession }: TransactionStatusProps) {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
            case 'failed':
                return <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />;
            case 'processing':
                return <ArrowPathIcon className="w-5 h-5 text-violet-400 animate-spin" />;
            default:
                return <ClockIcon className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'text-green-400';
            case 'failed':
                return 'text-red-400';
            case 'processing':
                return 'text-violet-400';
            default:
                return 'text-gray-400';
        }
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const getPrivacyScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-amber-400';
        return 'text-rose-400';
    };

    return (
        <div className="dashboard-card p-6 h-full">
            <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <EyeSlashIcon className="w-5 h-5 text-violet-400" />
                </div>
                <span>Privacy Operations</span>
            </h2>

            {/* Current Mixing Session */}
            {currentMixingSession && (
                <div className="mb-6 p-5 bg-white/5 border border-white/5 rounded-xl animate-fade-in-scale">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <ArrowPathIcon className="w-4 h-4 text-violet-400 animate-spin" />
                            Active Session
                        </h3>
                        <span className="text-xs text-violet-400 capitalize px-2 py-0.5 rounded-lg bg-violet-500/10">
                            {currentMixingSession.phase}
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                            <span>Progress</span>
                            <span className="text-violet-400 font-mono">{currentMixingSession.progress}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-violet-600 to-violet-400 h-full rounded-full transition-all duration-1000" style={{ width: `${currentMixingSession.progress}%` }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <span className="text-gray-500">Anonymity:</span>
                            <span className="text-white ml-1.5 font-medium">{currentMixingSession.anonymitySetSize}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">ETA:</span>
                            <span className="text-white ml-1.5 font-medium">{currentMixingSession.estimatedTime}min</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction History */}
            <div>
                <h3 className="text-sm font-semibold text-white mb-3">Recent Transactions</h3>
                {transactions.length === 0 ? (
                    <div className="text-center py-8">
                        <BanknotesIcon className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
                        <p className="text-zinc-500 text-sm">No transactions yet</p>
                        <p className="text-zinc-600 text-xs mt-1">Start a privacy mix to see transactions here</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {transactions.map((tx, idx) => (
                            <div key={tx.id} className="p-3.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all animate-stagger-in" style={{ animationDelay: `${idx * 50}ms` }}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-2.5">
                                        {getStatusIcon(tx.status)}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-white text-sm capitalize">{tx.type}</span>
                                                <span className="text-xs text-zinc-400 font-mono">{tx.amount} STRK</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-0.5">
                                                {tx.fromNetwork} → {tx.toNetwork}
                                            </div>
                                            <div className="text-xs text-zinc-600 mt-0.5">
                                                {formatTimestamp(tx.timestamp)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-xs font-medium ${getStatusColor(tx.status)} capitalize`}>
                                            {tx.status}
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-0.5">
                                            <span className={getPrivacyScoreColor(tx.privacyScore)}>{tx.privacyScore}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Privacy Metrics Summary */}
            {transactions.length > 0 && (
                <div className="mt-5 p-4 bg-white/5 border border-white/5 rounded-xl">
                    <h4 className="text-xs font-semibold text-zinc-400 mb-3">Privacy Metrics</h4>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                            <div className="text-xl font-bold text-emerald-400">
                                {transactions.filter(tx => tx.status === 'completed').length}
                            </div>
                            <div className="text-xs text-zinc-500">Completed</div>
                        </div>
                        <div>
                            <div className="text-xl font-bold text-white">
                                {Math.round(transactions.reduce((acc, tx) => acc + tx.privacyScore, 0) / (transactions.length || 1))}%
                            </div>
                            <div className="text-xs text-zinc-500">Avg Privacy</div>
                        </div>
                        <div>
                            <div className="text-xl font-bold text-violet-400">
                                {transactions.reduce((acc, tx) => acc + parseFloat(tx.amount), 0).toFixed(2)}
                            </div>
                            <div className="text-xs text-zinc-500">Total STRK</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
