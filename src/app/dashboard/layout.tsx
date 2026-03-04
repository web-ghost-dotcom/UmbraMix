import React from 'react';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardLayoutClient>
            {children}
        </DashboardLayoutClient>
    );
}
