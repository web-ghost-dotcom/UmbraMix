// Comprehensive observability and metrics system for the Privacy Mixer
// Implements structured logging, performance tracking, success rate monitoring, and system metrics

export enum MetricType {
    COUNTER = 'COUNTER',
    GAUGE = 'GAUGE',
    HISTOGRAM = 'HISTOGRAM',
    TIMER = 'TIMER'
}

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    CRITICAL = 'CRITICAL'
}

export interface MetricData {
    name: string;
    type: MetricType;
    value: number;
    labels: Record<string, string>;
    timestamp: number;
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    sessionId?: string;
    component: string;
    metadata: Record<string, any>;
    error?: Error;
}

export interface PerformanceMetrics {
    // Latency metrics
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;

    // Throughput metrics
    requestsPerSecond: number;
    successRate: number;
    errorRate: number;

    // Privacy metrics
    averageAnonymitySet: number;
    averageDelay: number;
    privacyScore: number;

    // System metrics
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
}

export interface BusinessMetrics {
    // Volume metrics
    totalMixingVolume: bigint;
    dailyActiveUsers: number;
    totalSessions: number;
    completedSessions: number;

    // Success metrics
    successfulMixes: number;
    failedMixes: number;
    refundedSessions: number;

    // Fee metrics
    totalFeesCollected: bigint;
    averageFeePerMix: bigint;

    // Privacy effectiveness
    privacyBreaches: number;
    averageMixingTime: number;
    linkabilityScore: number;
}

export interface AlertCondition {
    name: string;
    metric: string;
    operator: 'GT' | 'LT' | 'EQ' | 'NE';
    threshold: number;
    timeWindow: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    enabled: boolean;
}

export class StructuredLogger {
    private logs: LogEntry[] = [];
    private readonly maxLogSize = 10000;

    log(
        level: LogLevel,
        message: string,
        component: string,
        metadata: Record<string, any> = {},
        sessionId?: string,
        error?: Error
    ): void {
        const entry: LogEntry = {
            level,
            message,
            timestamp: Date.now(),
            sessionId,
            component,
            metadata,
            error
        };

        this.logs.push(entry);

        // Prevent memory leak by limiting log size
        if (this.logs.length > this.maxLogSize) {
            this.logs = this.logs.slice(-this.maxLogSize);
        }

        // Output to console in development
        if (process.env.NODE_ENV !== 'production') {
            this.consoleOutput(entry);
        }

        // In production, would send to log aggregation service
        this.sendToLogService(entry);
    }

    debug(message: string, component: string, metadata?: Record<string, any>, sessionId?: string): void {
        this.log(LogLevel.DEBUG, message, component, metadata, sessionId);
    }

    info(message: string, component: string, metadata?: Record<string, any>, sessionId?: string): void {
        this.log(LogLevel.INFO, message, component, metadata, sessionId);
    }

    warn(message: string, component: string, metadata?: Record<string, any>, sessionId?: string): void {
        this.log(LogLevel.WARN, message, component, metadata, sessionId);
    }

    error(message: string, component: string, error?: Error, metadata?: Record<string, any>, sessionId?: string): void {
        this.log(LogLevel.ERROR, message, component, metadata, sessionId, error);
    }

    critical(message: string, component: string, error?: Error, metadata?: Record<string, any>, sessionId?: string): void {
        this.log(LogLevel.CRITICAL, message, component, metadata, sessionId, error);
    }

    getLogs(timeWindow?: number, level?: LogLevel, component?: string): LogEntry[] {
        const cutoff = timeWindow ? Date.now() - timeWindow : 0;

        return this.logs.filter(log => {
            if (log.timestamp < cutoff) return false;
            if (level && log.level !== level) return false;
            if (component && log.component !== component) return false;
            return true;
        });
    }

