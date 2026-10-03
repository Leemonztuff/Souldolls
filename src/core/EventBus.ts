import { EventMap } from '../types';

type EventHandler<T> = (payload: T) => void;

/**
 * Type-safe decoupled EventBus for internal systems communication
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<keyof EventMap, Set<EventHandler<any>>> = new Map();

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unbind function for easy cleanup
    return () => this.off(event, handler);
  }

  public off<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K]
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error in handler for event "${String(event)}":`, err);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const GlobalEventBus = EventBus.getInstance();
