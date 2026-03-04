'use client';

import React, { useState } from 'react';
import {
    BanknotesIcon,
    DocumentDuplicateIcon,
    ArrowDownTrayIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ArrowRightIcon
} from '@heroicons/react/24/outline';
import { issueCashuStep1, issueCashuStep2, type DepositStepResult } from '@/orchestrator/steps/issueCashu';
import type { OrchestratorEvent } from '@/lib/types';

type IssueStatus =
    | 'idle'
    | 'depositing'         // step 1 in progress
    | 'awaiting_step2'     // step 1 done, waiting for user click to trigger step 2
    | 'withdrawing'        // step 2: withdrawal tx
    | 'estimating'
    | 'creating_invoice'
    | 'swapping'
    | 'minting'
    | 'complete'
    | 'error';

interface IssueTokenTabProps {
    isConnected: boolean;
    onConnectWallet: () => void;
    showNotification: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export function IssueTokenTab({ isConnected, onConnectWallet, showNotification }: IssueTokenTabProps) {
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState<IssueStatus>('idle');
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [currentMessage, setCurrentMessage] = useState('');
    const [satsValue, setSatsValue] = useState(0);
    // Saved between step 1 and step 2
    const [depositResult, setDepositResult] = useState<DepositStepResult | null>(null);

    const handleEvent = (event: OrchestratorEvent) => {
        console.log('Issue event:', event);
        if (event.progress !== undefined) setProgress(event.progress);
        if (event.message) setCurrentMessage(event.message);

        if (event.type === 'issue:progress') {
            const msg = event.message || '';
            if (msg.includes('Deposit') || msg.includes('deposit')) setStatus('depositing');
            else if (msg.includes('Withdraw') || msg.includes('withdraw')) setStatus('withdrawing');
            else if (msg.includes('Estimat')) setStatus('estimating');
            else if (msg.includes('invoice') || msg.includes('Invoice')) setStatus('creating_invoice');
            else if (msg.includes('Swap') || msg.includes('swap')) setStatus('swapping');
            else if (msg.includes('Claim') || msg.includes('token') || msg.includes('Token')) setStatus('minting');
        } else if (event.type === 'issue:complete') {
            setStatus('complete');
        } else if (event.type === 'issue:error') {
            setStatus('error');
            setError(event.message || 'Unknown error');
        }
    };

    // ── Step 1: Approve + Deposit (triggered by "Issue Token" click) ──────────
    const handleStep1 = async () => {
        if (!isConnected) { onConnectWallet(); return; }

        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) {
            showNotification('error', 'Invalid Amount', 'Please enter a valid amount');
            return;
        }

        setStatus('depositing');
        setError('');
        setProgress(0);
        setDepositResult(null);

        try {
            const result = await issueCashuStep1(amt, handleEvent);
            setDepositResult(result);
            setStatus('awaiting_step2');
            setProgress(20);
            showNotification('info', 'Step 1 Complete', 'Deposit confirmed. Click "Complete Withdrawal" to continue.');
        } catch (err) {
            setStatus('error');
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(msg);
            showNotification('error', 'Deposit Failed', msg);
        }
    };

    // ── Step 2: Withdraw + Swap + Mint (triggered by button click = new gesture) ──
    const handleStep2 = async () => {
        if (!depositResult) return;

        setStatus('withdrawing');
        setProgress(25);

        try {
            const result = await issueCashuStep2(depositResult, handleEvent);
            setToken(result.token);
            setSatsValue(result.satsValue);
            setStatus('complete');
            showNotification('success', 'Token Issued', `Your ${result.satsValue} sats ecash token is ready`);
        } catch (err) {
            setStatus('error');
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(msg);
            showNotification('error', 'Withdrawal Failed', msg);
        }
    };

    const copyToken = () => {
        navigator.clipboard.writeText(token);
        showNotification('success', 'Copied', 'Token copied to clipboard');
    };

