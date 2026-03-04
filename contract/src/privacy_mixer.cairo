//! # Starknet Lightning Privacy Mixer Contract
//!
//! This contract manages the privacy mixing operations for the
//! STRK→Lightning→Cashu→Lightning→STRK pipeline.
//! It tracks deposits, withdrawals, nullifiers to prevent double-spending, and provides privacy
//! guarantees through commitment schemes and zero-knowledge proofs.

use core::array::ArrayTrait;
use core::option::OptionTrait;
use core::traits::Into;
use starknet::ContractAddress;

// STRK Token Interface
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn symbol(self: @TContractState) -> felt252;
    fn name(self: @TContractState) -> felt252;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
}

#[starknet::interface]
pub trait IPrivacyMixer<TContractState> {
    // Deposit operations
    fn deposit(ref self: TContractState, commitment: felt252, amount: u256) -> felt252;
    fn batch_deposit(
        ref self: TContractState, commitments: Array<felt252>, amounts: Array<u256>,
    ) -> Array<felt252>;

    // Withdrawal operations
    fn withdraw(
        ref self: TContractState,
        nullifier: felt252,
        commitment: felt252,
        recipient: ContractAddress,
        amount: u256,
        proof: Array<felt252>,
    ) -> bool;

    // Privacy pool management
    fn get_anonymity_set_size(self: @TContractState) -> u256;
    fn get_total_deposits(self: @TContractState) -> u256;
    fn get_total_withdrawals(self: @TContractState) -> u256;
    fn get_min_delay(self: @TContractState) -> u64;
    fn get_min_anonymity_set(self: @TContractState) -> u256;

    // Nullifier tracking (prevent double-spending)
    fn is_nullifier_used(self: @TContractState, nullifier: felt252) -> bool;
    fn is_commitment_valid(self: @TContractState, commitment: felt252) -> bool;

    // Multi-account support
    fn register_account(
        ref self: TContractState, account_type: felt252, metadata: felt252,
    ) -> felt252;
    fn get_account_balance(self: @TContractState, account_id: felt252) -> u256;
    fn transfer_between_accounts(
        ref self: TContractState, from: felt252, to: felt252, amount: u256,
    ) -> bool;

    // Emergency and admin functions
    fn emergency_pause(ref self: TContractState);
    fn emergency_unpause(ref self: TContractState);
    fn emergency_withdraw(ref self: TContractState, recipient: ContractAddress) -> u256;
    fn is_paused(self: @TContractState) -> bool;

    // Admin configuration functions
    fn set_min_delay(ref self: TContractState, new_delay: u64);
    fn set_min_anonymity(ref self: TContractState, new_min_anonymity: u256);
    fn set_fee_rate(ref self: TContractState, new_fee_rate: u256);
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn get_strk_token(self: @TContractState) -> ContractAddress;

    // Compliance and audit
    fn get_mixing_stats(self: @TContractState) -> MixingStats;
    fn verify_privacy_guarantees(self: @TContractState) -> PrivacyMetrics;
}

