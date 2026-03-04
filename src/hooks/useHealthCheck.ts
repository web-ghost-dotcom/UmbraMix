// Connection health monitoring for backend services
// Checks RPC, Lightning node, and Cashu mint availability

import { ENV } from '@/config/env';

export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown';

export interface ServiceHealth {
    name: string;
    status: ServiceStatus;
    latencyMs: number | null;
    lastChecked: number;
    error?: string;
}

export interface SystemHealth {
    rpc: ServiceHealth;
    lightning: ServiceHealth;
    cashuMint: ServiceHealth;
    overall: ServiceStatus;
}

async function checkWithTimeout(url: string, timeoutMs: number = 5000): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store',
        });
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);
        return { ok: res.ok || res.status === 405, latencyMs }; // 405 Method Not Allowed is still "reachable"
    } catch (err: any) {
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);
        if (err.name === 'AbortError') {
            return { ok: false, latencyMs, error: 'Timeout' };
        }
        return { ok: false, latencyMs, error: err.message || 'Unreachable' };
    }
}

export async function checkSystemHealth(): Promise<SystemHealth> {
    const now = Date.now();

    // Check Starknet RPC
    const rpcResult = ENV.STARKNET_RPC
        ? await checkWithTimeout(ENV.STARKNET_RPC, 8000)
        : { ok: false, latencyMs: null as number | null, error: 'No RPC configured' };

    const rpc: ServiceHealth = {
        name: 'Starknet RPC',
        status: rpcResult.ok ? (rpcResult.latencyMs! > 3000 ? 'degraded' : 'online') : 'offline',
        latencyMs: rpcResult.latencyMs,
        lastChecked: now,
        error: rpcResult.error,
    };

    // Check Lightning node
    const lnResult = ENV.LND_URL
        ? await checkWithTimeout(ENV.LND_URL, 8000)
        : { ok: false, latencyMs: null as number | null, error: 'No LND configured' };

    const lightning: ServiceHealth = {
        name: 'Lightning Node',
        status: lnResult.ok ? (lnResult.latencyMs! > 3000 ? 'degraded' : 'online') : 'offline',
        latencyMs: lnResult.latencyMs,
        lastChecked: now,
        error: lnResult.error,
    };

    // Check Cashu mint
    const mintUrl = ENV.CASHU_DEFAULT_MINT;
    const mintResult = mintUrl
        ? await checkWithTimeout(`${mintUrl}/v1/info`, 8000)
        : { ok: false, latencyMs: null as number | null, error: 'No mint configured' };

    const cashuMint: ServiceHealth = {
        name: 'Cashu Mint',
        status: mintResult.ok ? (mintResult.latencyMs! > 3000 ? 'degraded' : 'online') : 'offline',
        latencyMs: mintResult.latencyMs,
        lastChecked: now,
        error: mintResult.error,
    };

    // Overall status
    const statuses = [rpc.status, lightning.status, cashuMint.status];
    let overall: ServiceStatus = 'online';
    if (statuses.some(s => s === 'offline')) overall = 'degraded';
    if (statuses.every(s => s === 'offline')) overall = 'offline';

    return { rpc, lightning, cashuMint, overall };
}
