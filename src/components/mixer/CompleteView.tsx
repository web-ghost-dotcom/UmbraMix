import React from 'react';
import { CheckCircleIcon, ArrowTopRightOnSquareIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

interface CompleteViewProps {
    amount: string;
    anonymitySet: number;
    onReset: () => void;
    txHash?: string;
    privacyScore?: number;
    distributionResults?: Array<{
        destination: string;
        strkSent: number;
        status: string;
    }>;
}

export function CompleteView({ amount, anonymitySet, onReset, txHash, privacyScore, distributionResults }: CompleteViewProps) {
    const explorerUrl = txHash ? `https://starkscan.co/tx/${txHash}` : null;

    const copyTxHash = () => {
        if (txHash) {
            navigator.clipboard.writeText(txHash).catch(() => { });
        }
    };

    return (
        <div className="glass rounded-2xl p-8 border border-white/5 animate-fade-in-scale">
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-5 glow-violet">
                    <CheckCircleIcon className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-emerald-400">Mix Complete</h2>
                <p className="text-gray-500 mb-1">Your {amount} STRK has been mixed with {anonymitySet} participants</p>
                {privacyScore !== undefined && (
                    <p className="text-sm text-gray-600">Privacy Score: <span className="text-emerald-400 font-semibold">{privacyScore}%</span></p>
                )}
            </div>

            {/* Transaction Receipt */}
            <div className="glass-subtle rounded-xl p-5 mb-6 space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Transaction Receipt</h3>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Amount Mixed</span>
                    <span className="text-white font-mono text-xs">{amount} STRK</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Anonymity Set</span>
                    <span className="text-white">{anonymitySet} participants</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mixing Path</span>
                    <span className="text-white text-xs font-mono">STRK → ⚡ → 🟡 → ⚡ → STRK</span>
                </div>
                {txHash && (
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Tx Hash</span>
                        <div className="flex items-center gap-2">
                            <span className="text-white font-mono text-xs">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                            <button
                                onClick={copyTxHash}
                                className="text-gray-500 hover:text-white transition-colors press-effect"
                                aria-label="Copy transaction hash"
                            >
                                <ClipboardDocumentIcon className="w-4 h-4" />
                            </button>
                            {explorerUrl && (
                                <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-violet-400 hover:text-violet-300 transition-colors"
                                    aria-label="View on block explorer"
                                >
                                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>
                )}
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Completed At</span>
                    <span className="text-white text-xs">{new Date().toLocaleString()}</span>
                </div>
            </div>

            {/* Distribution Results */}
            {distributionResults && distributionResults.length > 0 && (
                <div className="glass-subtle rounded-xl p-5 mb-6 animate-fade-in-up">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Distribution Details</h3>
                    <div className="space-y-2">
                        {distributionResults.map((r, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-500 font-mono text-xs">{r.destination.slice(0, 10)}...{r.destination.slice(-6)}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-mono text-xs">{r.strkSent.toFixed(4)} STRK</span>
                                    <span className={`text-xs ${r.status === 'CLAIMED' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {r.status === 'CLAIMED' ? '✓' : '✗'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button
                onClick={onReset}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30 press-effect"
            >
                Start New Mix
            </button>
        </div>
    );
}
