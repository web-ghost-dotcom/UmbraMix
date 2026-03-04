"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { RealStarknetWalletClient, type WalletType, type WalletConnection } from '@/integrations/starknet/wallet';

type WalletCtx = {
    isReady: boolean;
    isConnected: boolean;
    address?: string;
    walletType?: WalletType;
    connect: (preferred?: WalletType) => Promise<void>;
    disconnect: () => Promise<void>;
    client: RealStarknetWalletClient | null;
};

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [client] = useState(() => new RealStarknetWalletClient());
    const [isReady, setReady] = useState(false);
    const [conn, setConn] = useState<WalletConnection | null>(null);

    const connect = useCallback(async (preferred?: WalletType) => {
        const c = await client.connect(preferred);
        setConn(c);
        try {
            if (typeof window !== 'undefined' && preferred) {
                window.localStorage.setItem('slpm:last-wallet', preferred);
            }
        } catch { }
    }, [client]);

    const disconnect = useCallback(async () => {
        await client.disconnect();
        setConn(null);
        try { if (typeof window !== 'undefined') window.localStorage.removeItem('slpm:last-wallet'); } catch { }
    }, [client]);

    // Auto-connect on mount from localStorage
    useEffect(() => {
        (async () => {
            try {
                const last = typeof window !== 'undefined' ? (window.localStorage.getItem('slpm:last-wallet') as WalletType | null) : null;
                if (last) {
                    await connect(last);
                }
            } catch {/* ignore */ }
            setReady(true);
        })();
    }, [connect]);

    const value: WalletCtx = useMemo(() => ({
        isReady,
        isConnected: Boolean(conn?.isConnected),
        address: conn?.account?.address,
        walletType: conn?.walletType,
        connect,
        disconnect,
        client
    }), [isReady, conn, connect, disconnect, client]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useWallet must be used within WalletProvider');
    return ctx;
}