    private consoleOutput(entry: LogEntry): void {
        const timestamp = new Date(entry.timestamp).toISOString();
        const prefix = `[${timestamp}] [${entry.level}] [${entry.component}]`;

        if (entry.sessionId) {
            console.log(`${prefix} [${entry.sessionId}] ${entry.message}`, entry.metadata);
        } else {
            console.log(`${prefix} ${entry.message}`, entry.metadata);
        }

        if (entry.error) {
            console.error(entry.error);
        }
    }

    private sendToLogService(entry: LogEntry): void {
        // In production, would send to external logging service
        // e.g., Elasticsearch, CloudWatch, etc.
    }
}

export class MetricsCollector {
    private metrics: Map<string, MetricData[]> = new Map();
    private timers: Map<string, number> = new Map();

    counter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
        this.recordMetric({
            name,
            type: MetricType.COUNTER,
            value,
            labels,
            timestamp: Date.now()
        });
    }

    gauge(name: string, value: number, labels: Record<string, string> = {}): void {
        this.recordMetric({
            name,
            type: MetricType.GAUGE,
            value,
            labels,
            timestamp: Date.now()
        });
    }

    histogram(name: string, value: number, labels: Record<string, string> = {}): void {
        this.recordMetric({
            name,
            type: MetricType.HISTOGRAM,
            value,
            labels,
            timestamp: Date.now()
        });
    }

    startTimer(name: string): void {
        this.timers.set(name, Date.now());
    }

    endTimer(name: string, labels: Record<string, string> = {}): number {
        const startTime = this.timers.get(name);
        if (!startTime) {
            throw new Error(`Timer ${name} was not started`);
        }

        const duration = Date.now() - startTime;
        this.timers.delete(name);

        this.recordMetric({
            name,
            type: MetricType.TIMER,
            value: duration,
            labels,
            timestamp: Date.now()
        });

        return duration;
    }

    private recordMetric(metric: MetricData): void {
        const key = `${metric.name}_${Object.entries(metric.labels).map(([k, v]) => `${k}:${v}`).join('_')}`;

        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }

        const metricArray = this.metrics.get(key)!;
        metricArray.push(metric);

        // Keep only last 1000 entries per metric
        if (metricArray.length > 1000) {
            metricArray.splice(0, metricArray.length - 1000);
        }
    }

    getMetrics(name?: string, timeWindow?: number): MetricData[] {
        const cutoff = timeWindow ? Date.now() - timeWindow : 0;
        const allMetrics: MetricData[] = [];

        for (const [key, metrics] of this.metrics) {
            if (name && !key.startsWith(name)) continue;

            const filtered = metrics.filter(m => m.timestamp >= cutoff);
            allMetrics.push(...filtered);
        }

        return allMetrics.sort((a, b) => a.timestamp - b.timestamp);
    }

    calculateAggregates(name: string, timeWindow?: number): {
        count: number;
        sum: number;
        avg: number;
        min: number;
        max: number;
        p95: number;
        p99: number;
    } {
        const metrics = this.getMetrics(name, timeWindow);
        if (metrics.length === 0) {
            return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
        }

        const values = metrics.map(m => m.value).sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);

        return {
            count: values.length,
            sum,
            avg: sum / values.length,
            min: values[0],
            max: values[values.length - 1],
            p95: values[Math.floor(values.length * 0.95)],
            p99: values[Math.floor(values.length * 0.99)]
        };
    }
}

export class PerformanceMonitor {
    private logger: StructuredLogger;
    private metrics: MetricsCollector;
    private startTimes: Map<string, number> = new Map();

    constructor(logger: StructuredLogger, metrics: MetricsCollector) {
        this.logger = logger;
        this.metrics = metrics;
    }

    startOperation(operationId: string, sessionId?: string): void {
        this.startTimes.set(operationId, Date.now());
        this.logger.debug(`Operation started: ${operationId}`, 'performance', {}, sessionId);
        this.metrics.counter('operations_started', 1, { operation: operationId });
    }

