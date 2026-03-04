'use client';

import React, { useEffect, useState } from 'react';
import { checkSystemHealth, SystemHealth, ServiceStatus } from '@/hooks/useHealthCheck';

const STATUS_COLORS: Record<ServiceStatus, string> = {
    online: 'bg-green-500',
    degraded: 'bg-yellow-500',
    offline: 'bg-red-500',
    unknown: 'bg-gray-500',
};

const STATUS_TEXT_COLORS: Record<ServiceStatus, string> = {
    online: 'text-green-400',
    degraded: 'text-yellow-400',
    offline: 'text-red-400',
    unknown: 'text-gray-400',
};

export default function HealthIndicator() {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        let mounted = true;

        const check = async () => {
            try {
                const result = await checkSystemHealth();
                if (mounted) setHealth(result);
            } catch {
                // silently fail
            }
        };

        check();
        const interval = setInterval(check, 60_000); // Re-check every 60s

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    if (!health) {
        return (
            <div className="flex items-center space-x-1.5" title="Checking services...">
                <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
                <span className="text-xs text-gray-500">Checking...</span>
            </div>
        );
    }

    const services = [health.rpc, health.lightning, health.cashuMint];

    return (
        <div className="relative">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center space-x-1.5 hover:opacity-80 transition-opacity"
                aria-label={`System status: ${health.overall}`}
                aria-expanded={isExpanded}
            >
                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[health.overall]}`} />
                <span className={`text-xs ${STATUS_TEXT_COLORS[health.overall]} capitalize`}>
                    {health.overall}
                </span>
            </button>

            {isExpanded && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-3">
                    <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">Service Health</h4>
                    <div className="space-y-2">
                        {services.map(svc => (
                            <div key={svc.name} className="flex items-center justify-between text-xs">
                                <div className="flex items-center space-x-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[svc.status]}`} />
                                    <span className="text-gray-300">{svc.name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {svc.latencyMs !== null && svc.status !== 'offline' && (
                                        <span className="text-gray-500">{svc.latencyMs}ms</span>
                                    )}
                                    <span className={`${STATUS_TEXT_COLORS[svc.status]} capitalize`}>
                                        {svc.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500">
                        Last checked: {new Date(health.rpc.lastChecked).toLocaleTimeString()}
                    </div>
                </div>
            )}
        </div>
    );
}
