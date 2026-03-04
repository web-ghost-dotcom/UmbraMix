'use client';

import React, { useState, useMemo } from 'react';
import {
    CalendarDaysIcon,
    PlusIcon,
    TrashIcon,
    PlayIcon,
    PauseIcon,
    ClockIcon,
    FireIcon,
} from '@heroicons/react/24/outline';
import { useScheduledMixes } from '@/hooks/useScheduledMixes';
import { useGasPrice } from '@/hooks/useGasPrice';

const FREQUENCY_LABELS: Record<string, string> = {
    once: 'One-time',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
};

function formatDateTime(ts: number) {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SchedulePage() {
    const { schedules, addSchedule, removeSchedule, toggleSchedule } = useScheduledMixes();
    const gas = useGasPrice(60_000);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        amountStrk: 10,
        destination: '',
        privacyLevel: 'standard' as 'standard' | 'enhanced' | 'maximum',
        frequency: 'once' as 'once' | 'daily' | 'weekly' | 'monthly',
        scheduledTime: '',
        maxExecutions: 1,
        gasCondition: '' as '' | 'low' | 'medium',
    });

    const handleAdd = () => {
        if (!form.destination || form.amountStrk <= 0) return;
        const nextRunAt = form.scheduledTime
            ? new Date(form.scheduledTime).getTime()
            : Date.now() + 60_000; // default: 1 min from now

        addSchedule({
            amountStrk: form.amountStrk,
            destination: form.destination,
            privacyLevel: form.privacyLevel,
            frequency: form.frequency,
            nextRunAt,
            enabled: true,
            maxExecutions: form.frequency === 'once' ? 1 : form.maxExecutions,
            gasCondition: form.gasCondition,
        });

        setForm({ amountStrk: 10, destination: '', privacyLevel: 'standard', frequency: 'once', scheduledTime: '', maxExecutions: 1, gasCondition: '' });
        setShowForm(false);
    };

    const activeCount = useMemo(() => schedules.filter(s => s.enabled).length, [schedules]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Scheduled Mixes</h1>
                    <p className="text-zinc-400">Automate recurring privacy transfers and dollar-cost averaging.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors text-sm font-bold text-white shadow-lg shadow-violet-600/20"
                >
                    <PlusIcon className="w-4 h-4" />
                    New Schedule
                </button>
            </div>

            {/* Gas Status Bar */}
            <div className="flex items-center gap-3 dashboard-card px-4 py-3 text-sm">
                <FireIcon className={`w-4 h-4 ${gas.level === 'low' ? 'text-emerald-400' : gas.level === 'medium' ? 'text-amber-400' : 'text-rose-400'}`} />
                <span className="text-zinc-400">Current gas:</span>
                <span className={`font-medium ${gas.level === 'low' ? 'text-emerald-400' : gas.level === 'medium' ? 'text-amber-400' : 'text-rose-400'}`}>
                    {gas.priceStrk} STRK ({gas.level})
                </span>
                <span className="text-zinc-500 ml-auto text-xs">{activeCount} active schedule{activeCount !== 1 ? 's' : ''}</span>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="dashboard-card p-6 animate-fade-in-scale border-violet-500/20">
                    <h3 className="font-bold text-white mb-6">Create Schedule</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Amount (STRK)</label>
                                <input
                                    type="number"
                                    value={form.amountStrk}
                                    onChange={(e) => setForm(f => ({ ...f, amountStrk: Number(e.target.value) }))}
                                    min={1}
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Destination Address</label>
                                <input
                                    type="text"
                                    value={form.destination}
                                    onChange={(e) => setForm(f => ({ ...f, destination: e.target.value }))}
                                    placeholder="0x..."
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 font-mono transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Frequency</label>
                                <select
                                    value={form.frequency}
                                    onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value as typeof f.frequency }))}
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 transition-all"
                                >
                                    <option value="once">One-time</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Privacy Level</label>
                                <select
                                    value={form.privacyLevel}
                                    onChange={(e) => setForm(f => ({ ...f, privacyLevel: e.target.value as typeof f.privacyLevel }))}
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 transition-all"
                                >
                                    <option value="standard">Standard</option>
                                    <option value="enhanced">Enhanced</option>
                                    <option value="maximum">Maximum</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Run Time</label>
                                <input
                                    type="datetime-local"
                                    value={form.scheduledTime}
                                    onChange={(e) => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Gas Optimization</label>
                                <select
                                    value={form.gasCondition}
                                    onChange={(e) => setForm(f => ({ ...f, gasCondition: e.target.value as typeof f.gasCondition }))}
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 transition-all"
                                >
                                    <option value="">Run Immediately (Ignore Gas)</option>
                                    <option value="low">Only when gas is Low</option>
                                    <option value="medium">When gas is Low or Medium</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/5">
                        <button
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!form.destination || form.amountStrk <= 0}
                            className="px-6 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-600/20"
                        >
                            Create Schedule
                        </button>
                    </div>
                </div>
            )}

            {/* Schedule List */}
            {schedules.length === 0 ? (
                <div className="text-center py-20 dashboard-card flex flex-col items-center justify-center">
                    <CalendarDaysIcon className="w-16 h-16 text-zinc-700 mb-4" />
                    <h3 className="text-lg font-bold text-zinc-300">No Scheduled Mixes</h3>
                    <p className="text-zinc-500 max-w-sm mt-2 mb-6">
                        Create a schedule to automate your privacy. Great for salary distribution or recurring payments.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                    >
                        Create First Schedule
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {schedules.map((s, idx) => (
                        <div key={s.id} className={`dashboard-card p-5 transition-all hover:border-violet-500/30 group animate-stagger-in ${!s.enabled ? 'opacity-60 grayscale' : ''}`} style={{ animationDelay: `${Math.min(idx * 60, 300)}ms` }}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.enabled ? 'bg-violet-500/10' : 'bg-zinc-800'}`}>
                                        <CalendarDaysIcon className={`w-5 h-5 ${s.enabled ? 'text-violet-400' : 'text-zinc-500'}`} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white flex items-center gap-2">
                                            {s.amountStrk} STRK
                                            <span className="text-xs font-normal text-zinc-500 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                                                {FREQUENCY_LABELS[s.frequency as string]}
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-500 font-mono mt-0.5">
                                            {s.destination.slice(0, 10)}...{s.destination.slice(-6)}
                                        </div>
                                    </div>
                                </div>
                                <div className={`text-xs font-medium px-2 py-1 rounded-md border ${s.enabled
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                                    }`}>
                                    {s.enabled ? 'Active' : 'Paused'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 bg-black/20 rounded-lg p-3 mb-4">
                                <div>
                                    <span className="text-zinc-600 block mb-0.5">Next Run</span>
                                    <span className="text-white flex items-center gap-1">
                                        <ClockIcon className="w-3 h-3" />
                                        {formatDateTime(s.nextRunAt)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-zinc-600 block mb-0.5">Executions</span>
                                    <span className="text-white">
                                        {s.executionCount}
                                        {s.maxExecutions > 0 && <span className="text-zinc-500"> / {s.maxExecutions}</span>}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-zinc-600 block mb-0.5">Privacy</span>
                                    <span className="capitalize text-white">{s.privacyLevel}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-600 block mb-0.5">Gas Limit</span>
                                    <span className="capitalize text-white">{s.gasCondition || 'None'}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => toggleSchedule(s.id)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300 transition-colors"
                                >
                                    {s.enabled ? (
                                        <>
                                            <PauseIcon className="w-3.5 h-3.5" /> Pause
                                        </>
                                    ) : (
                                        <>
                                            <PlayIcon className="w-3.5 h-3.5" /> Resume
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => removeSchedule(s.id)}
                                    className="w-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
