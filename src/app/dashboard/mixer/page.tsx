'use client';

import React, { useState, useRef, useCallback } from 'react';
import TransactionStatus from '@/components/TransactionStatus';
import Notification from '@/components/Notification';
import { Stepper } from '@/components/mixer/Stepper';
import { SetupForm } from '@/components/mixer/SetupForm';
import { DepositView } from '@/components/mixer/DepositView';
import { MixingView } from '@/components/mixer/MixingView';
import { CompleteView } from '@/components/mixer/CompleteView';
import { runMix } from '@/lib/orchestrator';
import { MixRequest, PrivacyLevel as PLevel } from '@/lib/types';
import { useWallet } from '@/context/WalletProvider';
import SessionRecoveryBanner from '@/components/SessionRecoveryBanner';
import HealthIndicator from '@/components/HealthIndicator';
import { usePushNotifications, createMixNotifications } from '@/hooks/usePushNotifications';

type MixingStep = 'setup' | 'deposit' | 'mixing' | 'complete';

interface MixingSession {
    step: MixingStep;
    amount: string;
    privacyLevel: PLevel;
    progress: number;
    anonymitySetSize: number;
    estimatedTime: number;
    txHash?: string;
    privacyScore?: number;
}

export default function MixerDashboardPage() {
    const wallet = useWallet();
    const { sendNotification } = usePushNotifications();
    const pushNotify = createMixNotifications(sendNotification);

    const [session, setSession] = useState<MixingSession>({
        step: 'setup',
        amount: '',
        privacyLevel: 'standard',
        progress: 0,
        anonymitySetSize: 0,
        estimatedTime: 0
    });

    const abortControllerRef = useRef<AbortController | null>(null);
    const [notification, setNotification] = useState<{
        show: boolean;
        type: 'success' | 'error' | 'warning' | 'info';
        title: string;
        message: string;
    }>({ show: false, type: 'info', title: '', message: '' });

    // Live transaction history (no recipient addresses stored)
    const [transactions, setTransactions] = useState<Array<{
        id: string;
        type: 'deposit' | 'mix' | 'withdraw';
        amount: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        timestamp: number;
        privacyScore: number;
        fromNetwork: string;
        toNetwork: string;
        anonymitySetSize?: number;
    }>>([]);

    const [mixReq, setMixReq] = useState<MixRequest>({
        amountStrk: 0,
        destinations: [],
        privacyLevel: 'standard',
        enableTimeDelays: true,
        enableSplitOutputs: true,
        splitCount: 2,
        enableRandomizedMints: true,
        enableAmountObfuscation: true,
        enableDecoyTx: true,
    });

    const showNotification = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
        setNotification({ show: true, type, title, message });
    };

    const handleCancelMix = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setSession(prev => ({ ...prev, step: 'setup', progress: 0 }));
            showNotification('warning', 'Mix Cancelled', 'The mixing operation was cancelled.');
        }
    }, []);

    const startMixing = async () => {
        if (!wallet.isConnected) {
            showNotification('warning', 'Wallet Required', 'Please connect your wallet in the top bar to continue.');
            return;
        }

        const amt = parseFloat(session.amount || '0');
        if (!amt || amt <= 0 || mixReq.destinations.length === 0 || !mixReq.destinations[0]) {
            showNotification('warning', 'Invalid Input', 'Enter amount and destination address');
            return;
        }

        setSession((p) => ({ ...p, step: 'deposit', progress: 0 }));
        showNotification('info', 'Starting Mix', 'Initializing mixing pipeline...');

        // Create abort controller for this mix
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const txIdBase = Date.now().toString(36);

            await runMix(
                { ...mixReq, amountStrk: amt, privacyLevel: session.privacyLevel },
                (e) => {
                    // Update session progress/metrics
                    if (typeof e.progress === 'number') {
                        setSession((p) => ({
                            ...p,
                            step: p.step === 'deposit' && (e.progress as number) > 30 ? 'mixing' : p.step,
                            progress: (e.progress as number) ?? p.progress,
                        }));
                    }
                    if (typeof e.anonymitySetSize === 'number') {
                        setSession((p) => ({ ...p, anonymitySetSize: e.anonymitySetSize ?? p.anonymitySetSize }));
                    }
                    if (typeof e.estimatedTime === 'number') {
                        setSession((p) => ({ ...p, estimatedTime: e.estimatedTime ?? p.estimatedTime }));
                    }

                    // Maintain live, address-free transaction history
                    setTransactions((prev) => {
                        const next = [...prev];
                        const now = Date.now();
                        if (e.type === 'deposit:initiated') {
                            next.push({
                                id: `${txIdBase}-dep`,
                                type: 'deposit',
                                amount: String(amt),
                                status: 'pending',
                                timestamp: now,
                                privacyScore: 0,
                                fromNetwork: 'Starknet',
                                toNetwork: 'Lightning',
                            });
                        }
                        if (e.type === 'lightning:paid') {
                            const idx = next.findIndex(t => t.id === `${txIdBase}-dep`);
                            if (idx >= 0) next[idx] = { ...next[idx], status: 'completed' };
                        }
                        if (e.type === 'cashu:minted' && !next.some(t => t.id === `${txIdBase}-mix`)) {
                            next.push({
                                id: `${txIdBase}-mix`,
                                type: 'mix',
                                amount: String(amt),
                                status: 'processing',
                                timestamp: now,
                                privacyScore: 0,
                                fromNetwork: 'Lightning',
                                toNetwork: 'STRK',
                            });
                        }
                        if (e.type === 'mix:complete') {
                            const idx = next.findIndex(t => t.id === `${txIdBase}-mix`);
                            if (idx >= 0) next[idx] = {
                                ...next[idx],
                                status: 'completed',
                                privacyScore: e.privacyScore ?? next[idx].privacyScore,
                                anonymitySetSize: session.anonymitySetSize || next[idx].anonymitySetSize,
                            };
                        }
                        if (e.type === 'mix:error') {
                            const idxMix = next.findIndex(t => t.id === `${txIdBase}-mix`);
                            if (idxMix >= 0) next[idxMix] = { ...next[idxMix], status: 'failed' };
                        }
                        return next;
                    });

                    if (e.type === 'mix:complete') {
                        showNotification('success', 'Mix Complete', `Privacy score ${e.privacyScore}%`);
                        setSession((p) => ({ ...p, step: 'complete', progress: 100 }));
                        pushNotify.mixComplete(String(amt));
                    }
                    if (e.type === 'mix:error') {
                        showNotification('error', 'Mix Error', e.message || 'Unknown error');
                        pushNotify.mixFailed(e.message || 'Unknown error');
                    }
                },
                { signal: controller.signal }
            );
        } catch {
            // error already notified
        } finally {
            abortControllerRef.current = null;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Privacy Mixer</h1>
                    <p className="text-gray-400">Anonymize your funds using zk-SNARKs and Lightning Network jumps.</p>
                </div>
                <div className="px-4 py-2 rounded-xl glass-subtle">
                    <HealthIndicator />
                </div>
            </div>

            <SessionRecoveryBanner />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Mixer Interface */}
                <div className="lg:col-span-2">
                    <Stepper current={session.step} />

                    {/* Main Content - animated step transitions */}
                    <div className="animate-fade-in-scale" key={session.step}>
                        {session.step === 'setup' && (
                            <SetupForm
                                value={mixReq}
                                onChange={(v) => {
                                    if (v.amountStrk != null) setSession((p) => ({ ...p, amount: String(v.amountStrk) }));
                                    if (v.privacyLevel) setSession((p) => ({ ...p, privacyLevel: v.privacyLevel as PLevel }));
                                    setMixReq((p) => ({ ...p, ...v }));
                                }}
                                onStart={startMixing}
                                isConnected={wallet.isConnected}
                            />
                        )}

                        {session.step === 'deposit' && (
                            <DepositView amount={session.amount} onCancel={handleCancelMix} />
                        )}

                        {session.step === 'mixing' && (
                            <MixingView progress={session.progress} anonymitySet={session.anonymitySetSize} eta={session.estimatedTime} />
                        )}

                        {session.step === 'complete' && (
                            <CompleteView
                                amount={session.amount}
                                anonymitySet={session.anonymitySetSize}
                                onReset={() => setSession({ step: 'setup', amount: '', privacyLevel: 'standard', progress: 0, anonymitySetSize: 0, estimatedTime: 0 })}
                                txHash={session.txHash}
                                privacyScore={session.privacyScore}
                            />
                        )}
                    </div>
                </div>

                {/* Transaction Status Sidebar */}
                <div className="lg:col-span-1">
                    <TransactionStatus
                        transactions={transactions}
                        currentMixingSession={session.step === 'mixing' ? {
                            id: 'current',
                            phase: session.step,
                            progress: session.progress,
                            anonymitySetSize: session.anonymitySetSize,
                            estimatedTime: session.estimatedTime
                        } : undefined}
                    />
                </div>
            </div>

            <Notification
                type={notification.type}
                title={notification.title}
                message={notification.message}
                isVisible={notification.show}
                onClose={() => setNotification(prev => ({ ...prev, show: false }))}
            />
        </div>
    );
}
