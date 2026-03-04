import React, { useState, useEffect } from 'react';
import { BanknotesIcon } from '@heroicons/react/24/outline';

const SUBSTEPS = [
    'Preparing transaction...',
    'Signing with wallet...',
    'Broadcasting to Starknet...',
    'Waiting for confirmation...',
    'Routing to Lightning Network...',
];

export function DepositView({ amount, onCancel }: { amount: string; onCancel?: () => void }) {
    const [substepIdx, setSubstepIdx] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setSubstepIdx(prev => prev < SUBSTEPS.length - 1 ? prev + 1 : prev);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="dashboard-card p-8 text-center animate-fade-in-scale">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-5">
                <BanknotesIcon className="w-8 h-8 text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Processing Deposit</h2>
            <p className="text-gray-500 mb-6">Preparing your {amount} STRK for mixing...</p>

            {/* Substep timeline */}
            <div className="max-w-xs mx-auto mb-8">
                {SUBSTEPS.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3 mb-3 animate-stagger-in" style={{ animationDelay: `${idx * 100}ms` }}>
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-500 ${idx < substepIdx ? 'bg-emerald-400 scale-100' : idx === substepIdx ? 'bg-violet-500 animate-pulse scale-110' : 'bg-gray-700 scale-90'
                            }`} />
                        <span className={`text-sm text-left transition-colors duration-300 ${idx < substepIdx ? 'text-emerald-400' : idx === substepIdx ? 'text-white font-medium' : 'text-gray-600'
                            }`}>
                            {step}
                        </span>
                    </div>
                ))}
            </div>

            <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-5 animate-spin" role="status">
                <span className="sr-only">Loading...</span>
            </div>

            {onCancel && (
                <button
                    onClick={onCancel}
                    className="text-sm text-gray-500 hover:text-red-400 transition-colors press-effect"
                >
                    Cancel Mix
                </button>
            )}
        </div>
    );
}
