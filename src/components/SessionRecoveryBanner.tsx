'use client';

import React from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useSessionRecovery, RecoverableSession } from '@/hooks/useSessionRecovery';

function formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function stateLabel(state: string): string {
    const labels: Record<string, string> = {
        AWAITING_DEPOSIT: 'Awaiting Deposit',
        DEPOSITED: 'Deposited',
        MIXING: 'Mixing',
        READY: 'Ready to Withdraw',
        WITHDRAWING: 'Withdrawing',
    };
    return labels[state] || state;
}

export default function SessionRecoveryBanner() {
    const { incompleteSessions, isChecking, hasIncomplete, dismissSession, dismissAll } = useSessionRecovery();

    if (isChecking || !hasIncomplete) return null;

    return (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6" role="alert">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <h3 className="font-semibold text-yellow-300">Incomplete Sessions Detected</h3>
                </div>
                <button
                    onClick={dismissAll}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Dismiss all recovery notifications"
                >
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>
            <p className="text-sm text-yellow-200/70 mb-3">
                The following mixing sessions were interrupted. Your funds may be recoverable through the emergency withdrawal mechanism in the smart contract.
            </p>
            <div className="space-y-2">
                {incompleteSessions.map((s: RecoverableSession) => (
                    <div
                        key={s.id}
                        className="flex items-center justify-between bg-gray-800/60 rounded-md px-3 py-2 text-sm"
                    >
                        <div className="flex items-center space-x-3">
                            <span className="text-gray-300 font-mono text-xs">{s.id.slice(0, 8)}...</span>
                            <span className="text-yellow-400">{stateLabel(s.state)}</span>
                            <span className="text-gray-500">{formatTimeAgo(s.updatedAt)}</span>
                        </div>
                        <button
                            onClick={() => dismissSession(s.id)}
                            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                            aria-label={`Dismiss session ${s.id.slice(0, 8)}`}
                        >
                            Dismiss
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
