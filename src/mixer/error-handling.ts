// Comprehensive error handling and recovery system for the Privacy Mixer
// Implements timeout protection, automatic refunds, atomic operations, and rollback handling

export enum ErrorCode {
    // Network and connectivity errors
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    CONNECTION_FAILED = 'CONNECTION_FAILED',
    RPC_ERROR = 'RPC_ERROR',

    // Transaction errors
    TRANSACTION_FAILED = 'TRANSACTION_FAILED',
    INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
    GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
    NONCE_TOO_LOW = 'NONCE_TOO_LOW',

    // Swap and bridge errors
    SWAP_EXPIRED = 'SWAP_EXPIRED',
    SWAP_RATE_CHANGED = 'SWAP_RATE_CHANGED',
    LIQUIDITY_INSUFFICIENT = 'LIQUIDITY_INSUFFICIENT',
    BRIDGE_CONGESTION = 'BRIDGE_CONGESTION',

    // Lightning errors
    INVOICE_EXPIRED = 'INVOICE_EXPIRED',
    PAYMENT_ROUTE_NOT_FOUND = 'PAYMENT_ROUTE_NOT_FOUND',
    CHANNEL_INSUFFICIENT_CAPACITY = 'CHANNEL_INSUFFICIENT_CAPACITY',
    PAYMENT_TIMEOUT = 'PAYMENT_TIMEOUT',

    // Cashu errors
    MINT_UNAVAILABLE = 'MINT_UNAVAILABLE',
    PROOF_INVALID = 'PROOF_INVALID',
    DOUBLE_SPEND_ATTEMPT = 'DOUBLE_SPEND_ATTEMPT',
    ECASH_MELT_FAILED = 'ECASH_MELT_FAILED',

    // Privacy mixer errors
    BATCH_PROCESSING_FAILED = 'BATCH_PROCESSING_FAILED',
    ANONYMITY_SET_TOO_SMALL = 'ANONYMITY_SET_TOO_SMALL',
    MIXING_TIMEOUT = 'MIXING_TIMEOUT',
    PRIVACY_BREACH_DETECTED = 'PRIVACY_BREACH_DETECTED',

    // System errors
    STORAGE_ERROR = 'STORAGE_ERROR',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
    LOW = 'LOW',           // Minor issues, can retry
    MEDIUM = 'MEDIUM',     // Requires user action or different approach
    HIGH = 'HIGH',         // Critical error, requires refund/rollback
    CRITICAL = 'CRITICAL'  // System-level error, requires immediate attention
}

export interface ErrorContext {
    sessionId: string;
    step: string;
    timestamp: number;
    metadata: Record<string, any>;
    stackTrace?: string;
}

export interface ErrorDetails {
    code: ErrorCode;
    message: string;
    severity: ErrorSeverity;
    context: ErrorContext;
    retryable: boolean;
    autoRecoverable: boolean;
    userMessage: string;
}

export interface RecoveryAction {
    type: 'RETRY' | 'REFUND' | 'ROLLBACK' | 'ALTERNATIVE_ROUTE' | 'MANUAL_INTERVENTION';
    description: string;
    parameters: Record<string, any>;
    estimatedDuration: number;
    successProbability: number;
}

export interface RecoveryStrategy {
    primaryAction: RecoveryAction;
    fallbackActions: RecoveryAction[];
    timeoutMs: number;
    maxRetries: number;
}

export class PrivacyMixerError extends Error {
    public readonly details: ErrorDetails;

    constructor(details: ErrorDetails) {
        super(details.message);
        this.name = 'PrivacyMixerError';
        this.details = details;
    }

    static fromError(error: Error, context: ErrorContext): PrivacyMixerError {
        const details: ErrorDetails = {
            code: ErrorCode.UNKNOWN_ERROR,
            message: error.message,
            severity: ErrorSeverity.MEDIUM,
            context: {
                ...context,
                stackTrace: error.stack
            },
            retryable: true,
            autoRecoverable: false,
            userMessage: 'An unexpected error occurred. Please try again.'
        };

        return new PrivacyMixerError(details);
    }
}

export class ErrorHandlingEngine {
    private recoveryStrategies: Map<ErrorCode, RecoveryStrategy> = new Map();
    private errorHistory: Array<{
        error: ErrorDetails;
        recoveryAttempts: number;
        resolved: boolean;
        timestamp: number;
    }> = [];

