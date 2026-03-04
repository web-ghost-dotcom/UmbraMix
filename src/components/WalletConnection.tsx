"use client";
import React, { useState } from 'react';
import { WalletIcon, CreditCardIcon, KeyIcon, ShieldCheckIcon, ShieldExclamationIcon, CircleStackIcon } from '@heroicons/react/24/outline';

interface WalletOption {
    id: string;
    name: string;
    icon: string;
    description: string;
    isInstalled: boolean;
    isPopular?: boolean;
}

interface WalletConnectionProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (walletId: string) => void;
    isConnecting: boolean;
}

export default function WalletConnection({ isOpen, onClose, onConnect, isConnecting }: WalletConnectionProps) {
    const [selectedWallet, setSelectedWallet] = useState<string>('');

    const wallets: WalletOption[] = [
        {
            id: 'argentx',
            name: 'ArgentX',
            icon: 'argentx',
            description: 'Most popular Starknet wallet with advanced features',
            isInstalled: typeof window !== 'undefined' && !!(window as any).starknet_argentX,
            isPopular: true
        },
        {
            id: 'braavos',
            name: 'Braavos',
            icon: 'braavos',
            description: 'Security-focused wallet with hardware support',
            isInstalled: typeof window !== 'undefined' && !!(window as any).starknet_braavos
        },
        {
            id: 'okx',
            name: 'OKX Wallet',
            icon: 'okx',
            description: 'Multi-chain wallet with DeFi integration',
            isInstalled: typeof window !== 'undefined' && !!(window as any).starknet_okxwallet
        }
    ];

    const handleConnect = (walletId: string) => {
        setSelectedWallet(walletId);
        onConnect(walletId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/40 border border-white/10 animate-fade-in-scale">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                            <WalletIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Connect Wallet</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 press-effect"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-2.5">
                    {wallets.map((wallet, idx) => (
                        <div key={wallet.id} className="animate-stagger-in" style={{ animationDelay: `${idx * 60}ms` }}>
                            <button
                                onClick={() => handleConnect(wallet.id)}
                                disabled={isConnecting || !wallet.isInstalled}
                                className={`w-full p-4 rounded-xl border transition-all duration-200 press-effect ${wallet.isInstalled
                                    ? 'border-white/10 hover:border-violet-500/30 hover:bg-white/5'
                                    : 'border-white/5 bg-white/[0.02] cursor-not-allowed opacity-40'
                                    } ${selectedWallet === wallet.id && isConnecting
                                        ? 'border-violet-500/40 bg-violet-500/10'
                                        : ''
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 glass-subtle rounded-xl flex items-center justify-center">
                                        {wallet.id === 'argentx' && <ShieldCheckIcon className="w-5 h-5 text-blue-400" />}
                                        {wallet.id === 'braavos' && <ShieldExclamationIcon className="w-5 h-5 text-violet-400" />}
                                        {wallet.id === 'okx' && <CircleStackIcon className="w-5 h-5 text-gray-300" />}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-white text-sm">{wallet.name}</h3>
                                            {wallet.isPopular && (
                                                <span className="px-2 py-0.5 bg-violet-500/15 text-violet-400 text-xs rounded-lg font-medium">
                                                    Popular
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">{wallet.description}</p>
                                        {!wallet.isInstalled && (
                                            <p className="text-xs text-red-400/80 mt-0.5">Not installed</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {wallet.isInstalled ? (
                                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                        ) : (
                                            <KeyIcon className="w-4 h-4 text-gray-600" />
                                        )}
                                        {selectedWallet === wallet.id && isConnecting && (
                                            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                        )}
                                    </div>
                                </div>
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mt-5 p-4 glass-subtle rounded-xl">
                    <div className="flex items-start gap-3">
                        <CreditCardIcon className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-white text-sm">Wallet Security</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Only connect wallets you trust. The mixer requires transaction signing for privacy operations.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <p className="text-xs text-gray-600">
                        Don&apos;t have a wallet?{' '}
                        <a
                            href="https://www.argent.xyz/starknet/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            Install ArgentX
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
