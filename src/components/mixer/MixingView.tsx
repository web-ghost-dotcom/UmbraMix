import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export function MixingView({ progress, anonymitySet, eta }: { progress: number; anonymitySet: number; eta: number }) {
    return (
        <div className="dashboard-card p-8 animate-fade-in-scale">
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-5 animate-pulse-glow">
                    <ArrowPathIcon className="w-8 h-8 text-violet-400 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Mixing in Progress</h2>
                <p className="text-gray-500">Your transaction is being mixed with {anonymitySet} participants</p>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
                <div className="flex justify-between text-sm mb-2.5">
                    <span className="text-gray-500">Progress</span>
                    <span className="text-violet-400 font-semibold font-mono">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-800/50 rounded-full h-2.5 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute inset-0 animate-shimmer rounded-full" />
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-2xl font-bold text-gray-200">{anonymitySet}</div>
                    <div className="text-xs text-gray-500 mt-1">Anonymity Set</div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-2xl font-bold text-violet-400">{eta}m</div>
                    <div className="text-xs text-gray-500 mt-1">Est. Time</div>
                </div>
            </div>
        </div>
    );
}