#[derive(Drop, Serde, starknet::Store)]
pub struct MixingStats {
    pub total_deposits: u256,
    pub total_withdrawals: u256,
    pub active_commitments: u256,
    pub anonymity_set_size: u256,
    pub mixing_efficiency: u256,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct PrivacyMetrics {
    pub min_anonymity_set: u256,
    pub avg_mixing_time: u256,
    pub unlinkability_score: u256,
    pub temporal_privacy_score: u256,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Commitment {
    pub hash: felt252,
    pub amount: u256,
    pub timestamp: u64,
    pub block_number: u64,
    pub depositor: ContractAddress,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Account {
    pub owner: ContractAddress,
    pub account_type: felt252, // 0: Standard, 1: Privacy Enhanced, 2: Multi-sig
    pub balance: u256,
    pub metadata: felt252,
    pub created_at: u64,
    pub last_activity: u64,
}

#[starknet::contract]
mod PrivacyMixer {
    use core::array::ArrayTrait;
    use core::hash::{HashStateExTrait, HashStateTrait};
    use core::option::OptionTrait;
    use core::pedersen::PedersenTrait;
    use core::poseidon::PoseidonTrait;
    use core::traits::Into;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        ContractAddress, contract_address_const, get_block_number, get_block_timestamp,
        get_caller_address, get_contract_address,
    };
    use super::{
        Account, Commitment, IERC20Dispatcher, IERC20DispatcherTrait, IPrivacyMixer, MixingStats,
        PrivacyMetrics,
    };

    #[storage]
    struct Storage {
        // Core privacy mixer state
        commitments: LegacyMap<felt252, Commitment>,
        nullifiers: LegacyMap<felt252, bool>,
        commitment_exists: LegacyMap<felt252, bool>,
        // Multi-account support
        accounts: LegacyMap<felt252, Account>,
        account_counter: felt252,
        user_accounts: LegacyMap<ContractAddress, Array<felt252>>,
        // Privacy metrics
        total_deposits: u256,
        total_withdrawals: u256,
        anonymity_set_size: u256,
        // Admin and emergency controls
        owner: ContractAddress,
        paused: bool,
        // STRK Token contract
        strk_token: ContractAddress,
        // Privacy parameters
        min_deposit_amount: u256,
        max_deposit_amount: u256,
        mixing_fee_rate: u256, // Basis points (100 = 1%)
        min_anonymity_set: u256,
        // Temporal privacy
        min_mixing_delay: u64,
        deposit_timestamps: LegacyMap<felt252, u64>,
        // Events for privacy analysis
        deposit_count: u256,
        withdrawal_count: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Deposit: Deposit,
        Withdrawal: Withdrawal,
        AccountRegistered: AccountRegistered,
        AccountTransfer: AccountTransfer,
        EmergencyPause: EmergencyPause,
        EmergencyUnpause: EmergencyUnpause,
        EmergencyWithdraw: EmergencyWithdraw,
        PrivacyMetricsUpdate: PrivacyMetricsUpdate,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub commitment: felt252,
        pub amount: u256,
        pub depositor: ContractAddress,
        pub timestamp: u64,
        pub anonymity_set_size: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdrawal {
        #[key]
        pub nullifier: felt252,
        pub recipient: ContractAddress,
        pub amount: u256,
        pub timestamp: u64,
        pub anonymity_set_size: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct AccountRegistered {
        #[key]
        account_id: felt252,
        owner: ContractAddress,
        account_type: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct AccountTransfer {
        #[key]
        from_account: felt252,
        #[key]
        to_account: felt252,
        amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyPause {
        timestamp: u64,
        triggered_by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyUnpause {
        timestamp: u64,
        triggered_by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyWithdraw {
        amount: u256,
        recipient: ContractAddress,
        timestamp: u64,
        triggered_by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct PrivacyMetricsUpdate {
        anonymity_set_size: u256,
        mixing_efficiency: u256,
        temporal_privacy_score: u256,
        timestamp: u64,
    }

    

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        strk_token: ContractAddress,
        min_deposit: u256,
        max_deposit: u256,
        mixing_fee: u256,
        min_anonymity: u256,
        min_delay: u64,
    ) {
        self.owner.write(owner);
        self.strk_token.write(strk_token);
        self.min_deposit_amount.write(min_deposit);
        self.max_deposit_amount.write(max_deposit);
        self.mixing_fee_rate.write(mixing_fee);
        self.min_anonymity_set.write(min_anonymity);
        self.min_mixing_delay.write(min_delay);
        self.paused.write(false);
        self.account_counter.write(0);
        self.total_deposits.write(0);
        self.total_withdrawals.write(0);
        self.anonymity_set_size.write(0);
        self.deposit_count.write(0);
        self.withdrawal_count.write(0);
    }

    #[abi(embed_v0)]
    impl PrivacyMixerImpl of IPrivacyMixer<ContractState> {
        fn deposit(ref self: ContractState, commitment: felt252, amount: u256) -> felt252 {
            self._assert_not_paused();
            self._validate_deposit_amount(amount);
            assert!(!self.commitment_exists.read(commitment), "Commitment already exists");

            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let block_number = get_block_number();

            // Transfer STRK tokens from user to contract
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let contract_address = get_contract_address();
            let transfer_success = strk_token.transfer_from(caller, contract_address, amount);
            assert!(transfer_success, "STRK transfer failed");

            // Create commitment record
            let commitment_data = Commitment {
                hash: commitment,
                amount: amount,
                timestamp: timestamp,
                block_number: block_number,
                depositor: caller,
            };

            // Store commitment
            self.commitments.write(commitment, commitment_data);
            self.commitment_exists.write(commitment, true);
            self.deposit_timestamps.write(commitment, timestamp);

            // Update metrics
            let new_deposit_count = self.deposit_count.read() + 1;
            let new_total_deposits = self.total_deposits.read() + amount;
            let new_anonymity_set = self.anonymity_set_size.read() + 1;

            self.deposit_count.write(new_deposit_count);
            self.total_deposits.write(new_total_deposits);
            self.anonymity_set_size.write(new_anonymity_set);

            // Emit deposit event
            self
                .emit(
                    Event::Deposit(
                        Deposit {
                            commitment: commitment,
                            amount: amount,
                            depositor: caller,
                            timestamp: timestamp,
                            anonymity_set_size: new_anonymity_set,
                        },
                    ),
                );

            commitment
        }

        fn batch_deposit(
            ref self: ContractState, commitments: Array<felt252>, amounts: Array<u256>,
        ) -> Array<felt252> {
            self._assert_not_paused();
            assert!(commitments.len() == amounts.len(), "Array length mismatch");
            assert!(commitments.len() > 0, "Empty batch not allowed");
            assert!(
                commitments.len() <= 10, "Batch size too large",
            ); // Limit batch size for gas efficiency

            let mut result = ArrayTrait::new();
            let mut i: usize = 0;

            while i < commitments.len() {
                let commitment = *commitments.at(i);
                let amount = *amounts.at(i);
                let deposit_id = self.deposit(commitment, amount);
                result.append(deposit_id);
                i += 1;
            }

            result
        }

        fn withdraw(
            ref self: ContractState,
            nullifier: felt252,
            commitment: felt252,
            recipient: ContractAddress,
            amount: u256,
            proof: Array<felt252>,
        ) -> bool {
            self._assert_not_paused();
            assert!(!self.nullifiers.read(nullifier), "Nullifier already used");
            assert!(self.commitment_exists.read(commitment), "Invalid commitment");

            // Verify temporal privacy (minimum mixing delay)
            let deposit_time = self.deposit_timestamps.read(commitment);
            let current_time = get_block_timestamp();
            let min_delay = self.min_mixing_delay.read();
            assert!(current_time >= deposit_time + min_delay, "Minimum mixing delay not met");

            // Verify privacy guarantees
            let current_anonymity_set = self.anonymity_set_size.read();
            let min_anonymity = self.min_anonymity_set.read();
            assert!(current_anonymity_set >= min_anonymity, "Insufficient anonymity set");

            // Verify zero-knowledge proof (simplified - real implementation would use proper ZK
            // verification)
            self._verify_withdrawal_proof(nullifier, commitment, recipient, amount, proof);

            // Mark nullifier as used
            self.nullifiers.write(nullifier, true);

            // Update metrics
            let new_withdrawal_count = self.withdrawal_count.read() + 1;
            let new_total_withdrawals = self.total_withdrawals.read() + amount;
            let new_anonymity_set = self.anonymity_set_size.read() - 1;

            self.withdrawal_count.write(new_withdrawal_count);
            self.total_withdrawals.write(new_total_withdrawals);
            self.anonymity_set_size.write(new_anonymity_set);

            // Emit withdrawal event
            self
                .emit(
                    Event::Withdrawal(
                        Withdrawal {
                            nullifier: nullifier,
                            recipient: recipient,
                            amount: amount,
                            timestamp: current_time,
                            anonymity_set_size: new_anonymity_set,
                        },
                    ),
                );

            // Transfer funds to recipient (in real implementation, this would interact with STRK
            // token contract)
            self._transfer_to_recipient(recipient, amount);

            true
        }

        fn get_anonymity_set_size(self: @ContractState) -> u256 {
            self.anonymity_set_size.read()
        }

        fn get_total_deposits(self: @ContractState) -> u256 {
            self.total_deposits.read()
        }

        fn get_total_withdrawals(self: @ContractState) -> u256 {
            self.total_withdrawals.read()
        }

        fn get_min_delay(self: @ContractState) -> u64 {
            self.min_mixing_delay.read()
        }

        fn get_min_anonymity_set(self: @ContractState) -> u256 {
            self.min_anonymity_set.read()
        }

        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.nullifiers.read(nullifier)
        }

        fn is_commitment_valid(self: @ContractState, commitment: felt252) -> bool {
            self.commitment_exists.read(commitment)
        }

        fn register_account(
            ref self: ContractState, account_type: felt252, metadata: felt252,
        ) -> felt252 {
            self._assert_not_paused();
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            let account_id = self.account_counter.read() + 1;
            self.account_counter.write(account_id);

            let account = Account {
                owner: caller,
                account_type: account_type,
                balance: 0,
                metadata: metadata,
                created_at: timestamp,
                last_activity: timestamp,
            };

            self.accounts.write(account_id, account);

            // Emit account registration event
            self
                .emit(
                    Event::AccountRegistered(
                        AccountRegistered {
                            account_id: account_id,
                            owner: caller,
                            account_type: account_type,
                            timestamp: timestamp,
                        },
                    ),
                );

            account_id
        }

        fn get_account_balance(self: @ContractState, account_id: felt252) -> u256 {
            let account = self.accounts.read(account_id);
            account.balance
        }

        fn transfer_between_accounts(
            ref self: ContractState, from: felt252, to: felt252, amount: u256,
        ) -> bool {
            self._assert_not_paused();
            let caller = get_caller_address();

            let mut from_account = self.accounts.read(from);
            let mut to_account = self.accounts.read(to);

            // Verify ownership
            assert!(from_account.owner == caller, "Not account owner");
            assert!(from_account.balance >= amount, "Insufficient balance");

            // Update balances
            from_account.balance -= amount;
            to_account.balance += amount;

            let timestamp = get_block_timestamp();
            from_account.last_activity = timestamp;
            to_account.last_activity = timestamp;

            // Store updated accounts
            self.accounts.write(from, from_account);
            self.accounts.write(to, to_account);

            // Emit transfer event
            self
                .emit(
                    Event::AccountTransfer(
                        AccountTransfer {
                            from_account: from,
                            to_account: to,
                            amount: amount,
                            timestamp: timestamp,
                        },
                    ),
                );

            true
        }

        fn emergency_pause(ref self: ContractState) {
            let caller = get_caller_address();
            assert!(caller == self.owner.read(), "Only owner can pause");

            self.paused.write(true);

            self
                .emit(
                    Event::EmergencyPause(
                        EmergencyPause { timestamp: get_block_timestamp(), triggered_by: caller },
                    ),
                );
        }

        fn emergency_unpause(ref self: ContractState) {
            let caller = get_caller_address();
            assert!(caller == self.owner.read(), "Only owner can unpause");

            self.paused.write(false);

            self
                .emit(
                    Event::EmergencyUnpause(
                        EmergencyUnpause { timestamp: get_block_timestamp(), triggered_by: caller },
                    ),
                );
        }

        fn emergency_withdraw(ref self: ContractState, recipient: ContractAddress) -> u256 {
            let caller = get_caller_address();
            assert!(caller == self.owner.read(), "Only owner can emergency withdraw");
            assert!(recipient != contract_address_const::<0>(), "Invalid recipient");

            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let contract_address = get_contract_address();
            let total_balance = strk_token.balance_of(contract_address);

            assert!(total_balance > 0, "No funds to withdraw");

            // Transfer all STRK tokens to the specified recipient
            let transfer_success = strk_token.transfer(recipient, total_balance);
            assert!(transfer_success, "Emergency withdrawal transfer failed");

            let timestamp = get_block_timestamp();

            // Emit emergency withdrawal event
            self
                .emit(
                    Event::EmergencyWithdraw(
                        EmergencyWithdraw {
                            amount: total_balance,
                            recipient: recipient,
                            timestamp: timestamp,
                            triggered_by: caller,
                        },
                    ),
                );

            // Reset contract state counters to reflect emergency withdrawal
            self.total_deposits.write(0);
            self.total_withdrawals.write(0);
            self.anonymity_set_size.write(0);
            self.deposit_count.write(0);
            self.withdrawal_count.write(0);

            total_balance
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn get_mixing_stats(self: @ContractState) -> MixingStats {
            let total_deposits = self.total_deposits.read();
            let total_withdrawals = self.total_withdrawals.read();
            let anonymity_set = self.anonymity_set_size.read();

            // Calculate mixing efficiency (percentage of successful mixes)
            let deposit_count = self.deposit_count.read();
            let withdrawal_count = self.withdrawal_count.read();
            let efficiency = if deposit_count > 0 {
                (withdrawal_count * 100) / deposit_count
            } else {
                0
            };

            MixingStats {
                total_deposits: total_deposits,
                total_withdrawals: total_withdrawals,
                active_commitments: total_deposits - total_withdrawals,
                anonymity_set_size: anonymity_set,
                mixing_efficiency: efficiency,
            }
        }

        fn verify_privacy_guarantees(self: @ContractState) -> PrivacyMetrics {
            let anonymity_set = self.anonymity_set_size.read();
            let min_anonymity = self.min_anonymity_set.read();

            // Calculate privacy scores (simplified metrics)
            let unlinkability_score = if anonymity_set > 0 {
                (anonymity_set * 100) / (anonymity_set + 1) // Higher is better
            } else {
                0
            };

            let temporal_privacy_score = if self.min_mixing_delay.read() > 0 {
                (self.min_mixing_delay.read().into() * 100) / 3600 // Hours * 100
            } else {
                0
            };

            // Average mixing time (simplified calculation)
            let avg_mixing_time = self.min_mixing_delay.read().into();

            PrivacyMetrics {
                min_anonymity_set: min_anonymity,
                avg_mixing_time: avg_mixing_time,
                unlinkability_score: unlinkability_score,
                temporal_privacy_score: temporal_privacy_score,
            }
        }

        // Admin configuration functions
        fn set_min_delay(ref self: ContractState, new_delay: u64) {
            self._assert_only_owner();
            self.min_mixing_delay.write(new_delay);
        }

        fn set_min_anonymity(ref self: ContractState, new_min_anonymity: u256) {
            self._assert_only_owner();
            self.min_anonymity_set.write(new_min_anonymity);
        }

        fn set_fee_rate(ref self: ContractState, new_fee_rate: u256) {
            self._assert_only_owner();
            assert!(new_fee_rate <= 1000, "Fee rate too high"); // Max 10%
            self.mixing_fee_rate.write(new_fee_rate);
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn get_strk_token(self: @ContractState) -> ContractAddress {
            self.strk_token.read()
        }
    }

    #[generate_trait]
    impl PrivateImpl of PrivateTrait {
        fn _assert_not_paused(self: @ContractState) {
            assert!(!self.paused.read(), "Contract is paused");
        }

        fn _assert_only_owner(self: @ContractState) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            assert!(caller == owner, "Only owner can call this function");
        }

        fn _validate_deposit_amount(self: @ContractState, amount: u256) {
            let min_amount = self.min_deposit_amount.read();
            let max_amount = self.max_deposit_amount.read();
            assert!(amount >= min_amount, "Amount below minimum");
            assert!(amount <= max_amount, "Amount above maximum");
        }

        fn _verify_withdrawal_proof(
            self: @ContractState,
            nullifier: felt252,
            commitment: felt252,
            recipient: ContractAddress,
            amount: u256,
            proof: Array<felt252>,
        ) {
            // Proof structure: [secret, recipient_hash, amount_hash]
            assert!(proof.len() >= 3, "Insufficient proof elements");

            let secret = *proof.at(0);
            let recipient_hash = *proof.at(1);
            let amount_hash = *proof.at(2);

            // Verify commitment = hash(secret, amount)
            let computed_commitment = PoseidonTrait::new()
                .update(secret)
                .update(amount.low.into())
                .update(amount.high.into())
                .finalize();
            assert!(computed_commitment == commitment, "Invalid commitment proof");

            // Verify nullifier = hash(secret, commitment)
            let computed_nullifier = PoseidonTrait::new()
                .update(secret)
                .update(commitment)
                .finalize();
            assert!(computed_nullifier == nullifier, "Invalid nullifier proof");

            // Verify recipient hash = hash(recipient)
            let computed_recipient_hash = PoseidonTrait::new().update(recipient.into()).finalize();
            assert!(computed_recipient_hash == recipient_hash, "Invalid recipient proof");

            // Verify amount hash = hash(amount)
            let computed_amount_hash = PoseidonTrait::new()
                .update(amount.low.into())
                .update(amount.high.into())
                .finalize();
            assert!(computed_amount_hash == amount_hash, "Invalid amount proof");
        }

        fn _transfer_to_recipient(self: @ContractState, recipient: ContractAddress, amount: u256) {
            // Transfer STRK tokens from contract to recipient (full amount, no fees for testing)
            assert!(recipient != contract_address_const::<0>(), "Invalid recipient");
            assert!(amount > 0, "Invalid amount");

            // For testing: transfer full amount without fee deduction
            // In production: implement proper fee calculation and collection
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let transfer_success = strk_token.transfer(recipient, amount);
            assert!(transfer_success, "STRK transfer to recipient failed");
        }
    }
}

// Utility functions for cryptographic operations
#[starknet::interface]
pub trait ICryptoUtils<TContractState> {
    fn generate_commitment(self: @TContractState, secret: felt252, amount: u256) -> felt252;
    fn generate_nullifier(self: @TContractState, secret: felt252, commitment: felt252) -> felt252;
    fn generate_proof(
        self: @TContractState, secret: felt252, amount: u256, recipient: ContractAddress,
    ) -> (felt252, felt252, Array<felt252>);
}

#[starknet::contract]
mod CryptoUtils {
    use core::array::ArrayTrait;
    use core::hash::HashStateTrait;
    use core::poseidon::PoseidonTrait;
    use starknet::ContractAddress;
    use super::ICryptoUtils;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl CryptoUtilsImpl of ICryptoUtils<ContractState> {
        fn generate_commitment(self: @ContractState, secret: felt252, amount: u256) -> felt252 {
            PoseidonTrait::new()
                .update(secret)
                .update(amount.low.into())
                .update(amount.high.into())
                .finalize()
        }

        fn generate_nullifier(
            self: @ContractState, secret: felt252, commitment: felt252,
        ) -> felt252 {
            PoseidonTrait::new().update(secret).update(commitment).finalize()
        }

        fn generate_proof(
            self: @ContractState, secret: felt252, amount: u256, recipient: ContractAddress,
        ) -> (felt252, felt252, Array<felt252>) {
            // Generate commitment
            let commitment = self.generate_commitment(secret, amount);

            // Generate nullifier
            let nullifier = self.generate_nullifier(secret, commitment);

            // Generate proof components
            let recipient_hash = PoseidonTrait::new().update(recipient.into()).finalize();

            let amount_hash = PoseidonTrait::new()
                .update(amount.low.into())
                .update(amount.high.into())
                .finalize();

            // Build proof array: [secret, recipient_hash, amount_hash]
            let mut proof = ArrayTrait::new();
            proof.append(secret);
            proof.append(recipient_hash);
            proof.append(amount_hash);

            (commitment, nullifier, proof)
        }
    }
}
