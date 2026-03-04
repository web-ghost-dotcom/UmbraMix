'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
    HomeIcon,
    ExclamationTriangleIcon,
    ShieldExclamationIcon,
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
    const [withdrawnAmount, setWithdrawnAmount] = useState('');

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

    const handleEmergencyWithdraw = useCallback(async () => {
        if (!wallet.isConnected || !wallet.client) {
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
            // Use wallet client's sendTransaction to execute the contract call
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
        <div className="min-h-screen text-white">
            <div className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8 animate-fade-in-up">
                    <Link href="/mixer" className="flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle hover:bg-white/10 transition-colors text-sm press-effect">
                        <HomeIcon className="w-4 h-4" />
                        <span>Mixer</span>
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                            <ShieldExclamationIcon className="w-5 h-5 text-red-400" />
                        </div>
                        <span className="bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent">Emergency Recovery</span>
                    </h1>
                </div>

                {/* Warning Banner */}
                <div className="glass-subtle rounded-2xl p-5 mb-8 border border-red-500/20 animate-fade-in-up" style={{ animationDelay: '100ms' }} role="alert">
                    <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h2 className="font-semibold text-red-300 mb-1">Use Only in Emergencies</h2>
                            <p className="text-red-200/60 text-sm">
                                This function withdraws stuck deposits directly from the privacy mixer contract.
                                It should only be used when funds are stuck in the contract and normal mixing/withdrawal
                                has failed. Only the contract owner can execute this operation.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contract Status Card */}
                <div className="glass rounded-2xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-200">Contract Status</h3>
                        <button onClick={fetchContractInfo} disabled={isLoadingInfo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subtle hover:bg-white/10 transition-colors text-xs text-gray-300 press-effect">
                            <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoadingInfo ? 'animate-spin' : ''}`} />
                            {isLoadingInfo ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>

                    {contractInfo ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="glass-subtle rounded-xl p-3">
                                <div className="text-gray-500 text-xs mb-1">Status</div>
                                <div className={`font-medium ${contractInfo.isPaused ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {contractInfo.isPaused ? '⏸ Paused' : '▶ Active'}
                                </div>
                            </div>
                            <div className="glass-subtle rounded-xl p-3">
                                <div className="text-gray-500 text-xs mb-1">Anonymity Set</div>
                                <div className="font-medium text-blue-400">{contractInfo.anonymitySetSize}</div>
                            </div>
                            <div className="glass-subtle rounded-xl p-3">
                                <div className="text-gray-500 text-xs mb-1">Total Deposits</div>
                                <div className="font-medium text-violet-400">{contractInfo.totalDeposits} STRK</div>
                            </div>
                            <div className="glass-subtle rounded-xl p-3">
                                <div className="text-gray-500 text-xs mb-1">Total Withdrawals</div>
                                <div className="font-medium text-emerald-400">{contractInfo.totalWithdrawals} STRK</div>
                            </div>
                            <div className="col-span-2 glass-subtle rounded-xl p-3">
                                <div className="text-gray-500 text-xs mb-1">Contract Owner</div>
                                <div className="font-mono text-xs text-gray-400 break-all">{contractInfo.owner}</div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-600 text-sm">Click &quot;Refresh&quot; to load contract state.</p>
                    )}
                </div>

                {/* Emergency Withdraw Form */}
                <div className="glass rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                    <h3 className="font-semibold text-gray-200 mb-4">Emergency Withdrawal</h3>

                    {/* Wallet Status */}
                    <div className="mb-4">
                        {wallet.isConnected ? (
                            <div className="flex items-center gap-2 text-sm text-emerald-400">
                                <CheckCircleIcon className="w-4 h-4" />
                                <span>Wallet connected: <span className="font-mono text-xs">{wallet.address?.slice(0, 10)}...{wallet.address?.slice(-6)}</span></span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-yellow-400">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                <span>Connect your wallet to proceed</span>
                            </div>
                        )}
                    </div>

                    {/* Recipient Input */}
                    <div className="mb-5">
                        <label htmlFor="emergency-recipient" className="block text-sm text-gray-400 mb-2">
                            Recipient Address <span className="text-gray-600">(defaults to your wallet)</span>
                        </label>
                        <input
                            id="emergency-recipient"
                            type="text"
                            value={recipientAddress}
                            onChange={(e) => setRecipientAddress(e.target.value)}
                            placeholder={wallet.address || '0x...'}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 font-mono text-sm transition-all"
                        />
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleEmergencyWithdraw}
                        disabled={!wallet.isConnected || status === 'withdrawing'}
                        className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-2 press-effect shadow-lg shadow-red-600/20"
                    >
                        {status === 'withdrawing' ? (
                            <>
                                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                Processing Emergency Withdrawal...
                            </>
                        ) : (
                            <>
                                <ShieldExclamationIcon className="w-5 h-5" />
                                Execute Emergency Withdrawal
                            </>
                        )}
                    </button>

                    {/* Result Messages */}
                    {status === 'success' && (
                        <div className="mt-4 glass-subtle rounded-xl p-4 border border-emerald-500/20 animate-fade-in-scale">
                            <div className="flex items-center gap-2 text-emerald-400 font-medium mb-2">
                                <CheckCircleIcon className="w-5 h-5" />
                                Emergency Withdrawal Successful
                            </div>
                            {withdrawnAmount && <p className="text-sm text-emerald-300/70 mb-1">Amount: {withdrawnAmount} STRK</p>}
                            {txHash && (
                                <div className="text-sm">
                                    <span className="text-gray-500">Tx: </span>
                                    <a href={`https://starkscan.co/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-mono text-xs break-all transition-colors">
                                        {txHash}
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="mt-4 glass-subtle rounded-xl p-4 border border-red-500/20 animate-fade-in-scale">
                            <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
                                <XCircleIcon className="w-5 h-5" />
                                Withdrawal Failed
                            </div>
                            <p className="text-sm text-red-300/70">{errorMessage}</p>
                        </div>
                    )}
                </div>

                {/* Info Footer */}
                <div className="mt-6 text-xs text-gray-600 text-center space-y-1">
                    <p>Contract: <span className="font-mono">{PRIVACY_MIXER.CONTRACT_ADDRESS.slice(0, 14)}...{PRIVACY_MIXER.CONTRACT_ADDRESS.slice(-8)}</span></p>
                    <p>Emergency withdrawal sends all stuck funds in the contract to the specified recipient.</p>
                </div>
            </div>
        </div>
    );
}
