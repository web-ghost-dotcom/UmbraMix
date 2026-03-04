'use client';

import React, { useState, useCallback } from 'react';
import { useWallet } from '@/context/WalletProvider';
import { ShieldCheckIcon, BanknotesIcon, ArrowUpOnSquareStackIcon } from '@heroicons/react/24/outline';
import { IssueTokenTab } from '@/components/mixer/split/IssueTokenTab';
import { RedeemTokenTab } from '@/components/mixer/split/RedeemTokenTab';

type ActiveTab = 'issue' | 'redeem';

export default function SplitMixPage() {
    const wallet = useWallet(); // Wallet context from dashboard layout
    const [activeTab, setActiveTab] = useState<ActiveTab>('issue');
    const [isConnecting, setIsConnecting] = useState(false);
    const [notification, setNotification] = useState<{ type: string; title: string; message: string } | null>(null);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            await wallet.connect('argentX');
        } catch (e) {
            console.error(e);
        } finally {
            setIsConnecting(false);
        }
    };

    const showNotification = useCallback((type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
        setNotification({ type, title, message });
        setTimeout(() => setNotification(null), 5000);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Split Mix</h1>
                    <p className="text-zinc-400">
                        Manual custody with enhanced temporal privacy. Issue ecash tokens or redeem them for STRK.
                    </p>
                </div>
                {!wallet.isConnected && (
                    <button
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <ShieldCheckIcon className="w-5 h-5" />
                        <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
                    </button>
                )}
            </div>

            {/* Main Content Card */}
            <div className="dashboard-card p-6 min-h-[500px]">
                {/* Tabs */}
                <div className="flex items-center space-x-1 bg-zinc-900/50 p-1 rounded-xl mb-8 w-fit border border-white/5">
                    <button
                        onClick={() => setActiveTab('issue')}
                        className={`
                            flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            ${activeTab === 'issue'
                                ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'}
                        `}
                    >
                        <BanknotesIcon className="w-5 h-5" />
                        <span>Issue Tokens</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('redeem')}
                        className={`
                            flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            ${activeTab === 'redeem'
                                ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'}
                        `}
                    >
                        <ArrowUpOnSquareStackIcon className="w-5 h-5" />
                        <span>Redeem Tokens</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="mt-6">
                    {activeTab === 'issue' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <IssueTokenTab
                                isConnected={wallet.isConnected}
                                onConnectWallet={handleConnect}
                                showNotification={showNotification}
                            />
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <RedeemTokenTab
                                isConnected={wallet.isConnected}
                                onConnectWallet={handleConnect}
                                showNotification={showNotification}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
