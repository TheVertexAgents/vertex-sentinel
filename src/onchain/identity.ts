import { createPublicClient, http, type Hex } from 'viem';
import { sepolia, hardhat } from 'viem/chains';

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
   */
  async isAgentRegistered(agentAddress: Hex): Promise<boolean> {
    // Zero address check for local/demo mode
    if (this.registryAddress === '0x0000000000000000000000000000000000000000' || process.env.DEMO_MODE === 'true') {
      console.warn(`[identity] Skipping registration check (DEMO_MODE=true or zero address)`);
      return true;
    }

    try {
      const chain = this.chainId === 31337 ? hardhat : sepolia;

      const publicClient = createPublicClient({
        chain: chain,
        transport: http(),
      });

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
      console.warn(`[identity] Registration check failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