    endOperation(operationId: string, success: boolean, sessionId?: string, metadata?: Record<string, any>): number {
        const startTime = this.startTimes.get(operationId);
        if (!startTime) {
            this.logger.warn(`Operation ${operationId} end called without start`, 'performance', {}, sessionId);
            return 0;
        }

        const duration = Date.now() - startTime;
        this.startTimes.delete(operationId);

        this.logger.info(`Operation completed: ${operationId}`, 'performance', {
            duration,
            success,
            ...metadata
        }, sessionId);

        this.metrics.histogram('operation_duration', duration, {
            operation: operationId,
            success: success.toString()
        });

        this.metrics.counter('operations_completed', 1, {
            operation: operationId,
            success: success.toString()
        });

        return duration;
    }

    recordLatency(operation: string, latency: number, labels?: Record<string, string>): void {
        this.metrics.histogram('latency', latency, { operation, ...labels });
    }

    recordThroughput(operation: string, count: number, labels?: Record<string, string>): void {
        this.metrics.counter('throughput', count, { operation, ...labels });
    }

    recordError(operation: string, errorType: string, labels?: Record<string, string>): void {
        this.metrics.counter('errors', 1, { operation, error_type: errorType, ...labels });
    }
}

export class BusinessMetricsTracker {
    private logger: StructuredLogger;
    private metrics: MetricsCollector;

    constructor(logger: StructuredLogger, metrics: MetricsCollector) {
        this.logger = logger;
        this.metrics = metrics;
    }

    recordMixingSession(
        sessionId: string,
        amount: bigint,
        success: boolean,
        duration: number,
        anonymitySet: number,
        fees: bigint
    ): void {
        this.logger.info('Mixing session completed', 'business', {
            sessionId,
            amount: amount.toString(),
            success,
            duration,
            anonymitySet,
            fees: fees.toString()
        });

        this.metrics.counter('mixing_sessions', 1, { success: success.toString() });
        this.metrics.histogram('mixing_amount', Number(amount), { success: success.toString() });
        this.metrics.histogram('mixing_duration', duration, { success: success.toString() });
        this.metrics.histogram('anonymity_set', anonymitySet, { success: success.toString() });
        this.metrics.counter('fees_collected', Number(fees));
    }

    recordUserActivity(userId: string, action: string, metadata?: Record<string, any>): void {
        this.logger.info(`User activity: ${action}`, 'business', {
            userId,
            action,
            ...metadata
        });

        this.metrics.counter('user_activity', 1, { action });
    }

    recordVolumeMetrics(volume: bigint, currency: string): void {
        this.metrics.histogram('volume', Number(volume), { currency });
    }

    recordPrivacyMetrics(
        privacyScore: number,
        linkabilityRisk: number,
        timingEntropy: number
    ): void {
        this.metrics.gauge('privacy_score', privacyScore);
        this.metrics.gauge('linkability_risk', linkabilityRisk);
        this.metrics.gauge('timing_entropy', timingEntropy);
    }

    getBusinessMetrics(timeWindow?: number): BusinessMetrics {
        const totalMixingVolume = this.metrics.getMetrics('mixing_amount', timeWindow)
            .reduce((sum, m) => sum + BigInt(m.value), 0n);

        const mixingSessions = this.metrics.getMetrics('mixing_sessions', timeWindow);
        const successfulMixes = mixingSessions.filter(m => m.labels.success === 'true').length;
        const failedMixes = mixingSessions.filter(m => m.labels.success === 'false').length;

        const totalFeesCollected = this.metrics.getMetrics('fees_collected', timeWindow)
            .reduce((sum, m) => sum + BigInt(m.value), 0n);

        const uniqueUsers = new Set(
            this.metrics.getMetrics('user_activity', timeWindow)
                .map(m => m.labels.userId)
                .filter(Boolean)
        ).size;

        const mixingDurations = this.metrics.getMetrics('mixing_duration', timeWindow);
        const averageMixingTime = mixingDurations.length > 0
            ? mixingDurations.reduce((sum, m) => sum + m.value, 0) / mixingDurations.length
            : 0;

        return {
            totalMixingVolume,
            dailyActiveUsers: uniqueUsers,
            totalSessions: mixingSessions.length,
            completedSessions: successfulMixes + failedMixes,
            successfulMixes,
            failedMixes,
            refundedSessions: 0, // Would track from error handling system
            totalFeesCollected,
            averageFeePerMix: mixingSessions.length > 0 ? totalFeesCollected / BigInt(mixingSessions.length) : 0n,
            privacyBreaches: 0, // Would track privacy violations
            averageMixingTime,
            linkabilityScore: 0 // Would calculate from privacy analysis
        };
    }
}

