'use client';

import React, { useState, useEffect } from 'react';
import {
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    BoltIcon,
    CurrencyDollarIcon
} from '@heroicons/react/24/outline';

type RedeemStatus = 'idle' | 'validating' | 'creating_swap' | 'melting' | 'claiming' | 'forwarding' | 'complete' | 'error';
type SettlementType = 'strk' | 'lightning';

interface RedeemTokenTabProps {
    isConnected: boolean;
    onConnectWallet: () => void;
    showNotification: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export function RedeemTokenTab({ isConnected, onConnectWallet, showNotification }: RedeemTokenTabProps) {
    const [token, setToken] = useState('');
    const [recipient, setRecipient] = useState('');
    const [lightningInvoice, setLightningInvoice] = useState('');
    const [settlementType, setSettlementType] = useState<SettlementType>('strk');
    const [status, setStatus] = useState<RedeemStatus>('idle');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [txHash, setTxHash] = useState('');
    const [changeToken, setChangeToken] = useState('');
    const [calculatedAmount, setCalculatedAmount] = useState<{ maxAmount: number; availableBalance: number } | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [rescueToken, setRescueToken] = useState('');

    // Calculate max invoice amount when token changes and Lightning settlement is selected
    useEffect(() => {
        const calculateAmount = async () => {
            if (!token.trim() || settlementType !== 'lightning') {
                setCalculatedAmount(null);
                return;
            }

            setIsCalculating(true);
            try {
                const { calculateMaxInvoiceAmount } = await import('@/integrations/cashu/direct');
                const result = await calculateMaxInvoiceAmount(token);

                if (result.success) {
                    setCalculatedAmount({
                        maxAmount: result.maxAmount,
                        availableBalance: result.availableBalance
                    });
                } else {
                    setCalculatedAmount(null);
                    showNotification('warning', 'Invalid Token', 'Could not calculate invoice amount from token');
                }
            } catch (err) {
                setCalculatedAmount(null);
            } finally {
                setIsCalculating(false);
            }
        };

        // Debounce the calculation
        const timeoutId = setTimeout(calculateAmount, 500);
        return () => clearTimeout(timeoutId);
    }, [token, settlementType, showNotification]);

    const handleRedeem = async () => {
        if (!isConnected && settlementType === 'strk') {
            onConnectWallet();
            return;
        }

        if (!token.trim()) {
            showNotification('error', 'Missing Token', 'Please enter an ecash token');
            return;
        }

        if (settlementType === 'strk' && !recipient.trim()) {
            showNotification('error', 'Missing Recipient', 'Please enter a recipient address');
            return;
        }

        if (settlementType === 'lightning' && !lightningInvoice.trim()) {
            showNotification('error', 'Missing Invoice', 'Please enter a Lightning invoice');
            return;
        }

        setStatus('validating');
        setError('');
        setProgress(10);

        try {
            if (settlementType === 'lightning') {
                // Direct melt to Lightning invoice
                const { redeemToLightning } = await import('@/orchestrator/steps/redeemCashu');

                await redeemToLightning(token, lightningInvoice, (event: any) => {
                    if (event.type === 'redeem:validating') {
                        setStatus('validating');
                        setProgress(20);
                    }
                    if (event.type === 'redeem:melting') {
                        setStatus('melting');
                        setProgress(60);
                        showNotification('info', 'Melting Ecash', 'Converting ecash to Lightning payment');
                    }
                    if (event.type === 'redeem:complete') {
                        setStatus('complete');
                        setProgress(100);
                        if (event.changeToken) setChangeToken(event.changeToken);
                        showNotification('success', 'Payment Complete', 'Lightning invoice paid');
                    }
                    if (event.type === 'redeem:error') {
                        setStatus('error');
                        setError(event.message || 'Payment failed');
                        if (event.rescueToken) setRescueToken(event.rescueToken);
                        showNotification('error', 'Payment Failed', event.message || 'Unknown error');
                    }
                });
            } else {
                // Standard flow: melt to Lightning then swap to STRK
                const { redeemCashuToken } = await import('@/orchestrator/steps/redeemCashu');

                await redeemCashuToken(token, recipient, (event: any) => {
                    // Handle progress events
                    if (event.type === 'redeem:validating') {
                        setStatus('validating');
                        setProgress(20);
                    }
                    if (event.type === 'redeem:creating_swap') {
                        setStatus('creating_swap');
                        setProgress(30);
                        showNotification('info', 'Creating Swap', 'Preparing Lightning to STRK swap');
                    }
                    if (event.type === 'redeem:melting') {
                        setStatus('melting');
                        setProgress(50);
                        showNotification('info', 'Melting Ecash', 'Converting ecash to Lightning payment');
                    }
                    if (event.type === 'redeem:claiming') {
                        setStatus('claiming');
                        setProgress(70);
                        showNotification('info', 'Claiming Swap', 'Finalizing STRK transfer');
                    }
                    if (event.type === 'redeem:forwarding') {
                        setStatus('forwarding');
                        setProgress(85);
                    }
                    if (event.type === 'redeem:complete') {
                        setStatus('complete');
                        setProgress(100);
                        if (event.txHash) setTxHash(event.txHash);
                        if (event.changeToken) setChangeToken(event.changeToken);
                        showNotification('success', 'Redemption Complete', 'STRK sent to recipient');
                    }
                    if (event.type === 'redeem:error') {
                        setStatus('error');
                        setError(event.message || 'Redemption failed');
                        if (event.rescueToken) setRescueToken(event.rescueToken);
                        showNotification('error', 'Redemption Failed', event.message || 'Unknown error');
                    }
                });
            }

        } catch (err: any) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Unknown error');
            if (err?.rescueToken) setRescueToken(err.rescueToken);
            showNotification('error', 'Redemption Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const reset = (prefillToken?: string) => {
        setStatus('idle');
        setToken(prefillToken || '');
        setRecipient('');
        setLightningInvoice('');
        setSettlementType(prefillToken ? 'lightning' : 'strk');
        setError('');
        setProgress(0);
        setTxHash('');
        setChangeToken('');
        setRescueToken('');
        setCalculatedAmount(null);
    };

    const getStatusText = () => {
        switch (status) {
            case 'validating': return 'Validating token...';
            case 'creating_swap': return 'Creating Lightning to STRK swap...';
            case 'melting': return 'Melting ecash to Lightning...';
            case 'claiming': return 'Claiming STRK on Starknet...';
            case 'forwarding': return 'Forwarding STRK to recipient...';
            default: return '';
        }
    };

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
            {status === 'idle' && (
                <>
                    <h2 className="text-xl font-bold mb-6 flex items-center space-x-3">
                        <ArrowPathIcon className="w-6 h-6 text-blue-400" />
                        <span>Redeem Ecash Token</span>
                    </h2>

                    <div className="mb-6">
                        <label className="block text-sm text-gray-300 mb-2">Ecash Token</label>
                        <textarea
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="cashuAeyJ0..."
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-violet-500 focus:outline-none font-mono text-sm resize-none"
                            rows={4}
                        />
                        <p className="text-xs text-gray-500 mt-1">Paste your full ecash token here</p>
                    </div>

                    {/* Settlement Type Selector */}
                    <div className="mb-6">
                        <label className="block text-sm text-gray-300 mb-3">Settlement Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSettlementType('strk')}
                                className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 transition ${settlementType === 'strk'
                                    ? 'border-violet-500 bg-violet-600/20 text-violet-400'
                                    : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
                                    }`}
                            >
                                <CurrencyDollarIcon className="w-5 h-5" />
                                <span className="font-semibold">STRK Token</span>
                            </button>
                            <button
                                onClick={() => setSettlementType('lightning')}
                                className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 transition ${settlementType === 'lightning'
                                    ? 'border-violet-500 bg-violet-600/20 text-violet-400'
                                    : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
                                    }`}
                            >
                                <BoltIcon className="w-5 h-5" />
                                <span className="font-semibold">Lightning Invoice</span>
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {settlementType === 'strk'
                                ? 'Convert ecash to STRK tokens on Starknet'
                                : 'Pay a Lightning invoice directly from ecash'}
                        </p>
                    </div>

                    {/* Conditional Fields Based on Settlement Type */}
                    {settlementType === 'strk' ? (
                        <div className="mb-6">
                            <label className="block text-sm text-gray-300 mb-2">Recipient Address</label>
                            <input
                                type="text"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="0x1234567890abcdef..."
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">Starknet address to receive STRK</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4">
                                <label className="block text-sm text-gray-300 mb-2">Lightning Invoice</label>
                                <textarea
                                    value={lightningInvoice}
                                    onChange={(e) => setLightningInvoice(e.target.value)}
                                    placeholder="lnbc..."
                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-violet-500 focus:outline-none font-mono text-sm resize-none"
                                    rows={3}
                                />
                                <p className="text-xs text-gray-500 mt-1">Enter the Lightning invoice to pay</p>
                            </div>

                            {/* Show calculated amount */}
                            {isCalculating && (
                                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                    <p className="text-sm text-blue-300">
                                        Calculating maximum invoice amount...
                                    </p>
                                </div>
                            )}

                            {calculatedAmount && !isCalculating && (
                                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                                    <p className="text-sm text-green-300 font-semibold mb-2">
                                        Recommended Invoice Amount
                                    </p>
                                    <div className="space-y-1">
                                        <p className="text-lg text-green-400 font-bold">
                                            {calculatedAmount.maxAmount} sats
                                        </p>
                                        <p className="text-xs text-green-300">
                                            Available balance: {calculatedAmount.availableBalance} sats
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            Formula: invoice_amount = balance - max(2, 0.01×amount) - 1
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <button
                        onClick={handleRedeem}
                        disabled={
                            !token.trim() ||
                            (settlementType === 'strk' && (!recipient.trim() || !isConnected)) ||
                            (settlementType === 'lightning' && !lightningInvoice.trim())
                        }
                        className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition"
                    >
                        {settlementType === 'strk'
                            ? (isConnected ? 'Redeem to STRK' : 'Connect Wallet')
                            : 'Pay Lightning Invoice'}
                    </button>

                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-blue-300">
                            {settlementType === 'strk'
                                ? 'Your ecash token will be converted to Lightning BTC, then swapped to STRK and sent to the recipient address.'
                                : 'Your ecash token will be melted to pay the Lightning invoice. Make sure the invoice amount matches the recommended amount above.'}
                        </p>
                    </div>
                </>
            )}

            {(status === 'validating' || status === 'creating_swap' || status === 'melting' || status === 'claiming' || status === 'forwarding') && (
                <div className="py-12">
                    <div className="text-center mb-8">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mb-4"></div>
                        <p className="text-gray-300 font-semibold">{getStatusText()}</p>
                    </div>

                    <div className="max-w-md mx-auto">
                        <div className="mb-2 flex justify-between text-sm text-gray-400">
                            <span>Progress</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-gray-500">This may take a few moments...</p>
                    </div>
                </div>
            )}

            {status === 'complete' && (
                <div>
                    <h2 className="text-xl font-bold mb-6 flex items-center space-x-3">
                        <CheckCircleIcon className="w-6 h-6 text-green-400" />
                        <span>Redemption Complete</span>
                    </h2>

                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-300 font-semibold mb-2">
                            Success!
                        </p>
                        <p className="text-sm text-green-300">
                            STRK has been sent to the recipient address.
                        </p>
                    </div>

                    {txHash && (
                        <div className="mb-6">
                            <label className="block text-sm text-gray-300 mb-2">Transaction Hash</label>
                            <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3">
                                <p className="text-white font-mono text-sm break-all">{txHash}</p>
                            </div>
                        </div>
                    )}

                    {changeToken && (
                        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <p className="text-sm text-blue-300 font-semibold mb-2">
                                Change Token Available
                            </p>
                            <p className="text-sm text-blue-300 mb-3">
                                Your redemption had leftover value. Here is your change token:
                            </p>
                            <textarea
                                readOnly
                                value={changeToken}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono text-sm resize-none"
                                rows={4}
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(changeToken);
                                    showNotification('success', 'Copied', 'Change token copied to clipboard');
                                }}
                                className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition"
                            >
                                Copy Change Token
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => reset()}
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition"
                    >
                        Redeem Another Token
                    </button>
                </div>
            )}

            {status === 'error' && error && (
                <div>
                    <h2 className="text-xl font-bold mb-6 flex items-center space-x-3">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
                        <span>Error</span>
                    </h2>

                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-300">{error}</p>
                    </div>

                    {rescueToken && (
                        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <p className="text-sm text-amber-300 font-semibold mb-1">
                                🛟 Your funds are safe!
                            </p>
                            <p className="text-sm text-amber-200 mb-3">
                                The payment failed but your ecash was preserved as a new token.
                                Copy it below and retry with a different invoice (check the recommended amount).
                            </p>
                            <textarea
                                readOnly
                                value={rescueToken}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono text-sm resize-none mb-2"
                                rows={4}
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(rescueToken);
                                    showNotification('success', 'Copied', 'Rescue token copied to clipboard');
                                }}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg transition"
                            >
                                Copy Rescue Token
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => reset(rescueToken || undefined)}
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition"
                    >
                        {rescueToken ? 'Retry with Rescue Token' : 'Try Again'}
                    </button>
                </div>
            )}
        </div>
    );
}
