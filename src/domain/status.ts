// Status helper & guards
import { MixingSession, SessionState } from './types';

export const terminalStates: SessionState[] = ['COMPLETED', 'CANCELLED', 'FAILED'];

export function isTerminal(session: MixingSession): boolean {
    return terminalStates.includes(session.state);
}

export function assertState(session: MixingSession, allowed: SessionState[]): void {
    if (!allowed.includes(session.state)) {
        throw new Error(`Invalid session state. Current=${session.state} Allowed=${allowed.join(',')}`);
    }
}
