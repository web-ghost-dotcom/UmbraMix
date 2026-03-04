'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    HomeIcon,
    CalendarDaysIcon,
    PlusIcon,
    TrashIcon,
    PlayIcon,
    PauseIcon,
    ClockIcon,
    FireIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useScheduledMixes, ScheduledMix } from '@/hooks/useScheduledMixes';
import { useGasPrice } from '@/hooks/useGasPrice';

const FREQUENCY_LABELS: Record<ScheduledMix['frequency'], string> = {
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
        privacyLevel: 'standard' as ScheduledMix['privacyLevel'],
        frequency: 'once' as ScheduledMix['frequency'],
        scheduledTime: '',
        maxExecutions: 1,
        gasCondition: '' as ScheduledMix['gasCondition'],
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
        <div className="min-h-screen text-white">
            <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 animate-fade-in-up">
                    <div className="flex items-center gap-4">
                        <Link href="/mixer" className="flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle hover:bg-white/10 transition-colors text-sm press-effect">
                            <HomeIcon className="w-4 h-4" />
                            <span>Mixer</span>
                        </Link>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
                                <CalendarDaysIcon className="w-5 h-5 text-purple-400" />
                            </div>
                            <span className="text-gradient">Scheduled Mixes</span>
                        </h1>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors text-sm font-medium press-effect shadow-lg shadow-violet-600/20">
                        <PlusIcon className="w-4 h-4" />
                        New Schedule
                    </button>
                </div>

                {/* Gas Status Bar */}
                <div className="flex items-center gap-3 glass-subtle rounded-2xl px-4 py-3 mb-6 text-sm animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    <FireIcon className={`w-4 h-4 ${gas.level === 'low' ? 'text-emerald-400' : gas.level === 'medium' ? 'text-yellow-400' : 'text-red-400'}`} />
                    <span className="text-gray-500">Current gas:</span>
                    <span className={`font-medium ${gas.level === 'low' ? 'text-emerald-400' : gas.level === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>
                        {gas.priceStrk} STRK ({gas.level})
                    </span>
                    <span className="text-gray-600 ml-auto text-xs">{activeCount} active schedule{activeCount !== 1 ? 's' : ''}</span>
                </div>

                {/* Create Form */}
                {showForm && (
                    <div className="glass rounded-2xl p-6 mb-6 animate-fade-in-scale">
                        <h3 className="font-semibold text-gray-200 mb-4">Create Scheduled Mix</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Amount (STRK)</label>
                                <input type="number" value={form.amountStrk} onChange={(e) => setForm(f => ({ ...f, amountStrk: Number(e.target.value) }))} min={1} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Destination Address</label>
                                <input type="text" value={form.destination} onChange={(e) => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="0x..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 font-mono transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Frequency</label>
                                <select value={form.frequency} onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value as ScheduledMix['frequency'] }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all">
                                    <option value="once">One-time</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Privacy Level</label>
                                <select value={form.privacyLevel} onChange={(e) => setForm(f => ({ ...f, privacyLevel: e.target.value as ScheduledMix['privacyLevel'] }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all">
                                    <option value="standard">Standard</option>
                                    <option value="enhanced">Enhanced</option>
                                    <option value="maximum">Maximum</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Schedule Time</label>
                                <input type="datetime-local" value={form.scheduledTime} onChange={(e) => setForm(f => ({ ...f, scheduledTime: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Gas Condition</label>
                                <select value={form.gasCondition} onChange={(e) => setForm(f => ({ ...f, gasCondition: e.target.value as ScheduledMix['gasCondition'] }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all">
                                    <option value="">No condition (always)</option>
                                    <option value="low">Only when gas is low</option>
                                    <option value="medium">When gas is low or medium</option>
                                </select>
                            </div>
                            {form.frequency !== 'once' && (
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1.5">Max Executions (0 = unlimited)</label>
                                    <input type="number" value={form.maxExecutions} onChange={(e) => setForm(f => ({ ...f, maxExecutions: Number(e.target.value) }))} min={0} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button onClick={handleAdd} disabled={!form.destination || form.amountStrk <= 0} className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-40 transition-colors press-effect shadow-lg shadow-violet-600/20">
                                Create Schedule
                            </button>
                            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl glass-subtle hover:bg-white/10 text-gray-300 text-sm transition-colors press-effect">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Schedule List */}
                {schedules.length === 0 ? (
                    <div className="text-center py-16 glass rounded-2xl animate-fade-in-scale">
                        <CalendarDaysIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 mb-1">No scheduled mixes</p>
                        <p className="text-gray-500 text-sm">Create a schedule for recurring DCA-style private transfers.</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {schedules.map((s, idx) => (
                            <div key={s.id} className={`glass-subtle rounded-2xl p-4 transition-all hover:bg-white/[0.06] animate-stagger-in ${!s.enabled ? 'opacity-50' : ''}`} style={{ animationDelay: `${Math.min(idx * 60, 300)}ms` }}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-white">{s.amountStrk} STRK</span>
                                            <span className="text-xs px-2 py-0.5 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/20">
                                                {FREQUENCY_LABELS[s.frequency]}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-lg ${s.enabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                                                {s.enabled ? 'Active' : 'Paused'}
                                            </span>
                                            {s.gasCondition && (
                                                <span className="text-xs px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                    <FireIcon className="w-3 h-3 inline mr-0.5" />Gas: {s.gasCondition}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            <span className="font-mono">{s.destination.slice(0, 12)}...{s.destination.slice(-6)}</span>
                                            {' • '}{s.privacyLevel} privacy
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" /> Next: {formatDateTime(s.nextRunAt)}</span>
                                            <span>Runs: {s.executionCount}{s.maxExecutions > 0 ? `/${s.maxExecutions}` : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => toggleSchedule(s.id)} className="p-2 rounded-xl glass-subtle hover:bg-white/10 transition-colors press-effect" title={s.enabled ? 'Pause' : 'Resume'}>
                                            {s.enabled ? <PauseIcon className="w-4 h-4 text-yellow-400" /> : <PlayIcon className="w-4 h-4 text-emerald-400" />}
                                        </button>
                                        <button onClick={() => removeSchedule(s.id)} className="p-2 rounded-xl glass-subtle hover:bg-red-500/10 transition-colors press-effect" title="Delete">
                                            <TrashIcon className="w-4 h-4 text-gray-500 hover:text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Info */}
                <div className="mt-6 glass-subtle rounded-2xl p-4 text-sm border border-yellow-500/10">
                    <div className="flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-yellow-300/70">
                            Scheduled mixes require the app to be open in your browser at the scheduled time.
                            The app checks for due schedules every minute. For recurring mixes, ensure your
                            wallet stays connected and has sufficient STRK balance.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
