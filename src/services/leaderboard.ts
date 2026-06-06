import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const REPUTATION_REGISTRY_ABI = parseAbi([
    'event AgentRated(uint256 indexed agentId, address indexed rater, uint8 score, bytes32 outcomeRef)',
    'function getReputation(uint256 agentId) external view returns (uint256 score, uint256 totalRatings)'
]);

const CACHE_PATH = path.join(process.cwd(), 'logs/leaderboard-cache.json');

/**
 * @title LeaderboardService
 * @dev Polls ReputationRegistry and aggregates agent performance data.
 */
export class LeaderboardService {
    private static instance: LeaderboardService;
    private client;
    private registryAddress: Address = '0x423a9904e39537a9997fbaF0f220d79D7d545763';

    private constructor() {
        this.client = createPublicClient({
            chain: sepolia,
            transport: http(`https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`)
        });
    }

    public static getInstance(): LeaderboardService {
        if (!LeaderboardService.instance) {
            LeaderboardService.instance = new LeaderboardService();
        }
        return LeaderboardService.instance;
    }

    /**
     * @dev Aggregates agent data from on-chain events and state.
     */
    public async updateLeaderboard(): Promise<any[]> {
        logger.info({ module: 'LEADERBOARD', step: 'UPDATING_CACHE' });

        try {
            // In a real scenario, we'd fetch all registered agents.
            // For the demo/sprint, we'll focus on a set of known agent IDs or recent events.
            const logs = await this.client.getContractEvents({
                address: this.registryAddress,
                abi: REPUTATION_REGISTRY_ABI,
                eventName: 'AgentRated',
                fromBlock: 'earliest'
            });

            const agentStats = new Map<string, any>();

            for (const log of logs) {
                const { agentId, score } = (log as any).args;
                const idStr = agentId.toString();

                if (!agentStats.has(idStr)) {
                    agentStats.set(idStr, {
                        agentId: idStr,
                        totalTrades: 0, // Inferred from ratings for this demo
                        successRate: 0,
                        reputationScore: 0,
                        ratings: []
                    });
                }

                const stats = agentStats.get(idStr);
                stats.ratings.push(Number(score));
                stats.totalTrades++;
            }

            const leaderboard = Array.from(agentStats.values()).map(stats => {
                const avgScore = stats.ratings.reduce((a: number, b: number) => a + b, 0) / stats.ratings.length;
                return {
                    agentId: stats.agentId,
                    reputationScore: Math.round(avgScore),
                    totalTrades: stats.totalTrades,
                    pnlBps: Math.floor(Math.random() * 500) - 100, // Mocked PnL
                    status: 'ACTIVE'
                };
            }).sort((a, b) => b.reputationScore - a.reputationScore);

            // Save to cache
            if (!fs.existsSync(path.dirname(CACHE_PATH))) {
                fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
            }
            fs.writeFileSync(CACHE_PATH, JSON.stringify(leaderboard, null, 2));

            return leaderboard;
        } catch (error) {
            logger.error({ module: 'LEADERBOARD', step: 'UPDATE_FAILED', error: (error as Error).message });
            if (fs.existsSync(CACHE_PATH)) {
                return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
            }
            return [];
        }
    }

    public getCachedLeaderboard(): any[] {
        if (fs.existsSync(CACHE_PATH)) {
            return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
        }
        return [];
    }
}
