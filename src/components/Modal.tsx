import React, { useEffect, useRef, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };

    // Handle Escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
        // Focus trap: Tab and Shift+Tab
        if (e.key === 'Tab' && modalRef.current) {
            const focusableEls = modalRef.current.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableEls.length === 0) return;
            const first = focusableEls[0];
            const last = focusableEls[focusableEls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            document.addEventListener('keydown', handleKeyDown);
            // Focus the modal on open
            setTimeout(() => modalRef.current?.focus(), 0);
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
            // Restore focus
            previousFocusRef.current?.focus();
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 transition-opacity"
                    onClick={onClose}
                    aria-hidden="true"
                />

                {/* Modal */}
                <div
                    ref={modalRef}
                    tabIndex={-1}
                    className={`relative w-full ${sizeClasses[size]} transform overflow-hidden rounded-lg bg-gray-900 border border-gray-700 shadow-xl transition-all`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-700">
                        <h3 id="modal-title" className="text-lg font-semibold text-white">{title}</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                            aria-label="Close dialog"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
