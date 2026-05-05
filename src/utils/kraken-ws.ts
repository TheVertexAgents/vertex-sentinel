import WebSocket from 'ws';
import { logger } from './logger.js';
import { safeParseJSON } from './safe-json.js';

/**
 * @dev Kraken WebSocket API v2 Client.
 * Decouples streaming market data from polling.
 */
export class KrakenWSClient {
  private static instance: KrakenWSClient;
  private ws: WebSocket | null = null;
  private connectionPromise: Promise<void> | null = null;
  private subscriptions: Set<string> = new Set();
  private handlers: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 5;

  private constructor() {}

  public static getInstance(): KrakenWSClient {
    if (!KrakenWSClient.instance) {
      KrakenWSClient.instance = new KrakenWSClient();
    }
    return KrakenWSClient.instance;
  }

  public connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      logger.info({ module: 'KrakenWS', step: 'CONNECTING' });
      this.ws = new WebSocket('wss://ws.kraken.com/v2');

      this.ws.on('open', () => {
        logger.info({ module: 'KrakenWS', step: 'CONNECTED' });
        this.reconnectAttempts = 0;
        this.resubscribe();
        this.connectionPromise = null;
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (err) => {
        logger.error({ module: 'KrakenWS', step: 'ERROR', error: err.message });
        this.connectionPromise = null;
        reject(err);
      });

      this.ws.on('close', () => {
        logger.warn({ module: 'KrakenWS', step: 'CLOSED' });
        this.handleReconnect();
      });
    });

    return this.connectionPromise;
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.MAX_RECONNECT) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      logger.info({ module: 'KrakenWS', step: 'RECONNECTING', attempt: this.reconnectAttempts, delay });
      setTimeout(() => this.connect(), delay);
    } else {
      logger.error({ module: 'KrakenWS', step: 'MAX_RECONNECT_REACHED' });
    }
  }

  private resubscribe() {
    if (this.subscriptions.size > 0) {
      const pairs = Array.from(this.subscriptions);
      this.send({
        method: 'subscribe',
        params: {
          channel: 'ticker',
          symbol: pairs
        }
      });
    }
  }

  public subscribeTicker(pair: string, handler: (data: any) => void) {
    this.subscriptions.add(pair);
    this.handlers.set(`ticker-${pair}`, handler);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        method: 'subscribe',
        params: {
          channel: 'ticker',
          symbol: [pair]
        }
      });
    } else {
      this.connect();
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(data: WebSocket.Data) {
    try {
      const message = safeParseJSON(data.toString(), null as any, { step: 'kraken_ws_msg' });
      if (!message) return;

      if (message.channel === 'ticker' && message.type === 'update') {
        const tickerData = message.data[0];
        const pair = tickerData.symbol; // In v2 ticker updates, symbol is inside data[0]
        const handler = this.handlers.get(`ticker-${pair}`);
        if (handler) {
          handler(tickerData);
        }
      }
    } catch (err) {
      // Ignore heartbeat or non-json
    }
  }
}
