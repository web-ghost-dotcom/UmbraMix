'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    HomeIcon,
    CubeTransparentIcon,
    ClockIcon,
    LockClosedIcon,
    CalendarDaysIcon,
    ShieldExclamationIcon,
    ArrowLeftOnRectangleIcon,
    QuestionMarkCircleIcon,
    DocumentTextIcon,
    ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';

const NAVIGATION_ITEMS = [
    { name: 'Overview', href: '/dashboard', icon: HomeIcon },
    { name: 'Privacy Mixer', href: '/dashboard/mixer', icon: CubeTransparentIcon },
    { name: 'Split Mix', href: '/dashboard/split', icon: ArrowsRightLeftIcon },
    { name: 'History', href: '/dashboard/history', icon: ClockIcon },
    { name: 'Token Vault', href: '/dashboard/vault', icon: LockClosedIcon },
    { name: 'Scheduled Mixes', href: '/dashboard/schedule', icon: CalendarDaysIcon },
    { name: 'Emergency', href: '/dashboard/emergency', icon: ShieldExclamationIcon },
];

const SECONDARY_ITEMS = [
    { name: 'Documentation', href: '/docs', icon: DocumentTextIcon },
    { name: 'Support', href: 'https://t.me/umbramix', icon: QuestionMarkCircleIcon, external: true },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#05060a] border-r border-white/5 flex flex-col z-50">
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-white/5">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/20 group-hover:scale-105 transition-transform duration-300">
                        <CubeTransparentIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-tight text-white group-hover:text-violet-200 transition-colors">
                        Umbra<span className="text-violet-400">Mix</span>
                    </span>
                </Link>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                <div className="mb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tools
                </div>
                {NAVIGATION_ITEMS.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${isActive
                                    ? 'bg-violet-500/10 text-violet-300'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-violet-500 rounded-r-full" />
                            )}
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-violet-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                            {item.name}
                        </Link>
                    );
                })}

                <div className="mt-8 mb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Resources
                </div>
                {SECONDARY_ITEMS.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 group"
                    >
                        <item.icon className="w-5 h-5 text-gray-500 group-hover:text-gray-300" />
                        {item.name}
                    </Link>
                ))}
            </nav>

            {/* Footer / User Profile Snippet */}
            <div className="p-4 border-t border-white/5 bg-black/20">
                <Link
                    href="/"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors w-full"
                >
                    <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                    Back to Home
                </Link>
            </div>
        </aside>
    );
}
