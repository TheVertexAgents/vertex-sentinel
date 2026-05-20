# Monitoring & Alerts - Vertex Sentinel

## Dashboard Overview
The Vertex Sentinel dashboard provides real-time visibility into the agent's risk assessments, trading activity, and system health.

### Terminal View
Displays the master automation toggle, live PnL, and current risk metrics.
![Terminal View](monitoring/terminal_full.png)

### Operations View
Allows for granular control over risk parameters and fleet management.
![Operations View](monitoring/operations_full.png)

### Audit Log
A verifiable trail of all trade intents and on-chain authorizations.
![Audit Log](monitoring/audit_full.png)

## Alerts
The system is configured to send alerts via Telegram for critical events, such as high-risk trade detections or AI quota exhaustion.

### Triggered Alert Example
- **Type**: High Risk Alert
- **Description**: Trade intent rejected due to risk score (0.85) exceeding threshold.
- **Trace ID**: `b8122da7-ab49-5b70-802b-ec1067e6dea7`
- **Timestamp**: 2026-05-20T10:00:00Z
