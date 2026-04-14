import { createPublicClient, http, type Hex } from 'viem';
import { sepolia, hardhat } from 'viem/chains';
import { CriticalSecurityException } from '../logic/errors.js';

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
  async isAgentRegistered(agentAddress: Hex): Promise<boolean> {
    // Fail-Closed: Remove registry bypass and zero-address guards.
    if (this.registryAddress === '0x0000000000000000000000000000000000000000') {
      throw new CriticalSecurityException('Fail-Closed: AgentRegistry address is uninitialized (zero address)');
    }

    try {
      const chain = this.chainId === 31337 ? hardhat : sepolia;

      const publicClient = createPublicClient({
        chain: chain,
        transport: http(),
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
          console.log(`[identity] ✅ Agent registered with ID: ${agentId}`);
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
