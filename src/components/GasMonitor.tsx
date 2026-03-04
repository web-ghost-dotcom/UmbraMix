'use client';

import React, { useState } from 'react';
import { useGasPrice } from '@/hooks/useGasPrice';
import { FireIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const LEVEL_STYLES = {
    low: { dot: 'bg-green-400', text: 'text-green-400', label: 'Low' },
    medium: { dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Medium' },
    high: { dot: 'bg-red-400', text: 'text-red-400', label: 'High' },
};

export default function GasMonitor() {
    const gas = useGasPrice(30_000);
    const [expanded, setExpanded] = useState(false);
    const style = LEVEL_STYLES[gas.level];

    return (
        <div className="relative">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center space-x-1.5 hover:opacity-80 transition-opacity text-xs"
                aria-label="Gas price monitor"
            >
                <FireIcon className={`w-4 h-4 ${style.text}`} />
                <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                <span className={`${style.text} font-medium`}>{style.label}</span>
            </button>

            {expanded && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Starknet Gas</h4>
                        <button onClick={gas.refresh} className="text-gray-400 hover:text-white transition-colors">
                            <ArrowPathIcon className={`w-3.5 h-3.5 ${gas.isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">L1 Gas Price</span>
                            <span className={`text-sm font-medium ${style.text}`}>{gas.priceStrk} STRK</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Level</span>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                                <span className={`text-xs ${style.text} capitalize font-medium`}>{gas.level}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Est. Mix Gas</span>
                            <span className="text-xs text-gray-300">
                                ~{(Number(gas.priceWei) * 50000 / 1e18).toFixed(6)} STRK
                            </span>
                        </div>

                        {/* Gas level indicator bar */}
                        <div className="pt-2 border-t border-gray-700">
                            <div className="flex items-center gap-1 mb-1">
                                <span className="text-xs text-gray-500">Low</span>
                                <div className="flex-1" />
                                <span className="text-xs text-gray-500">High</span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${gas.level === 'low' ? 'bg-green-400 w-1/3' : gas.level === 'medium' ? 'bg-yellow-400 w-2/3' : 'bg-red-400 w-full'}`}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {gas.level === 'low' ? '✅ Great time to mix — gas is cheap.' : gas.level === 'medium' ? '⚡ Gas is moderate. Mix will cost a bit more.' : '🔥 Gas is high. Consider waiting for lower prices.'}
                            </p>
                        </div>
                    </div>

                    {gas.updatedAt > 0 && (
                        <div className="mt-3 pt-2 border-t border-gray-700 text-xs text-gray-500">
                            Updated {new Date(gas.updatedAt).toLocaleTimeString()}
                        </div>
                    )}

                    {gas.error && (
                        <div className="mt-2 text-xs text-red-400">{gas.error}</div>
                    )}
                </div>
            )}
        </div>
    );
}
