# 🛠️ Recording Environment Setup Guide

To record the professional investor video using `scripts/record_investor_demo.py`, ensure the following environment is prepared.

## 1. Dependent Applications
The recording script expects the dashboard to be served on port `3005`.

```bash
# Start the dashboard server
npm run dashboard
```

To have "live" data in the audit trail and metrics cards, the agent should be running in Paper Mode or a previous E2E test should have been executed to generate `logs/audit.json` and `logs/pnl_report.json`.

```bash
# Optional: Run E2E test to populate data
npm run test:e2e
```

## 2. Environment Variables
If running the agent live during recording, the following variables are required in `.env`:

*   `KRAKEN_PAPER_MODE=true` (Ensures safe, mock execution for the demo)
*   `AI_PROVIDER=groq` or `google`
*   `GROQ_API_KEY` or `GOOGLE_GENAI_API_KEY`
*   `SENTINEL_PORT=3006` (Socket server for real-time updates)

## 3. Recording Workflow
1. Start the **Dashboard**: `npm run dashboard`
2. Start the **Socket Server** (via `npm start` or `npm run demo`): This allows the "System Live" indicator to turn green.
3. Execute the recording script:
   ```bash
   python scripts/record_investor_demo.py
   ```

## 4. Visual Inspection
Check `home/jules/verification/videos` for the `.webm` output and `home/jules/verification/screenshots` for key frame captures.
