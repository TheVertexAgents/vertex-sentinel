import { createPublicClient, http, fallback, type Hex } from 'viem';
import { sepolia, hardhat } from 'viem/chains';
import { CriticalSecurityException } from '../logic/errors.js';
import { logger } from '../utils/logger.js';

/**
 * @dev Agent Registration and Identity management.
 * Handles interaction with the Agent Registry (ERC-8004 alignment).
 */
export class IdentityClient {
  private registryAddress: Hex;
  private chainId: number;

  constructor(registryAddress: Hex, chainId: number = 11155111) {
    this.registryAddress = registryAddress;
    this.chainId = chainId;
  }

  /**
   * @dev Checks if the agent is registered in the registry.
   * Tries multiple methods to support different AgentRegistry implementations.
   */
  private getTransport() {
    if (this.chainId === 31337) return http();

    const transports = [];
    if (process.env.INFURA_KEY) {
      transports.push(http(`https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`));
    }
    if (process.env.ALCHEMY_KEY) {
      transports.push(http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`));
    }

    if (transports.length === 0) return http();

    return fallback(transports);
  }

  async isAgentRegistered(agentAddress: Hex): Promise<boolean> {
    // Fail-Closed: Remove registry bypass and zero-address guards.
    if (this.registryAddress === '0x0000000000000000000000000000000000000000') {
      throw new CriticalSecurityException('Fail-Closed: AgentRegistry address is uninitialized (zero address)');
    }

    try {
      const chain = this.chainId === 31337 ? hardhat : sepolia;

      const publicClient = createPublicClient({
        chain: chain,
        transport: this.getTransport(),
      });

      // Try method 1: walletToAgentId (shared hackathon registry)
      try {
        const agentId = await publicClient.readContract({
          address: this.registryAddress,
          abi: [
            {
              name: 'walletToAgentId',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'wallet', type: 'address' }],
              outputs: [{ type: 'uint256' }],
            },
          ],
          functionName: 'walletToAgentId',
          args: [agentAddress],
        });
        const isRegistered = (agentId as bigint) > 0n;
        if (isRegistered) {
          logger.info({ module: 'identity', step: 'REGISTERED', agentId: agentId.toString() });
        }
        return isRegistered;
      } catch {
        // Method 1 failed, try method 2
      }

      // Try method 2: isRegisteredAgent (our local contract)
      const isRegistered = await publicClient.readContract({
        address: this.registryAddress,
        abi: [
          {
            name: 'isRegisteredAgent',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'agentWallet', type: 'address' }],
            outputs: [{ type: 'boolean' }],
          },
        ],
        functionName: 'isRegisteredAgent',
        args: [agentAddress],
      });

      return isRegistered as boolean;
    } catch (error) {
      if (error instanceof CriticalSecurityException) throw error;
      throw new CriticalSecurityException(`Fail-Closed: Registration check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
