import { MixerEvent, MixerEventType } from '../domain';

type AnyEvent = MixerEvent;
type Listener = (evt: AnyEvent) => void | Promise<void>;

export class EventBus {
    private listeners: Record<MixerEventType, Listener[]> = {
        'session.created': [],
        'session.updated': [],
        'session.state_changed': [],
        'session.completed': [],
        'deposit.received': [],
        'mixing.started': [],
        'mixing.completed': [],
        'withdraw.initiated': [],
        'withdraw.completed': [],
        'pipeline.created': [],
        'pipeline.updated': [],
        'pipeline.state_changed': [],
        'pipeline.completed': [],
        'pipeline.failed': [],
        'error': [],
    };

    on(type: MixerEventType, listener: Listener): () => void {
        this.listeners[type].push(listener);
        return () => {
            const arr = this.listeners[type];
            const idx = arr.indexOf(listener);
            if (idx >= 0) arr.splice(idx, 1);
        };
    }

    emit(event: AnyEvent): void {
        for (const l of this.listeners[event.type]) void l(event);
    }
}

export const globalEventBus = new EventBus();
