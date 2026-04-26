import { logger } from './logger.js';

/**
 * @dev LocalNonceTracker singleton.
 * Manages sequential nonces in-memory to prevent collisions during high congestion.
 */
export class LocalNonceTracker {
  private static instance: LocalNonceTracker;
  private nonces: Map<string, bigint> = new Map();

  private constructor() {}

  public static getInstance(): LocalNonceTracker {
    if (!LocalNonceTracker.instance) {
      LocalNonceTracker.instance = new LocalNonceTracker();
    }
    return LocalNonceTracker.instance;
  }

  /**
   * @dev Gets the next nonce for a given key (usually address + chainId).
   * @param key The tracking key.
   * @param onChainNonce The current nonce fetched from the blockchain.
   */
  public getNextNonce(key: string, onChainNonce: bigint): bigint {
    const localNonce = this.nonces.get(key);

    // If local nonce is behind or non-existent, sync with on-chain
    if (localNonce === undefined || onChainNonce > localNonce) {
      this.nonces.set(key, onChainNonce);
      return onChainNonce;
    }

    // Otherwise, increment the local nonce
    const nextNonce = localNonce + 1n;
    this.nonces.set(key, nextNonce);
    return nextNonce;
  }

  /**
   * @dev Forces a reset of the local nonce (e.g., after a failure or manual sync).
   */
  public sync(key: string, onChainNonce: bigint) {
    this.nonces.set(key, onChainNonce);
    logger.info({ module: 'NonceTracker', step: 'SYNCED', key, nonce: onChainNonce.toString() });
  }

  /**
   * @dev Peeks at the current local nonce without incrementing.
   */
  public peek(key: string): bigint | undefined {
    return this.nonces.get(key);
  }
}