    const downloadToken = () => {
        const blob = new Blob([token], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cashu-token-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('success', 'Downloaded', 'Token saved to file');
    };

    const reset = () => {
        setStatus('idle');
        setAmount('');
        setToken('');
        setError('');
        setProgress(0);
        setCurrentMessage('');
        setSatsValue(0);
        setDepositResult(null);
    };

    const getStatusMessage = () => {
        switch (status) {
            case 'depositing': return 'Step 1/2 — Depositing STRK to privacy mixer...';
            case 'withdrawing': return 'Step 2/2 — Withdrawing from mixer...';
            case 'estimating': return 'Estimating conversion rate...';
            case 'creating_invoice': return 'Creating Cashu mint invoice...';
            case 'swapping': return 'Swapping STRK to Lightning...';
            case 'minting': return 'Claiming Cashu token...';
            default: return currentMessage || 'Processing...';
        }
    };

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">

            {/* ── Idle: enter amount ── */}
            {status === 'idle' && (
                <>
                    <h2 className="text-xl font-bold mb-6 flex items-center space-x-3">
                        <BanknotesIcon className="w-6 h-6 text-blue-400" />
                        <span>Issue Ecash Token</span>
                    </h2>

                    <div className="mb-6">
                        <label className="block text-sm text-gray-300 mb-2">Amount (STRK)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">Minimum: 1.0 STRK</p>
                    </div>

                    <button
                        onClick={handleStep1}
                        disabled={!amount || parseFloat(amount) <= 0}
                        className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition"
                    >
                        {isConnected ? 'Issue Token (Step 1 of 2)' : 'Connect Wallet'}
                    </button>

                    <div className="mt-4 p-3 bg-gray-800/60 border border-gray-700 rounded-lg">
                        <p className="text-xs text-gray-400">
                            <span className="text-violet-400 font-semibold">2-step process:</span>{' '}
                            Step 1 deposits STRK into the privacy mixer (1 wallet signature).
                            Step 2 withdraws & converts to a Cashu ecash token (1 more signature).
                        </p>
                    </div>
                </>
            )}

            {/* ── Step 1 in progress ── */}
            {status === 'depositing' && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mb-4"></div>
                    <p className="text-gray-300 mb-2 font-semibold">Step 1 of 2 — Depositing</p>
                    <p className="text-sm text-gray-400 mb-4">{currentMessage || 'Waiting for wallet signature...'}</p>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-4">
                        <div className="bg-violet-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{progress}%</p>
                </div>
            )}

            {/* ── Step 1 done — prompt user to start step 2 ── */}
            {status === 'awaiting_step2' && (
                <div className="text-center py-8">
                    <CheckCircleIcon className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-white mb-2">Step 1 Complete ✓</p>
                    <p className="text-sm text-gray-400 mb-6">
                        Your STRK is safely deposited in the privacy mixer.
                        Click below to withdraw &amp; convert it to a Cashu ecash token.
                    </p>
                    <div className="mb-6 p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                        <p className="text-xs text-violet-300">
                            <span className="font-semibold">Why a second step?</span>{' '}
                            The privacy mixer enforces a minimum time delay between deposit and withdrawal.
                            This prevents linking deposits to withdrawals on-chain.
                        </p>
                    </div>
                    <button
                        onClick={handleStep2}
                        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white py-4 rounded-lg font-bold text-lg transition"
                    >
                        <ArrowRightIcon className="w-5 h-5" />
                        Complete Withdrawal (Step 2 of 2)
                    </button>
                    <p className="text-xs text-gray-500 mt-3">Your wallet will ask for one more signature.</p>
                </div>
            )}

            {/* ── Step 2 in progress ── */}
            {(status === 'withdrawing' || status === 'estimating' ||
                status === 'creating_invoice' || status === 'swapping' || status === 'minting') && (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mb-4"></div>
                        <p className="text-gray-300 mb-2 font-semibold">Step 2 of 2 — Completing</p>
                        <p className="text-sm text-gray-400 mb-4">{getStatusMessage()}</p>
                        {progress > 0 && (
                            <div className="w-full bg-gray-700 rounded-full h-2 mt-4">
                                <div className="bg-violet-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                        )}
                        <p className="text-sm text-gray-500 mt-2">{progress}%</p>
                    </div>
                )}

            {/* ── Complete ── */}
            {status === 'complete' && token && (
                <div>
                    <h2 className="text-xl font-bold mb-6 flex items-center space-x-3">
                        <CheckCircleIcon className="w-6 h-6 text-green-400" />
                        <span>Token Issued Successfully</span>
                    </h2>

                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-300 font-semibold mb-2">
                            IMPORTANT: Store this token securely!
                        </p>
                        <p className="text-sm text-green-300">
                            This token represents real value ({satsValue} sats ≈ {amount} STRK) and can be redeemed for STRK. Anyone with this token can redeem it.
                        </p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-300 mb-2">Ecash Token</label>
                        <textarea
                            readOnly
                            value={token}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono text-sm resize-none"
                            rows={6}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button
                            onClick={copyToken}
                            className="flex items-center justify-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition"
                        >
                            <DocumentDuplicateIcon className="w-5 h-5" />
                            <span>Copy Token</span>
                        </button>
                        <button
                            onClick={downloadToken}
                            className="flex items-center justify-center space-x-2 bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-lg font-semibold transition"
                        >
                            <ArrowDownTrayIcon className="w-5 h-5" />
                            <span>Download</span>
                        </button>
                    </div>

                    <button onClick={reset} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition">
                        Issue Another Token
                    </button>
                </div>
            )}

            {/* ── Error ── */}
            {status === 'error' && error && (
                <div>
                    <h2 className="text-xl font-bold mb-6 flex items-center space-x-3">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
                        <span>Error</span>
                    </h2>
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-300">{error}</p>
                    </div>
                    {/* If deposit succeeded but step 2 failed, offer retry of step 2 only */}
                    {depositResult && (
                        <button
                            onClick={handleStep2}
                            className="w-full mb-3 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-lg font-semibold transition"
                        >
                            <ArrowRightIcon className="w-4 h-4" />
                            Retry Step 2 (Withdrawal)
                        </button>
                    )}
                    <button onClick={reset} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition">
                        Start Over
                    </button>
                </div>
            )}
        </div>
    );
}
