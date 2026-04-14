import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CriticalSecurityException } from './errors.js';

/**
 * @dev Schema for agent metadata validation.
 * Mandated by Project Review and Constitution.
 */
export const AgentMetadataSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must follow semantic versioning (x.y.z)"),
  agentId: z.number().int().positive("Agent ID must be a positive integer"),
  usdScalingFactor: z.number().int().positive().default(100),
  targetValidationScore: z.number().int().min(0).max(100).default(100),
  defaultSlippageBps: z.any().transform(val => BigInt(val)).default(100n),
  defaultDeadlineOffset: z.number().int().positive().default(3600),
  prismDefaultPrecision: z.number().int().positive().default(18),
});

export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

/**
 * @dev Loads and validates agent-id.json from the project root.
 * Throws CriticalSecurityException if validation fails (Fail-Closed).
 */
export function loadAgentMetadata(): AgentMetadata {
  const filePath = path.join(process.cwd(), 'agent-id.json');

  if (!fs.existsSync(filePath)) {
    throw new CriticalSecurityException('Fail-Closed: agent-id.json is missing from project root');
  }

  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(rawData);

    const result = AgentMetadataSchema.safeParse(parsed);

    if (!result.success) {
      const errorMessages = result.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new CriticalSecurityException(`Agent metadata validation failed: ${errorMessages}`);
    }

    return result.data;
  } catch (error) {
    if (error instanceof CriticalSecurityException) throw error;
    throw new CriticalSecurityException(`Fail-Closed: Failed to load agent-id.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}
