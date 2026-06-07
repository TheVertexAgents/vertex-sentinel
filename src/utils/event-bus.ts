import { EventEmitter } from 'events';

/**
 * @title Shared Event Bus
 * @dev Centralized event emitter to avoid circular dependencies between
 * socket-server, adapters, and services.
 */
class EventBus extends EventEmitter {}

export const agentEvents = new EventBus();