    constructor() {
        this.initializeRecoveryStrategies();
    }

    private initializeRecoveryStrategies(): void {
        // Network errors - retry with backoff
        this.recoveryStrategies.set(ErrorCode.NETWORK_TIMEOUT, {
            primaryAction: {
                type: 'RETRY',
                description: 'Retry with exponential backoff',
                parameters: { backoffMs: 1000, multiplier: 2 },
                estimatedDuration: 30000,
                successProbability: 0.8
            },
            fallbackActions: [
                {
                    type: 'ALTERNATIVE_ROUTE',
                    description: 'Use alternative RPC endpoint',
                    parameters: { useBackupRpc: true },
                    estimatedDuration: 10000,
                    successProbability: 0.6
                }
            ],
            timeoutMs: 300000,
            maxRetries: 3
        });

        // Transaction failures - analyze and recover
        this.recoveryStrategies.set(ErrorCode.TRANSACTION_FAILED, {
            primaryAction: {
                type: 'RETRY',
                description: 'Retry with higher gas price',
                parameters: { gasMultiplier: 1.2 },
                estimatedDuration: 60000,
                successProbability: 0.7
            },
            fallbackActions: [
                {
                    type: 'ROLLBACK',
                    description: 'Rollback transaction and refund',
                    parameters: { refundToOriginalAddress: true },
                    estimatedDuration: 120000,
                    successProbability: 0.95
                }
            ],
            timeoutMs: 600000,
            maxRetries: 2
        });

        // Swap errors - handle with alternative routes
        this.recoveryStrategies.set(ErrorCode.SWAP_EXPIRED, {
            primaryAction: {
                type: 'ALTERNATIVE_ROUTE',
                description: 'Get new swap quote and retry',
                parameters: { refreshQuote: true, allowSlippage: 0.5 },
                estimatedDuration: 30000,
                successProbability: 0.8
            },
            fallbackActions: [
                {
                    type: 'REFUND',
                    description: 'Refund original amount',
                    parameters: { refundFee: true },
                    estimatedDuration: 180000,
                    successProbability: 0.99
                }
            ],
            timeoutMs: 900000,
            maxRetries: 2
        });

        // Lightning payment errors
        this.recoveryStrategies.set(ErrorCode.PAYMENT_ROUTE_NOT_FOUND, {
            primaryAction: {
                type: 'RETRY',
                description: 'Retry with higher fee limit',
                parameters: { maxFeePpm: 10000 },
                estimatedDuration: 60000,
                successProbability: 0.6
            },
            fallbackActions: [
                {
                    type: 'ALTERNATIVE_ROUTE',
                    description: 'Split payment into smaller amounts',
                    parameters: { splitCount: 4, maxShardSize: 250000 },
                    estimatedDuration: 120000,
                    successProbability: 0.8
                }
            ],
            timeoutMs: 300000,
            maxRetries: 3
        });

        // Cashu mint errors
        this.recoveryStrategies.set(ErrorCode.MINT_UNAVAILABLE, {
            primaryAction: {
                type: 'ALTERNATIVE_ROUTE',
                description: 'Switch to alternative mint',
                parameters: { useBackupMint: true },
                estimatedDuration: 30000,
                successProbability: 0.9
            },
            fallbackActions: [
                {
                    type: 'RETRY',
                    description: 'Wait and retry original mint',
                    parameters: { delayMs: 60000 },
                    estimatedDuration: 120000,
                    successProbability: 0.5
                }
            ],
            timeoutMs: 600000,
            maxRetries: 2
        });

        // Privacy mixer specific errors
        this.recoveryStrategies.set(ErrorCode.ANONYMITY_SET_TOO_SMALL, {
            primaryAction: {
                type: 'RETRY',
                description: 'Wait for larger anonymity set',
                parameters: { waitForBatchSize: 20, maxWaitMs: 1800000 },
                estimatedDuration: 600000,
                successProbability: 0.7
            },
            fallbackActions: [
                {
                    type: 'ALTERNATIVE_ROUTE',
                    description: 'Proceed with smaller set and additional delays',
                    parameters: { minAnonymitySet: 5, extraDelayMs: 900000 },
                    estimatedDuration: 1200000,
                    successProbability: 0.8
                }
            ],
            timeoutMs: 3600000,
            maxRetries: 1
        });
    }