export class AlertingSystem {
    private logger: StructuredLogger;
    private metrics: MetricsCollector;
    private conditions: AlertCondition[] = [];
    private alertHistory: Array<{
        condition: string;
        value: number;
        timestamp: number;
        resolved: boolean;
    }> = [];

    constructor(logger: StructuredLogger, metrics: MetricsCollector) {
        this.logger = logger;
        this.metrics = metrics;
        this.initializeDefaultAlerts();
        this.startMonitoring();
    }

    private initializeDefaultAlerts(): void {
        this.conditions = [
            {
                name: 'High Error Rate',
                metric: 'errors',
                operator: 'GT',
                threshold: 10,
                timeWindow: 300000, // 5 minutes
                severity: 'HIGH',
                enabled: true
            },
            {
                name: 'Low Success Rate',
                metric: 'mixing_sessions',
                operator: 'LT',
                threshold: 0.95,
                timeWindow: 3600000, // 1 hour
                severity: 'MEDIUM',
                enabled: true
            },
            {
                name: 'High Latency',
                metric: 'latency',
                operator: 'GT',
                threshold: 30000, // 30 seconds
                timeWindow: 300000,
                severity: 'MEDIUM',
                enabled: true
            },
            {
                name: 'Low Anonymity Set',
                metric: 'anonymity_set',
                operator: 'LT',
                threshold: 5,
                timeWindow: 1800000, // 30 minutes
                severity: 'HIGH',
                enabled: true
            }
        ];
    }

    private startMonitoring(): void {
        setInterval(() => {
            this.checkAlertConditions();
        }, 60000); // Check every minute
    }

    private checkAlertConditions(): void {
        for (const condition of this.conditions) {
            if (!condition.enabled) continue;

            const metrics = this.metrics.getMetrics(condition.metric, condition.timeWindow);
            if (metrics.length === 0) continue;

            const currentValue = this.calculateMetricValue(metrics, condition.metric);
            const isTriggered = this.evaluateCondition(currentValue, condition);

            if (isTriggered) {
                this.triggerAlert(condition, currentValue);
            }
        }
    }

    private calculateMetricValue(metrics: MetricData[], metricName: string): number {
        if (metricName === 'mixing_sessions') {
            // Calculate success rate
            const total = metrics.length;
            const successful = metrics.filter(m => m.labels.success === 'true').length;
            return total > 0 ? successful / total : 1;
        }

        if (metricName === 'errors') {
            return metrics.length;
        }

        if (metricName === 'latency' || metricName === 'anonymity_set') {
            // Return average
            return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
        }

        return 0;
    }

    private evaluateCondition(value: number, condition: AlertCondition): boolean {
        switch (condition.operator) {
            case 'GT': return value > condition.threshold;
            case 'LT': return value < condition.threshold;
            case 'EQ': return value === condition.threshold;
            case 'NE': return value !== condition.threshold;
            default: return false;
        }
    }

