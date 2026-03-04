'use client';

import React, { useState, useCallback, useEffect } from 'react'; // Added useEffect
import {
    ShieldExclamationIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { useWallet } from '@/context/WalletProvider';
import { PRIVACY_MIXER } from '@/config/constants';
import { getStarknetRpc } from '@/config/env';
import { Contract, RpcProvider } from 'starknet';
import mixerAbi from '@/config/privacy-mixer-abi.json';

type WithdrawStatus = 'idle' | 'checking' | 'withdrawing' | 'success' | 'error';

interface ContractInfo {
    isPaused: boolean;
    totalDeposits: string;
    totalWithdrawals: string;
    anonymitySetSize: string;
    owner: string;
}

export default function EmergencyPage() {
    const wallet = useWallet();
    const [status, setStatus] = useState<WithdrawStatus>('idle');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [txHash, setTxHash] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
    const [isLoadingInfo, setIsLoadingInfo] = useState(false);

    const fetchContractInfo = useCallback(async () => {
        setIsLoadingInfo(true);
        try {
            const provider = new RpcProvider({ nodeUrl: getStarknetRpc() });
            const contract = new Contract(mixerAbi, PRIVACY_MIXER.CONTRACT_ADDRESS, provider);

            const [isPaused, stats, owner] = await Promise.all([
                contract.is_paused().catch(() => false),
                contract.get_mixing_stats().catch(() => null),
                contract.get_owner().catch(() => '0x0'),
            ]);

            setContractInfo({
                isPaused: Boolean(isPaused),
                totalDeposits: stats ? (BigInt(stats.total_deposits?.toString?.() ?? stats.total_deposits ?? 0) / BigInt(10 ** 18)).toString() : '0',
                totalWithdrawals: stats ? (BigInt(stats.total_withdrawals?.toString?.() ?? stats.total_withdrawals ?? 0) / BigInt(10 ** 18)).toString() : '0',
                anonymitySetSize: stats ? (stats.anonymity_set_size?.toString?.() ?? stats.anonymity_set_size?.toString() ?? '0') : '0',
                owner: typeof owner === 'string' ? owner : '0x' + BigInt(owner).toString(16),
            });
        } catch (e) {
            console.error('Failed to fetch contract info:', e);
        } finally {
            setIsLoadingInfo(false);
        }
    }, []);

    // Fetch on mount
    useEffect(() => {
        fetchContractInfo();
    }, [fetchContractInfo]);

    const handleEmergencyWithdraw = useCallback(async () => {
        if (!wallet.isConnected) {
            setErrorMessage('Please connect your wallet first.');
            setStatus('error');
            return;
        }

        const recipient = recipientAddress.trim() || wallet.address;
        if (!recipient) {
            setErrorMessage('No recipient address specified.');
            setStatus('error');
            return;
        }

        setStatus('withdrawing');
        setErrorMessage('');
        setTxHash('');

        try {
            if (!wallet.client) {
                throw new Error('Wallet client not available');
            }
            const result = await wallet.client.sendTransaction([{
                contractAddress: PRIVACY_MIXER.CONTRACT_ADDRESS,
                entrypoint: 'emergency_withdraw',
                calldata: [recipient],
            }]);

            const hash = result?.transactionHash ?? '';
            setTxHash(hash);

            setStatus('success');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setErrorMessage(msg.includes('not owner') || msg.includes('Ownable')
                ? 'Only the contract owner can perform emergency withdrawals.'
                : msg.includes('paused')
                    ? 'Contract is paused. Emergency withdraw may not be available right now.'
                    : `Emergency withdrawal failed: ${msg}`
            );
            setStatus('error');
        }
    }, [wallet, recipientAddress]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <ShieldExclamationIcon className="w-8 h-8 text-rose-500" />
                    Emergency Recovery
                </h1>
                <p className="text-zinc-400">Direct contract interaction for fund recovery in extreme situations.</p>
            </div>

            {/* Warning Banner */}
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 mb-8" role="alert">
                <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h2 className="font-bold text-rose-400 text-sm mb-1 uppercase tracking-wider">Use Only in Emergencies</h2>
                        <p className="text-rose-200/80 text-sm leading-relaxed">
                            This function attempts to withdraw funds directly from the privacy mixer contract.
                            It should only be used if the normal withdrawal process is permanently stuck or the frontend is compromised.
                            <br /><br />
                            <strong>Warning:</strong> This may compromise privacy if not used carefully.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Contract Status Card */}
                <div className="dashboard-card p-6 h-full">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white">Contract Status</h3>
                        <button
                            onClick={fetchContractInfo}
                            disabled={isLoadingInfo}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs font-medium text-zinc-300"
                        >
                            <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoadingInfo ? 'animate-spin' : ''}`} />
                            {isLoadingInfo ? 'Loading...' : 'Refresh State'}
                        </button>
                    </div>

                    {contractInfo ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-sm text-zinc-400">Operational Status</span>
                                <span className={`text-sm font-bold ${contractInfo.isPaused ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {contractInfo.isPaused ? '⏸ PAUSED' : '▶ ACTIVE'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                    <div className="text-xs text-zinc-500 uppercase mb-1">Total Deposits</div>
                                    <div className="text-lg font-mono text-violet-400">{contractInfo.totalDeposits} STRK</div>
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                    <div className="text-xs text-zinc-500 uppercase mb-1">Withdrawals</div>
                                    <div className="text-lg font-mono text-emerald-400">{contractInfo.totalWithdrawals} STRK</div>
                                </div>
                            </div>

                            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="text-xs text-zinc-500 uppercase mb-1">Anonymity Set Size</div>
                                <div className="text-lg font-mono text-white">{contractInfo.anonymitySetSize}</div>
                            </div>

                            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="text-xs text-zinc-500 uppercase mb-1">Contract Owner</div>
                                <div className="font-mono text-xs text-zinc-400 break-all">{contractInfo.owner}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-48 flex flex-col items-center justify-center text-zinc-500">
                            <ArrowPathIcon className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-sm">Click &quot;Refresh State&quot; to load contract info.</p>
                        </div>
                    )}
                </div>

                {/* Emergency Withdraw Form */}
                <div className="dashboard-card p-6 h-full border-rose-500/10">
                    <h3 className="font-bold text-white mb-6">Exec Emergency Withdraw</h3>

                    {/* Wallet Status */}
                    <div className="mb-6">
                        {wallet.isConnected ? (
                            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                                <CheckCircleIcon className="w-5 h-5" />
                                <span>Connected: <span className="font-mono font-bold text-emerald-300">{wallet.address?.slice(0, 10)}...</span></span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                                <ExclamationTriangleIcon className="w-5 h-5" />
                                <span>Wallet not connected</span>
                            </div>
                        )}
                    </div>

                    {/* Recipient Input */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                            Recipient Address (for recovered funds)
                        </label>
                        <input
                            type="text"
                            value={recipientAddress}
                            onChange={(e) => setRecipientAddress(e.target.value)}
                            placeholder={wallet.address || "0x..."}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-rose-500/50 transition-all font-mono"
                        />
                        <p className="text-xs text-zinc-600 mt-2">
                            Leave blank to send to connected wallet.
                        </p>
                    </div>

                    {errorMessage && (
                        <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400 flex gap-2">
                            <XCircleIcon className="w-5 h-5 flex-shrink-0" />
                            {errorMessage}
                        </div>
                    )}

                    {txHash && (
                        <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400 break-all">
                            <p className="font-bold mb-1">Success! Transaction Hash:</p>
                            {txHash}
                        </div>
                    )}

                    <button
                        onClick={handleEmergencyWithdraw}
                        disabled={!wallet.isConnected || status === 'withdrawing'}
                        className="w-full py-4 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-rose-600/20"
                    >
                        {status === 'withdrawing' ? 'Processing...' : 'Execute Emergency Withdraw'}
                    </button>
                </div>
            </div>
        </div>
    );
}
