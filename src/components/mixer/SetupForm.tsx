import React, { useMemo, useState, useCallback } from 'react';
import { EyeSlashIcon } from '@heroicons/react/24/outline';
import { MixRequest, PrivacyLevel, PrivacyConfig } from '../../lib/types';
import { validateStarknetAddress, validateMixAmount } from '@/utils/validation';
import MultiDestination, { DestinationEntry } from './MultiDestination';

const PRIVACY_LEVELS: Record<PrivacyLevel, PrivacyConfig> = {
    standard: { name: 'Standard', description: '10+ participants', minParticipants: 10, estimatedTime: 5, feeBps: 10 },
    enhanced: { name: 'Enhanced', description: '50+ participants', minParticipants: 50, estimatedTime: 15, feeBps: 20 },
    maximum: { name: 'Maximum', description: '100+ participants', minParticipants: 100, estimatedTime: 30, feeBps: 30 },
};

// Fee breakdown estimation
function estimateFees(amount: number, privacyLevel: PrivacyLevel) {
    const mixerFeeBps = PRIVACY_LEVELS[privacyLevel].feeBps;
    const mixerFee = amount * (mixerFeeBps / 10000);
    const lightningFeePct = 0.3; // ~0.3% typical Lightning routing fee
    const lightningFee = amount * (lightningFeePct / 100);
    const cashuFeePct = 0.1; // ~0.1% typical Cashu mint fee
    const cashuFee = amount * (cashuFeePct / 100);
    const gasEstimate = 0.05; // ~0.05 STRK Starknet gas estimate
    const totalFee = mixerFee + lightningFee + cashuFee + gasEstimate;
    const receiveEstimate = amount - totalFee;
    return { mixerFee, lightningFee, cashuFee, gasEstimate, totalFee, receiveEstimate };
}

