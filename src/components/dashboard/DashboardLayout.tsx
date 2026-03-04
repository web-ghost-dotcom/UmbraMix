'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import WalletConnection from '@/components/WalletConnection';
// The wallet connection component is the modal itself
import { useWallet } from '@/context/WalletProvider';
import { type WalletType } from '@/integrations/starknet/wallet';

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const wallet = useWallet();
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = async (walletId: string) => {
        setIsConnecting(true);
        try {
            const mapId = (id: string): WalletType => {
                if (id === 'argentx') return 'argentX';
                if (id === 'braavos') return 'braavos';
                if (id === 'okx') return 'okx';
                return 'argentX';
            };

            await wallet.connect(mapId(walletId));
            setIsWalletModalOpen(false);
        } catch (error) {
            console.error('Wallet connection failed', error);
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#05060a] overflow-hidden">
            {/* Sidebar */}
            <div className="hidden lg:block w-64 flex-shrink-0">
                <Sidebar />
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <TopBar onConnectWallet={() => setIsWalletModalOpen(true)} />

                <main className="flex-1 overflow-y-auto w-full p-4 lg:p-8 custom-scrollbar">
                    {children}
                </main>
            </div>

            {/* Wallet Modal */}
            <WalletConnection
                isOpen={isWalletModalOpen}
                onClose={() => setIsWalletModalOpen(false)}
                onConnect={handleConnect}
                isConnecting={isConnecting}
            />
        </div>
    );
}
