'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WalletIcon, CheckCircleIcon, HomeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import WalletConnection from '../../components/WalletConnection';
import TransactionStatus from '../../components/TransactionStatus';
import Notification from '../../components/Notification';
import { Stepper } from '../../components/mixer/Stepper';
import { SetupForm } from '../../components/mixer/SetupForm';
import { DepositView } from '../../components/mixer/DepositView';
import { MixingView } from '../../components/mixer/MixingView';
import { CompleteView } from '../../components/mixer/CompleteView';
import { runMix } from '../../lib/orchestrator';
import { MixRequest, PrivacyLevel as PLevel } from '../../lib/types';
import { type WalletType } from '@/integrations/starknet/wallet';
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

export default function MixerPage() {
    // Use global wallet context (persistent across pages/reloads)
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

    const [showWalletModal, setShowWalletModal] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    // AbortController for cancelling in-progress mixes
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

    // Privacy level presets are defined and applied within SetupForm; no local copy needed here.

    // Stepper stages are fixed and handled internally; no local steps array needed.

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

    const handleWalletConnect = async (walletId: string) => {
        setIsConnecting(true);
        try {
            // Map UI id to WalletType used by the manager
            const mapId = (id: string): WalletType => {
                if (id.toLowerCase() === 'argentx') return 'argentX';
                if (id.toLowerCase() === 'braavos') return 'braavos';
                if (id.toLowerCase() === 'okx') return 'okx';
                return 'argentX';
            };

            await wallet.connect(mapId(walletId));
            setShowWalletModal(false);
            showNotification('success', 'Wallet Connected', `Connected to ${walletId}`);
        } catch {
            showNotification('error', 'Connection Failed', 'Failed to connect wallet. Please try again.');
        } finally {
            setIsConnecting(false);
        }
    };

    // Cancel handler for in-progress mixes
    const handleCancelMix = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setSession(prev => ({ ...prev, step: 'setup', progress: 0 }));
            showNotification('warning', 'Mix Cancelled', 'The mixing operation was cancelled.');
        }
    }, []);

    // Note: amount and privacy level changes are handled within child components via props callbacks

    const startMixing = async () => {
        if (!wallet.isConnected) {
            setShowWalletModal(true);
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
            // Either call the modular orchestrator directly (client-side) or via API route.
            // Using direct call to keep interactions smooth; switch to fetch('/api/mix') if you prefer server-side orchestration.
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

    // currentStepIndex not used directly; Stepper consumes `session.step`.

    return (
        <div className="min-h-screen text-white">
            <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <div className="text-center mb-10 animate-fade-in-up">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <Link
                            href="/"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-subtle hover:bg-white/10 transition-all text-sm press-effect"
                        >
                            <HomeIcon className="w-4 h-4" />
                            <span>Home</span>
                        </Link>
                        <div className="px-4 py-2 rounded-xl glass-subtle">
                            <HealthIndicator />
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
                        Privacy <span className="text-gradient">Mixer</span>
                    </h1>
                    <p className="text-gray-500 text-base">
                        Enhanced privacy through advanced cryptographic mixing
                    </p>

                    {/* Wallet Status */}
                    <div className="mt-5">
                        {wallet.isConnected ? (
                            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-emerald-400 text-sm font-medium">Connected</span>
                                {wallet.address && (
                                    <span className="text-emerald-400/50 text-xs font-mono">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowWalletModal(true)}
                                className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 hover:border-violet-500/40 rounded-xl px-5 py-2.5 transition-all press-effect"
                            >
                                <WalletIcon className="w-5 h-5 text-violet-400" />
                                <span className="text-violet-400 text-sm font-medium">Connect Wallet</span>
                            </button>
                        )}
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
            </div>

            {/* Modals and Notifications */}
            <WalletConnection
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                onConnect={handleWalletConnect}
                isConnecting={isConnecting}
            />

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