export function SetupForm({
    value,
    onChange,
    onStart,
    isConnected,
}: {
    value: MixRequest;
    onChange: (v: Partial<MixRequest>) => void;
    onStart: () => void;
    isConnected: boolean;
}) {
    const feePct = useMemo(() => PRIVACY_LEVELS[value.privacyLevel].feeBps / 100, [value.privacyLevel]);
    const [addressError, setAddressError] = useState<string | null>(null);
    const [amountError, setAmountError] = useState<string | null>(null);

    const fees = useMemo(() => estimateFees(value.amountStrk || 0, value.privacyLevel), [value.amountStrk, value.privacyLevel]);

    // Multi-destination state
    const [multiDests, setMultiDests] = useState<DestinationEntry[]>(
        value.destinations.length > 0
            ? value.destinations.map((addr, i) => ({ address: addr, percentage: i === 0 ? 100 : 0 }))
            : [{ address: '', percentage: 100 }]
    );

    const handleDestinationsChange = useCallback((dests: DestinationEntry[]) => {
        setMultiDests(dests);
        const validAddrs = dests.filter(d => d.address && !d.error).map(d => d.address);
        const hasErrors = dests.some(d => d.address && d.error);
        setAddressError(hasErrors ? 'One or more addresses are invalid' : null);
        onChange({ destinations: validAddrs });
    }, [onChange]);

    const handleAddressChange = (rawAddress: string) => {
        const addr = rawAddress.trim();
        if (addr.length === 0) {
            setAddressError(null);
            onChange({ destinations: [] });
            setMultiDests([{ address: '', percentage: 100 }]);
            return;
        }
        const validation = validateStarknetAddress(addr);
        setAddressError(validation.valid ? null : validation.error || 'Invalid address');
        onChange({ destinations: addr ? [addr] : [] });
        setMultiDests([{ address: addr, percentage: 100, error: validation.valid ? undefined : validation.error }]);
    };

    const handleAmountChange = (rawValue: string) => {
        const num = Number(rawValue || 0);
        if (rawValue && !isNaN(num) && num > 0) {
            const validation = validateMixAmount(num);
            setAmountError(validation.valid ? null : validation.error || 'Invalid amount');
        } else {
            setAmountError(null);
        }
        onChange({ amountStrk: num });
    };

    const valid = value.amountStrk > 0 && !amountError && value.destinations.length > 0 && value.destinations[0]?.length > 0 && !addressError;

    return (
        <div className="dashboard-card p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <EyeSlashIcon className="w-5 h-5 text-violet-400" />
                </div>
                <span>Configure Privacy Mix</span>
            </h2>

            {/* Amount */}
            <div className="mb-6">
                <label htmlFor="mix-amount" className="block text-sm text-gray-400 mb-2 font-medium">Amount (STRK)</label>
                <input
                    id="mix-amount"
                    inputMode="decimal"
                    value={value.amountStrk || ''}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all ${amountError ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-violet-500/50'}`}
                    aria-invalid={!!amountError}
                    aria-describedby="amount-hint"
                />
                {amountError ? (
                    <p className="text-xs text-red-400 mt-1.5" role="alert">{amountError}</p>
                ) : (
                    <p id="amount-hint" className="text-xs text-gray-600 mt-1.5">Min: 1 STRK &middot; Max: 10,000 STRK</p>
                )}
            </div>

            {/* Destination(s) */}
            <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2 font-medium">Destination Address(es)</label>
                {multiDests.length <= 1 ? (
                    <>
                        <input
                            id="mix-destination"
                            value={value.destinations[0] || ''}
                            onChange={(e) => handleAddressChange(e.target.value)}
                            placeholder="0x1234567890abcdef..."
                            className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all font-mono text-sm ${addressError ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-violet-500/50'}`}
                            aria-invalid={!!addressError}
                            aria-describedby="address-hint"
                        />
                        {addressError ? (
                            <p className="text-xs text-red-400 mt-1.5" role="alert">{addressError}</p>
                        ) : (
                            <p id="address-hint" className="text-xs text-gray-600 mt-1.5">The STRK address where mixed funds will be sent.</p>
                        )}
                    </>
                ) : null}
                <div className="mt-2">
                    <MultiDestination
                        destinations={multiDests}
                        onChange={handleDestinationsChange}
                        totalAmount={value.amountStrk || 0}
                        maxDestinations={5}
                    />
                </div>
            </div>

            {/* Privacy level */}
            <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-3 font-medium">Privacy Level</label>
                <div className="grid sm:grid-cols-3 gap-3">
                    {(Object.keys(PRIVACY_LEVELS) as PrivacyLevel[]).map((level) => {
                        const cfg = PRIVACY_LEVELS[level];
                        const active = value.privacyLevel === level;
                        return (
                            <button
                                type="button"
                                key={level}
                                onClick={() => onChange({ privacyLevel: level })}
                                className={`p-4 border rounded-xl text-left transition-all duration-200 press-effect ${active
                                        ? 'border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5'
                                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5'
                                    }`}
                            >
                                <div className="font-semibold text-sm">{cfg.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{cfg.description}</div>
                                <div className="mt-2 text-xs text-gray-600">Fee: {(cfg.feeBps / 100).toFixed(2)}% &middot; Est: {cfg.estimatedTime}m</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Day 6: Privacy enhancements */}
            <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-3 font-medium">Advanced Privacy Options</label>
                <div className="grid sm:grid-cols-2 gap-3">
                    {[
                        { key: 'enableTimeDelays', label: 'Time delays & randomization', checked: value.enableTimeDelays },
                        { key: 'enableRandomizedMints', label: 'Randomized Cashu mint hops', checked: value.enableRandomizedMints },
                        { key: 'enableAmountObfuscation', label: 'Amount obfuscation', checked: value.enableAmountObfuscation },
                        { key: 'enableDecoyTx', label: 'Decoy transactions', checked: value.enableDecoyTx },
                    ].map((opt) => (
                        <label key={opt.key} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 cursor-pointer transition-all text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={opt.checked}
                                onChange={(e) => onChange({ [opt.key]: e.target.checked })}
                                className="accent-violet-500 w-4 h-4 rounded"
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                    <label className="block text-sm text-gray-400">
                        Split outputs
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={value.splitCount}
                            onChange={(e) => onChange({ splitCount: Number(e.target.value) })}
                            className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                        />
                    </label>
                    <div className="text-sm text-gray-500 self-end pb-2">Fee estimate: {(feePct).toFixed(2)}%</div>
                </div>
            </div>

            {/* Fee Estimation Breakdown */}
            {value.amountStrk > 0 && !amountError && (
                <div className="mb-6 p-5 glass-subtle rounded-xl animate-fade-in-scale">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Fee Breakdown (Estimated)</h4>
                    <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Mixer fee ({(PRIVACY_LEVELS[value.privacyLevel].feeBps / 100).toFixed(2)}%)</span>
                            <span className="text-gray-300 font-mono text-xs">{fees.mixerFee.toFixed(4)} STRK</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Lightning routing (~0.3%)</span>
                            <span className="text-gray-300 font-mono text-xs">{fees.lightningFee.toFixed(4)} STRK</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Cashu mint fee (~0.1%)</span>
                            <span className="text-gray-300 font-mono text-xs">{fees.cashuFee.toFixed(4)} STRK</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Starknet gas (est.)</span>
                            <span className="text-gray-300 font-mono text-xs">~{fees.gasEstimate.toFixed(4)} STRK</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-2.5 font-semibold">
                            <span className="text-gray-300">Total fees</span>
                            <span className="text-violet-400 font-mono text-xs">{fees.totalFee.toFixed(4)} STRK</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                            <span className="text-gray-300">You receive (est.)</span>
                            <span className="text-emerald-400 font-mono text-xs">{fees.receiveEstimate > 0 ? fees.receiveEstimate.toFixed(4) : '0'} STRK</span>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={onStart}
                disabled={!valid}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30 disabled:shadow-none press-effect"
            >
                {isConnected ? 'Start Privacy Mix' : 'Connect Wallet to Continue'}
            </button>
        </div>
    );
}
