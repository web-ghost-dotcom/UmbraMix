import React from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface NotificationProps {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    isVisible: boolean;
    onClose: () => void;
    autoClose?: boolean;
    duration?: number;
}

export default function Notification({
    type,
    title,
    message,
    isVisible,
    onClose,
    autoClose = true,
    duration = 5000
}: NotificationProps) {
    React.useEffect(() => {
        if (isVisible && autoClose) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, autoClose, duration, onClose]);

    if (!isVisible) return null;

    const typeConfig = {
        success: {
            icon: CheckCircleIcon,
            bgColor: 'bg-green-500/10',
            borderColor: 'border-green-500/20',
            iconColor: 'text-green-400',
            titleColor: 'text-green-300'
        },
        error: {
            icon: XCircleIcon,
            bgColor: 'bg-red-500/10',
            borderColor: 'border-red-500/20',
            iconColor: 'text-red-400',
            titleColor: 'text-red-300'
        },
        warning: {
            icon: ExclamationTriangleIcon,
            bgColor: 'bg-yellow-500/10',
            borderColor: 'border-yellow-500/20',
            iconColor: 'text-yellow-400',
            titleColor: 'text-yellow-300'
        },
        info: {
            icon: InformationCircleIcon,
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/20',
            iconColor: 'text-blue-400',
            titleColor: 'text-blue-300'
        }
    };

    const config = typeConfig[type];
    const Icon = config.icon;

    return (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isVisible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-8 opacity-0 scale-95 pointer-events-none'}`}>
            <div
                className={`glass rounded-2xl p-4 shadow-2xl shadow-black/30 border ${config.borderColor}`}
            >
                <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className={`font-semibold text-sm ${config.titleColor}`}>{title}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{message}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors press-effect"
                    >
                        <XCircleIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
