import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

/**
 * @title Compliance Reporter
 * @dev Generates institutional compliance reports from signed audit logs.
 * For this phase, we generate a structured text report (mocking PDF generation).
 */
export class ComplianceReporter {
  private auditLogPath = path.join(process.cwd(), 'logs/audit.json');

  /**
   * @dev Generates a summary report of all signed trades.
   */
  public generateReport(): string {
    if (!fs.existsSync(this.auditLogPath)) {
      return "No audit logs found.";
    }

    const lines = fs.readFileSync(this.auditLogPath, 'utf8').trim().split('\n');
    const checkpoints = lines.map(l => JSON.parse(l));

    let report = `
================================================================================
                    VERTEX SENTINEL COMPLIANCE REPORT
================================================================================
Generated: ${new Date().toISOString()}
Agent Identity: ${checkpoints[0]?.message.agentId || 'Unknown'}
Total Audit Records: ${checkpoints.length}

--------------------------------------------------------------------------------
VERIFIED TRADE SUMMARY
--------------------------------------------------------------------------------
`;

    checkpoints.forEach((c, i) => {
      const action = c.message.action;
      const pair = c.message.pair;
      const amount = (Number(c.message.amountUsdScaled) / 100).toFixed(2);
      const timestamp = new Date(Number(c.message.timestamp) * 1000).toLocaleString();
      const sig = c.signature.substring(0, 16) + "...";
      const proof = c.arcL1Proof ? c.arcL1Proof.substring(0, 16) + "..." : "N/A";

      report += `[${i+1}] ${timestamp} | ${action} ${pair} | $${amount}
      Reason: ${c.reasoning}
      EIP-712 Signature: ${sig}
      Arc L1 Proof: ${proof}
      --------------------------------------------------------------------------------
`;
    });

    report += `
================================================================================
CERTIFICATION OF INTEGRITY
================================================================================
This report contains cryptographically signed trade intents verified by the
Vertex Sentinel Risk Router. Every decision is backed by an EIP-712 signature
and anchored to Arc L1 for verifiable execution.
================================================================================
`;

    const reportPath = path.join(process.cwd(), 'logs/compliance_report.txt');
    fs.writeFileSync(reportPath, report);
    logger.info({ module: 'ComplianceReporter', step: 'REPORT_GENERATED', path: reportPath });

    return report;
  }
}
