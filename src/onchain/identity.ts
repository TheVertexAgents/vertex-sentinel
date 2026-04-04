import { createPublicClient, http, type Hex } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * @dev Agent Registration and Identity management.
 * Handles interaction with the Agent Registry (ERC-8004 alignment).
 */
export class IdentityClient {
  private registryAddress: Hex;

  constructor(registryAddress: Hex) {
    this.registryAddress = registryAddress;
  }

  /**
   * @dev Checks if the agent is registered in the registry.
   */
  async isAgentRegistered(agentAddress: Hex): Promise<boolean> {
    try {
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });

      const isRegistered = await publicClient.readContract({
        address: this.registryAddress,
        abi: [
          {
            name: 'isRegisteredAgent',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'agent', type: 'address' }],
            outputs: [{ type: 'boolean' }],
          },
        ],
        functionName: 'isRegisteredAgent',
        args: [agentAddress],
      });

      return isRegistered as boolean;
    } catch (error) {
      // In demo mode with mock registry, failure can be non-fatal but should be logged.
      console.warn(`[identity] Registration check failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * @dev Placeholder for future on-chain registration logic.
   * Currently, we rely on `deploy_sepolia.ts` or manual onboarding.
   */
  async registerAgent(agentId: bigint) {
     console.log(`[identity] Automated registration for Agent ID ${agentId} is not yet implemented.`);
  }
}
