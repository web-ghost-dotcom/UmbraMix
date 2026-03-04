'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    HomeIcon,
    EyeSlashIcon,
    DocumentTextIcon,
    Bars3Icon,
    XMarkIcon,
    ClockIcon,
    LockClosedIcon,
    CalendarDaysIcon,
    ShieldExclamationIcon,
    BeakerIcon,
} from '@heroicons/react/24/outline';
import HealthIndicator from './HealthIndicator';
import GasMonitor from './GasMonitor';
import NotificationSettings from './NotificationSettings';

const navItems = [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/mixer', label: 'Mixer', icon: BeakerIcon },
    { href: '/history', label: 'History', icon: ClockIcon },
    { href: '/vault', label: 'Vault', icon: LockClosedIcon },
    { href: '/schedule', label: 'Schedule', icon: CalendarDaysIcon },
    { href: '/docs', label: 'Docs', icon: DocumentTextIcon },
];

export default function Navigation() {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => { setIsOpen(false); }, [pathname]);

    return (
        <>
            <nav
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
                        ? 'glass py-2 shadow-lg shadow-black/20'
                        : 'bg-transparent py-4'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow duration-300">
                                <EyeSlashIcon className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-lg font-bold tracking-tight text-white">
                                Umbra<span className="text-violet-400">Mix</span>
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'text-white bg-white/10'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {item.label}
                                        {isActive && (
                                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-violet-500 rounded-full" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Desktop Utility Bar */}
                        <div className="hidden md:flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                                <GasMonitor />
                            </div>
                            <HealthIndicator />
                            <NotificationSettings />
                            <Link
                                href="/emergency"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/80 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 transition-all duration-200"
                            >
                                <ShieldExclamationIcon className="w-3.5 h-3.5" />
                                Emergency
                            </Link>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
                            aria-expanded={isOpen}
                        >
                            {isOpen ? (
                                <XMarkIcon className="w-6 h-6" />
                            ) : (
                                <Bars3Icon className="w-6 h-6" />
                            )}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={() => setIsOpen(false)}
            />

            {/* Mobile Drawer */}
            <div
                className={`fixed top-0 right-0 h-full w-72 z-50 md:hidden glass shadow-2xl shadow-black/50 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full p-5">
                    {/* Close button */}
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Mobile Nav Items */}
                    <div className="flex flex-col gap-1">
                        {navItems.map((item, idx) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isOpen ? 'animate-fade-in-up' : ''
                                        } ${isActive
                                            ? 'text-white bg-violet-500/15 border border-violet-500/20'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                    onClick={() => setIsOpen(false)}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-violet-400' : ''}`} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Mobile Utility Items */}
                    <div className="mt-auto pt-6 border-t border-white/10 space-y-3">
                        <div className="flex items-center gap-3 px-4 py-2">
                            <GasMonitor />
                        </div>
                        <div className="flex items-center gap-4 px-4 py-2">
                            <HealthIndicator />
                            <NotificationSettings />
                        </div>
                        <Link
                            href="/emergency"
                            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20"
                            onClick={() => setIsOpen(false)}
                        >
                            <ShieldExclamationIcon className="w-5 h-5" />
                            Emergency Recovery
                        </Link>
                    </div>
                </div>
            </div>

            {/* Spacer for fixed nav */}
            <div className="h-16" />
        </>
    );
}
