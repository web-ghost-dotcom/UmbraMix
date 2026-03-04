'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStarknetRpc } from '@/config/env';

export interface GasPriceData {
    /** Gas price in wei (hex string from RPC) */
    priceWei: bigint;
    /** Gas price in STRK (human readable) */
    priceStrk: string;
    /** Relative level for UI */
    level: 'low' | 'medium' | 'high';
    /** Timestamp of last fetch */
    updatedAt: number;
    /** Whether currently fetching */
    isLoading: boolean;
    /** Error message if fetch failed */
    error?: string;
}

// Thresholds in wei — tuned for Starknet mainnet as of 2025/2026
const LOW_THRESHOLD = BigInt(1e13);   // < 0.00001 STRK
const HIGH_THRESHOLD = BigInt(1e15);  // > 0.001 STRK

function classifyGas(priceWei: bigint): 'low' | 'medium' | 'high' {
    if (priceWei <= LOW_THRESHOLD) return 'low';
    if (priceWei >= HIGH_THRESHOLD) return 'high';
    return 'medium';
}

export function useGasPrice(pollIntervalMs = 30_000) {
    const [data, setData] = useState<GasPriceData>({
        priceWei: 0n,
        priceStrk: '0',
        level: 'low',
        updatedAt: 0,
        isLoading: true,
    });

    const fetchGas = useCallback(async () => {
        setData(prev => ({ ...prev, isLoading: true, error: undefined }));
        try {
            const rpc = getStarknetRpc();
            const resp = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'starknet_blockHashAndNumber',
                    params: [],
                    id: 1,
                }),
            });
            const blockData = await resp.json();
            const blockNumber = blockData?.result?.block_number;

            // Get block with gas prices
            const blockResp = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'starknet_getBlockWithTxHashes',
                    params: [{ block_number: blockNumber }],
                    id: 2,
                }),
            });
            const block = await blockResp.json();

            // Extract L1 gas price from block header
            const gasPrice = block?.result?.l1_gas_price?.price_in_fri // STRK-denominated gas
                ?? block?.result?.l1_gas_price?.price_in_wei
                ?? '0x0';

            const priceWei = BigInt(gasPrice);
            const priceStrk = (Number(priceWei) / 1e18).toFixed(8);
            const level = classifyGas(priceWei);

            setData({
                priceWei,
                priceStrk,
                level,
                updatedAt: Date.now(),
                isLoading: false,
            });
        } catch (e) {
            setData(prev => ({
                ...prev,
                isLoading: false,
                error: e instanceof Error ? e.message : 'Failed to fetch gas price',
            }));
        }
    }, []);

    useEffect(() => {
        fetchGas();
        const interval = setInterval(fetchGas, pollIntervalMs);
        return () => clearInterval(interval);
    }, [fetchGas, pollIntervalMs]);

    return { ...data, refresh: fetchGas };
}