    private triggerAlert(condition: AlertCondition, value: number): void {
        this.logger.critical(`Alert triggered: ${condition.name}`, 'alerting', undefined, {
            condition: condition.name,
            currentValue: value,
            threshold: condition.threshold,
            severity: condition.severity
        });

        this.alertHistory.push({
            condition: condition.name,
            value,
            timestamp: Date.now(),
            resolved: false
        });

        // In production, would send notifications (email, Slack, PagerDuty, etc.)
        this.sendNotification(condition, value);
    }

    private sendNotification(condition: AlertCondition, value: number): void {
        // Placeholder for notification system
        console.error(`🚨 ALERT: ${condition.name} - Value: ${value}, Threshold: ${condition.threshold}`);
    }

    addCondition(condition: AlertCondition): void {
        this.conditions.push(condition);
    }

    getAlertHistory(timeWindow?: number): typeof this.alertHistory {
        const cutoff = timeWindow ? Date.now() - timeWindow : 0;
        return this.alertHistory.filter(a => a.timestamp >= cutoff);
    }
}

// Main observability coordinator
export class ObservabilitySystem {
    public readonly logger: StructuredLogger;
    public readonly metrics: MetricsCollector;
    public readonly performance: PerformanceMonitor;
    public readonly business: BusinessMetricsTracker;
    public readonly alerting: AlertingSystem;

    constructor() {
        this.logger = new StructuredLogger();
        this.metrics = new MetricsCollector();
        this.performance = new PerformanceMonitor(this.logger, this.metrics);
        this.business = new BusinessMetricsTracker(this.logger, this.metrics);
        this.alerting = new AlertingSystem(this.logger, this.metrics);
    }

    // Convenience method for tracking complete operations
    async trackOperation<T>(
        operationName: string,
        operation: () => Promise<T>,
        sessionId?: string,
        metadata?: Record<string, any>
    ): Promise<T> {
        const operationId = `${operationName}_${Date.now()}`;
        this.performance.startOperation(operationId, sessionId);

        try {
            const result = await operation();
            this.performance.endOperation(operationId, true, sessionId, metadata);
            return result;
        } catch (error) {
            this.performance.endOperation(operationId, false, sessionId, {
                error: error instanceof Error ? error.message : 'Unknown error',
                ...metadata
            });
            throw error;
        }
    }

    getSystemHealth(): {
        status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
        checks: Record<string, boolean>;
        metrics: PerformanceMetrics;
    } {
        const recentAlerts = this.alerting.getAlertHistory(300000); // Last 5 minutes
        const criticalAlerts = recentAlerts.filter(a => !a.resolved).length;

        const latencyStats = this.metrics.calculateAggregates('latency', 300000);
        const errorCount = this.metrics.getMetrics('errors', 300000).length;

        const checks = {
            lowLatency: latencyStats.p95 < 10000, // < 10 seconds
            lowErrorRate: errorCount < 5,
            noActiveCriticalAlerts: criticalAlerts === 0
        };

        const allChecksPass = Object.values(checks).every(Boolean);
        const someChecksFail = Object.values(checks).some(check => !check);

        const status = allChecksPass ? 'HEALTHY' :
            someChecksFail ? 'DEGRADED' : 'UNHEALTHY';

        return {
            status,
            checks,
            metrics: {
                averageLatency: latencyStats.avg,
                p95Latency: latencyStats.p95,
                p99Latency: latencyStats.p99,
                requestsPerSecond: 0, // Would calculate from throughput metrics
                successRate: 0.95, // Would calculate from success/failure metrics
                errorRate: errorCount / 100, // Would calculate properly
                averageAnonymitySet: 15, // Would get from privacy metrics
                averageDelay: 300000, // Would get from privacy metrics
                privacyScore: 0.9, // Would calculate from privacy analysis
                memoryUsage: process.memoryUsage().heapUsed,
                cpuUsage: 0, // Would get from system metrics
                activeConnections: 0 // Would track active connections
            }
        };
    }
}