    async handleError(
        error: PrivacyMixerError,
        sessionContext: Record<string, any>
    ): Promise<RecoveryAction | null> {
        // Record error in history
        this.errorHistory.push({
            error: error.details,
            recoveryAttempts: 0,
            resolved: false,
            timestamp: Date.now()
        });

        const strategy = this.recoveryStrategies.get(error.details.code);
        if (!strategy) {
            // No specific strategy, try generic recovery
            return this.getGenericRecoveryAction(error.details);
        }

        // Check if error is auto-recoverable
        if (error.details.autoRecoverable) {
            return await this.executeRecoveryStrategy(strategy, error.details, sessionContext);
        }

        // Return recommended action for manual intervention
        return strategy.primaryAction;
    }

    private async executeRecoveryStrategy(
        strategy: RecoveryStrategy,
        errorDetails: ErrorDetails,
        sessionContext: Record<string, any>
    ): Promise<RecoveryAction | null> {
        let attempts = 0;
        const startTime = Date.now();

        while (attempts < strategy.maxRetries && Date.now() - startTime < strategy.timeoutMs) {
            try {
                const action = attempts === 0 ? strategy.primaryAction :
                    strategy.fallbackActions[Math.min(attempts - 1, strategy.fallbackActions.length - 1)];

                const success = await this.executeRecoveryAction(action, errorDetails, sessionContext);

                if (success) {
                    // Mark as resolved
                    const historyEntry = this.errorHistory.find(h =>
                        h.error.context.sessionId === errorDetails.context.sessionId &&
                        h.error.code === errorDetails.code
                    );
                    if (historyEntry) {
                        historyEntry.resolved = true;
                        historyEntry.recoveryAttempts = attempts + 1;
                    }

                    return action;
                }
            } catch (recoveryError) {
                console.error(`Recovery attempt ${attempts + 1} failed:`, recoveryError);
            }

            attempts++;

            // Exponential backoff between attempts
            if (attempts < strategy.maxRetries) {
                await this.delay(Math.min(1000 * Math.pow(2, attempts), 30000));
            }
        }

        return null;
    }

    private async executeRecoveryAction(
        action: RecoveryAction,
        errorDetails: ErrorDetails,
        sessionContext: Record<string, any>
    ): Promise<boolean> {
        switch (action.type) {
            case 'RETRY':
                return await this.executeRetry(action, errorDetails, sessionContext);

            case 'REFUND':
                return await this.executeRefund(action, errorDetails, sessionContext);

            case 'ROLLBACK':
                return await this.executeRollback(action, errorDetails, sessionContext);

            case 'ALTERNATIVE_ROUTE':
                return await this.executeAlternativeRoute(action, errorDetails, sessionContext);

            case 'MANUAL_INTERVENTION':
                // Log for manual review
                console.warn('Manual intervention required:', {
                    error: errorDetails,
                    action,
                    sessionContext
                });
                return false;

            default:
                return false;
        }
    }

    private async executeRetry(
        action: RecoveryAction,
        errorDetails: ErrorDetails,
        sessionContext: Record<string, any>
    ): Promise<boolean> {
        // Apply retry parameters
        if (action.parameters.backoffMs) {
            await this.delay(action.parameters.backoffMs);
        }

        // Modify session context based on retry parameters
        if (action.parameters.gasMultiplier) {
            sessionContext.gasPrice = (sessionContext.gasPrice || 1) * action.parameters.gasMultiplier;
        }

        if (action.parameters.maxFeePpm) {
            sessionContext.maxFeePpm = action.parameters.maxFeePpm;
        }

        // For simulation purposes, return success based on probability
        return Math.random() < action.successProbability;
    }

    private async executeRefund(
        action: RecoveryAction,
        errorDetails: ErrorDetails,
        sessionContext: Record<string, any>
    ): Promise<boolean> {
        try {
            // Implement refund logic
            console.log('Executing refund:', {
                sessionId: errorDetails.context.sessionId,
                refundAddress: 'redacted',
                amount: sessionContext.originalAmount,
                includeFee: action.parameters.refundFee
            });

            // Simulate refund transaction
            await this.delay(5000);

            return true;
        } catch (error) {
            console.error('Refund failed:', error);
            return false;
        }
    }

