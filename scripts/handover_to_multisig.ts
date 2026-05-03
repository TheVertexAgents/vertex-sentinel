import { ethers } from 'ethers';
import { logger } from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * @dev Transfers ownership of core contracts to a Gnosis Safe multi-sig.
 */
async function main() {
    const gnosisSafeAddress = process.env.GNOSIS_SAFE_ADDRESS;
    if (!gnosisSafeAddress) {
        throw new Error('GNOSIS_SAFE_ADDRESS not set in environment');
    }

    const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');
    if (!fs.existsSync(deploymentsPath)) {
        throw new Error('deployments_sepolia.json not found');
    }

    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));

    // Setup provider/signer
    const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`);
    const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);

    const contractsToTransfer = [
        { name: 'RiskRouter', address: deployments.riskRouter },
        { name: 'AgentRegistry', address: deployments.agentRegistry },
        { name: 'ValidationRegistry', address: deployments.validationRegistry }
    ];

    const ownableAbi = ["function transferOwnership(address newOwner) public", "function owner() view returns (address)"];

    for (const item of contractsToTransfer) {
        logger.info({ step: 'TRANSFER_INIT', contract: item.name, address: item.address });
        const contract = new ethers.Contract(item.address, ownableAbi, signer);

        const currentOwner = await contract.owner();
        if (currentOwner.toLowerCase() === gnosisSafeAddress.toLowerCase()) {
            logger.info({ step: 'ALREADY_OWNED', contract: item.name });
            continue;
        }

        const tx = await contract.transferOwnership(gnosisSafeAddress);
        logger.info({ step: 'TRANSFER_SUBMITTED', contract: item.name, txHash: tx.hash });
        await tx.wait();
        logger.info({ step: 'TRANSFER_COMPLETE', contract: item.name });
    }

    logger.info({ step: 'HANDOVER_SUCCESS', message: 'All contracts pending multi-sig acceptance.' });
}

main().catch(console.error);
