/**
 * @title Vertex Sentinel API Client
 * @dev Centralized client for all REST and WebSocket communication.
 */
class ApiClient {
    constructor() {
        this.baseUrl = window.location.origin;
        this.socket = null;
        this.listeners = new Map();
    }

    // REST API Methods
    async fetchAgent() {
        const res = await fetch(`${this.baseUrl}/api/agent`);
        if (!res.ok) throw new Error('Failed to fetch agent metadata');
        return res.json();
    }

    async fetchPnL() {
        const res = await fetch(`${this.baseUrl}/api/pnl`);
        if (!res.ok) throw new Error('Failed to fetch PnL metrics');
        return res.json();
    }

    async fetchAudit(page = 1, limit = 50) {
        const res = await fetch(`${this.baseUrl}/api/audit?page=${page}&limit=${limit}`);
        if (!res.ok) throw new Error('Failed to fetch audit logs');
        return res.json();
    }

    async fetchAutomation() {
        const res = await fetch(`${this.baseUrl}/api/automation`);
        if (!res.ok) throw new Error('Failed to fetch automation state');
        return res.json();
    }

    async toggleAutomation(enabled) {
        const res = await fetch(`${this.baseUrl}/api/automation/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        if (!res.ok) throw new Error('Failed to toggle automation');
        return res.json();
    }

    async fetchQuota() {
        const res = await fetch(`${this.baseUrl}/api/quota`);
        if (!res.ok) throw new Error('Failed to fetch quota');
        return res.json();
    }

    // WebSocket Methods
    initSocket() {
        if (this.socket) return;

        this.socket = io(this.baseUrl);

        this.socket.on('connect', () => {
            console.log('Connected to Sentinel WebSocket');
            this._emit('connect');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from Sentinel WebSocket');
            this._emit('disconnect');
        });

        // Bridge all relevant events
        const events = [
            'automation.sync',
            'trade.authorized',
            'risk.alert',
            'balance.update',
            'hitl.pending',
            'risk.update',
            'fleet.update'
        ];

        events.forEach(event => {
            this.socket.on(event, (data) => {
                console.log(`Socket Event [${event}]:`, data);
                this._emit(event, data);
            });
        });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }
}

export const api = new ApiClient();
