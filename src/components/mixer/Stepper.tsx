import React from 'react';
import { BanknotesIcon, CheckCircleIcon, ArrowPathIcon, WalletIcon } from '@heroicons/react/24/outline';
import { MixingStep } from '../../lib/types';

const icons = {
    setup: WalletIcon,
    deposit: BanknotesIcon,
    mixing: ArrowPathIcon,
    complete: CheckCircleIcon,
};

export function Stepper({ current }: { current: MixingStep }) {
    const steps: { id: MixingStep; name: string }[] = [
        { id: 'setup', name: 'Setup' },
        { id: 'deposit', name: 'Deposit' },
        { id: 'mixing', name: 'Mixing' },
        { id: 'complete', name: 'Complete' },
    ];
    const currentIndex = steps.findIndex((s) => s.id === current);
    return (
        <nav className="mb-10" aria-label="Mixing progress">
            <ol className="flex items-center justify-between relative" role="list">
                {/* Background connector line */}
                <div className="absolute top-6 left-[calc(12.5%)] right-[calc(12.5%)] h-0.5 bg-gray-800 rounded-full" aria-hidden="true">
                    <div
                        className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                        style={{ width: `${currentIndex === 0 ? 0 : (currentIndex / (steps.length - 1)) * 100}%` }}
                    />
                </div>

                {steps.map((s, idx) => {
                    const Icon = icons[s.id];
                    const isCompleted = idx < currentIndex;
                    const isCurrent = idx === currentIndex;
                    const isActive = idx <= currentIndex;
                    return (
                        <li
                            key={s.id}
                            className="flex flex-col items-center relative z-10"
                            aria-current={isCurrent ? 'step' : undefined}
                        >
                            <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 transition-all duration-500 ${isCurrent
                                        ? 'bg-violet-600 shadow-lg shadow-violet-600/30 scale-110'
                                        : isCompleted
                                            ? 'bg-violet-600/20 border border-violet-500/30'
                                            : 'bg-gray-800/80 border border-gray-700'
                                    }`}
                                aria-hidden="true"
                            >
                                {isCompleted ? (
                                    <CheckCircleIcon className="w-6 h-6 text-violet-400" />
                                ) : (
                                    <Icon className={`w-6 h-6 transition-colors duration-300 ${isCurrent ? 'text-white' : 'text-gray-500'
                                        }`} />
                                )}
                            </div>
                            <span className={`text-xs font-medium transition-colors duration-300 ${isCurrent ? 'text-violet-400' : isActive ? 'text-gray-300' : 'text-gray-600'
                                }`}>
                                {s.name}
                                {isCurrent && <span className="sr-only"> (current step)</span>}
                                {isCompleted && <span className="sr-only"> (completed)</span>}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
