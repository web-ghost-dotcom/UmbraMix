'use client';

import React, { useState, useCallback } from 'react';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { validateStarknetAddress } from '@/utils/validation';

export interface DestinationEntry {
    address: string;
    /** Percentage of total amount (0-100). All entries should sum to 100. */
    percentage: number;
    error?: string;
}

interface MultiDestinationProps {
    destinations: DestinationEntry[];
    onChange: (destinations: DestinationEntry[]) => void;
    totalAmount: number;
    maxDestinations?: number;
}

export default function MultiDestination({ destinations, onChange, totalAmount, maxDestinations = 5 }: MultiDestinationProps) {
    const [showMulti, setShowMulti] = useState(destinations.length > 1);

    const handleToggle = useCallback(() => {
        if (showMulti) {
            // Collapse to single — keep first entry at 100%
            const first = destinations[0] || { address: '', percentage: 100 };
            onChange([{ ...first, percentage: 100 }]);
        } else {
            // Expand to multi — split current into 2
            const first = destinations[0] || { address: '', percentage: 50 };
            onChange([
                { ...first, percentage: 50 },
                { address: '', percentage: 50 },
            ]);
        }
        setShowMulti(!showMulti);
    }, [showMulti, destinations, onChange]);

    const addDestination = useCallback(() => {
        if (destinations.length >= maxDestinations) return;
        // Take equal share from existing entries
        const equalShare = Math.floor(100 / (destinations.length + 1));
        const remainder = 100 - equalShare * (destinations.length + 1);
        const updated = destinations.map((d, i) => ({
            ...d,
            percentage: equalShare + (i === 0 ? remainder : 0),
        }));
        updated.push({ address: '', percentage: equalShare });
        onChange(updated);
    }, [destinations, maxDestinations, onChange]);

    const removeDestination = useCallback((index: number) => {
        if (destinations.length <= 1) return;
        const removed = destinations[index];
        const remaining = destinations.filter((_, i) => i !== index);
        // Redistribute removed percentage to first entry
        remaining[0] = { ...remaining[0], percentage: remaining[0].percentage + removed.percentage };
        onChange(remaining);
    }, [destinations, onChange]);

    const updateAddress = useCallback((index: number, address: string) => {
        const updated = [...destinations];
        const trimmed = address.trim();
        let error: string | undefined;
        if (trimmed.length > 0) {
            const v = validateStarknetAddress(trimmed);
            if (!v.valid) error = v.error;
        }
        updated[index] = { ...updated[index], address: trimmed, error };
        onChange(updated);
    }, [destinations, onChange]);

    const updatePercentage = useCallback((index: number, pct: number) => {
        const clamped = Math.max(1, Math.min(99, pct));
        const diff = clamped - destinations[index].percentage;
        const updated = [...destinations];
        updated[index] = { ...updated[index], percentage: clamped };

        // Adjust other entries proportionally
        const otherTotal = updated.reduce((s, d, i) => i === index ? s : s + d.percentage, 0);
        if (otherTotal > 0) {
            const ratio = (otherTotal - diff) / otherTotal;
            let assignedTotal = clamped;
            for (let i = 0; i < updated.length; i++) {
                if (i === index) continue;
                const newPct = Math.max(1, Math.round(updated[i].percentage * ratio));
                updated[i] = { ...updated[i], percentage: newPct };
                assignedTotal += newPct;
            }
            // Fix rounding by adjusting last non-index entry
            const lastIdx = updated.findIndex((_, i) => i !== index && i === updated.length - 1) || 0;
            if (assignedTotal !== 100) {
                const adjustIdx = lastIdx !== index ? lastIdx : 0;
                updated[adjustIdx] = { ...updated[adjustIdx], percentage: updated[adjustIdx].percentage + (100 - assignedTotal) };
            }
        }

        onChange(updated);
    }, [destinations, onChange]);

    const totalPct = destinations.reduce((s, d) => s + d.percentage, 0);
    const isBalanced = totalPct === 100;

    if (!showMulti) {
        return (
            <div className="flex items-center justify-between">
                <button
                    onClick={handleToggle}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                    <PlusIcon className="w-3 h-3" />
                    Split to multiple destinations
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 font-medium">Destinations ({destinations.length}/{maxDestinations})</span>
                <button onClick={handleToggle} className="text-xs text-gray-400 hover:text-gray-300 transition-colors">
                    Single destination
                </button>
            </div>

            {destinations.map((dest, i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500 w-4 text-center">{i + 1}</span>
                        <input
                            type="text"
                            value={dest.address}
                            onChange={(e) => updateAddress(i, e.target.value)}
                            placeholder="0x..."
                            className={`flex-1 bg-gray-800 border rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none font-mono ${dest.error ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'}`}
                        />
                        <div className="flex items-center gap-1 w-24">
                            <input
                                type="number"
                                value={dest.percentage}
                                onChange={(e) => updatePercentage(i, Number(e.target.value))}
                                min={1}
                                max={99}
                                className="w-14 bg-gray-800 border border-gray-600 rounded px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-xs text-gray-400">%</span>
                        </div>
                        {destinations.length > 1 && (
                            <button onClick={() => removeDestination(i)} className="p-1.5 rounded hover:bg-red-900/30 transition-colors" title="Remove">
                                <TrashIcon className="w-4 h-4 text-gray-500 hover:text-red-400" />
                            </button>
                        )}
                    </div>
                    {dest.error && (
                        <p className="text-xs text-red-400 ml-6">{dest.error}</p>
                    )}
                    {totalAmount > 0 && (
                        <p className="text-xs text-gray-500 ml-6">
                            ≈ {(totalAmount * dest.percentage / 100).toFixed(4)} STRK
                        </p>
                    )}
                </div>
            ))}

            {/* Add button */}
            {destinations.length < maxDestinations && (
                <button onClick={addDestination} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add destination ({destinations.length}/{maxDestinations})
                </button>
            )}

            {/* Balance warning */}
            {!isBalanced && (
                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                    Percentages must sum to 100% (currently {totalPct}%)
                </div>
            )}
        </div>
    );
}