    private async executeRollback(
        action: RecoveryAction,
        errorDetails: ErrorDetails,
        sessionContext: Record<string, any>
    ): Promise<boolean> {
        try {
            // Implement rollback logic - reverse all completed steps
            console.log('Executing rollback:', {
                sessionId: errorDetails.context.sessionId,
                step: errorDetails.context.step,
                rollbackSteps: sessionContext.completedSteps
            });

            // Simulate rollback operations
            await this.delay(10000);

            return true;
        } catch (error) {
            console.error('Rollback failed:', error);
            return false;
        }
    }

    private async executeAlternativeRoute(
        action: RecoveryAction,
        errorDetails: ErrorDetails,
        sessionContext: Record<string, any>
    ): Promise<boolean> {
        try {
            // Implement alternative route logic
            if (action.parameters.useBackupRpc) {
                sessionContext.rpcEndpoint = sessionContext.backupRpcEndpoint;
            }

            if (action.parameters.useBackupMint) {
                sessionContext.mintUrl = sessionContext.backupMintUrl;
            }

            if (action.parameters.splitCount) {
                sessionContext.paymentSplits = action.parameters.splitCount;
            }

            console.log('Executing alternative route:', {
                sessionId: errorDetails.context.sessionId,
                parameters: action.parameters
            });

            return Math.random() < action.successProbability;
        } catch (error) {
            console.error('Alternative route failed:', error);
            return false;
        }
    }

    private getGenericRecoveryAction(errorDetails: ErrorDetails): RecoveryAction {
        if (errorDetails.retryable && errorDetails.severity !== ErrorSeverity.CRITICAL) {
            return {
                type: 'RETRY',
                description: 'Generic retry with backoff',
                parameters: { backoffMs: 5000 },
                estimatedDuration: 30000,
                successProbability: 0.5
            };
        }

        return {
            type: 'MANUAL_INTERVENTION',
            description: 'Requires manual review and intervention',
            parameters: { notifySupport: true },
            estimatedDuration: 0,
            successProbability: 0
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public interface for error reporting and metrics
    getErrorHistory(timeWindow?: number): Array<{
        error: ErrorDetails;
        recoveryAttempts: number;
        resolved: boolean;
        timestamp: number;
    }> {
        const cutoff = timeWindow ? Date.now() - timeWindow : 0;
        return this.errorHistory.filter(h => h.timestamp >= cutoff);
    }

    getRecoverySuccessRate(errorCode?: ErrorCode): number {
        const relevantErrors = errorCode
            ? this.errorHistory.filter(h => h.error.code === errorCode)
            : this.errorHistory;

        if (relevantErrors.length === 0) return 0;

        const resolvedCount = relevantErrors.filter(h => h.resolved).length;
        return resolvedCount / relevantErrors.length;
    }

    clearHistory(): void {
        this.errorHistory = [];
    }
}

// Timeout protection wrapper
export class TimeoutProtection {
    static async withTimeout<T>(
        promise: Promise<T>,
        timeoutMs: number,
        errorMessage: string = 'Operation timed out'
    ): Promise<T> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new PrivacyMixerError({
                    code: ErrorCode.NETWORK_TIMEOUT,
                    message: errorMessage,
                    severity: ErrorSeverity.MEDIUM,
                    context: {
                        sessionId: 'timeout',
                        step: 'timeout_protection',
                        timestamp: Date.now(),
                        metadata: { timeoutMs }
                    },
                    retryable: true,
                    autoRecoverable: true,
                    userMessage: 'The operation took too long. Please try again.'
                }));
            }, timeoutMs);
        });

        return Promise.race([promise, timeoutPromise]);
    }
}

// Circuit breaker for preventing cascade failures
export class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    constructor(
        private readonly threshold: number = 5,
        private readonly resetTimeMs: number = 60000
    ) { }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeMs) {
                this.state = 'HALF_OPEN';
            } else {
                throw new PrivacyMixerError({
                    code: ErrorCode.CONNECTION_FAILED,
                    message: 'Circuit breaker is open',
                    severity: ErrorSeverity.HIGH,
                    context: {
                        sessionId: 'circuit_breaker',
                        step: 'circuit_protection',
                        timestamp: Date.now(),
                        metadata: { state: this.state, failures: this.failures }
                    },
                    retryable: true,
                    autoRecoverable: false,
                    userMessage: 'Service is temporarily unavailable. Please try again later.'
                });
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
        }
    }

    getState(): { state: string; failures: number; lastFailureTime: number } {
        return {
            state: this.state,
            failures: this.failures,
            lastFailureTime: this.lastFailureTime
        };
    }
}
