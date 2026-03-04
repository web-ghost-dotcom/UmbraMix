'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PushNotificationState {
    isSupported: boolean;
    permission: NotificationPermission | 'unsupported';
    isEnabled: boolean;
    requestPermission: () => Promise<boolean>;
    sendNotification: (title: string, options?: NotificationOptions) => void;
}

export function usePushNotifications(): PushNotificationState {
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

    const isSupported = typeof window !== 'undefined' && 'Notification' in window;

    useEffect(() => {
        if (isSupported) {
            setPermission(Notification.permission);
        }
    }, [isSupported]);

    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false;

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result === 'granted';
        } catch {
            return false;
        }
    }, [isSupported]);

    const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
        if (!isSupported || Notification.permission !== 'granted') return;

        try {
            const notification = new Notification(title, {
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: 'umbramix-notification',
                ...options,
            });

            // Auto-close after 8 seconds
            setTimeout(() => notification.close(), 8_000);

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (e) {
            console.warn('Failed to send notification:', e);
        }
    }, [isSupported]);

    return {
        isSupported,
        permission,
        isEnabled: permission === 'granted',
        requestPermission,
        sendNotification,
    };
}

/**
 * Predefined notification helpers for mixer events
 */
export function createMixNotifications(send: (title: string, options?: NotificationOptions) => void) {
    return {
        mixStarted: (amount: string) =>
            send('🔄 Mix Started', { body: `Privacy mix for ${amount} STRK has begun.` }),
        mixComplete: (amount: string) =>
            send('✅ Mix Complete!', { body: `${amount} STRK has been privately mixed and delivered.` }),
        mixFailed: (reason: string) =>
            send('❌ Mix Failed', { body: `Your mix encountered an error: ${reason}` }),
        depositConfirmed: (amount: string) =>
            send('💰 Deposit Confirmed', { body: `${amount} STRK deposit confirmed on-chain.` }),
        withdrawalComplete: (amount: string) =>
            send('📤 Withdrawal Complete', { body: `${amount} STRK has been sent to your destination.` }),
        sessionRecovery: (count: number) =>
            send('⚠️ Incomplete Sessions', { body: `${count} incomplete mixing session(s) found. Please check the mixer.` }),
    };
}
