'use client';

import React from 'react';
import { BellIcon, BellSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function NotificationSettings() {
    const { isSupported, permission, isEnabled, requestPermission, sendNotification } = usePushNotifications();

    if (!isSupported) {
        return (
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <BellSlashIcon className="w-4 h-4" />
                <span>Notifications not supported</span>
            </div>
        );
    }

    if (isEnabled) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                    <BellIcon className="w-4 h-4" />
                    <span>Notifications on</span>
                </div>
                <button
                    onClick={() => sendNotification('Test', { body: 'UmbraMix notifications are working.' })}
                    className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
                >
                    Test
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={requestPermission}
            disabled={permission === 'denied'}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-300 disabled:opacity-40"
            title={permission === 'denied' ? 'Notifications blocked. Enable in browser settings.' : 'Enable mix notifications'}
        >
            <BellIcon className="w-4 h-4" />
            <span>{permission === 'denied' ? 'Blocked' : 'Enable Notifications'}</span>
        </button>
    );
}
