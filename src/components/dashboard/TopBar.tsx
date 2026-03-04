'use client';

import React from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletProvider';
import { BellIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { WalletIcon } from '@heroicons/react/24/outline';

interface TopBarProps {
    onConnectWallet: () => void;
}

export default function TopBar({ onConnectWallet }: TopBarProps) {
    const { isConnected, address, disconnect } = useWallet();

    const shortAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : '';

    return (
        <header className="sticky top-0 z-40 bg-black/60 backdrop-blur-xl border-b border-white/5 h-16 flex items-center justify-between px-6">
            <div className="flex items-center gap-4 flex-1">
                {/* Search - Decorative for now */}
                <div className="relative group max-w-md w-full hidden md:block">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-violet-400">
                        <MagnifyingGlassIcon className="h-4 w-4" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search mix history, Vault ID..."
                        className="block w-full pl-10 pr-3 py-2 border border-white/5 rounded-xl leading-5 bg-white/5 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-black/40 focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 sm:text-sm transition-all duration-200"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Notifications */}
                <button className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <span className="absolute top-2 right-2.5 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-[#05060a]" />
                    <BellIcon className="h-6 w-6" />
                </button>

                {/* Wallet Connection */}
                {isConnected ? (
                    <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-1.5 px-3 transition-all duration-200">
                        <div className="flex flex-col items-end mr-1">
                            <span className="text-xs font-semibold text-white">{shortAddress}</span>
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Connected
                            </span>
                        </div>
                        <button
                            onClick={disconnect}
                            title="Disconnect wallet"
                            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onConnectWallet}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-violet-900/20 active:scale-95"
                    >
                        <WalletIcon className="w-4 h-4" />
                        Connect Wallet
                    </button>
                )}
            </div>
        </header>
    );
}
