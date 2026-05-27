# Handover Guide: Building the Sentinel Web Oracle (Agentic Version)

## 🎯 Goal
Build the `sentinel-web-oracle` as a standalone **Agentic MCP Server**. It must perform autonomous research to detect critical crypto threats using Bright Data's infrastructure. This serves as the submission for the **Web Data UNLOCKED Hackathon**.

## 🛠️ Infrastructure Setup (Bright Data)
You will need three zones in your Bright Data dashboard:
1.  **SERP API**: For Google News/Search results. (Format: JSON)
2.  **Web Unlocker**: For scraping structured data from sites like Crunchbase or LinkedIn.
3.  **Scraping Browser**: For JS-heavy sites like Twitter/X or complex news portals.

## 🧩 Agentic Research Loop
The Oracle should not just "search"; it should "reason." Implement a tool-use loop (e.g., using Claude or GPT-4o) with the following pattern:

1.  **Search**: Use `search_web(query)` (SERP API) to find headlines.
2.  **Analyze**: The LLM reviews snippets. If a headline looks critical (e.g., "Protocol X exploited for $20M"), it proceeds to step 3.
3.  **Verify**: Use `scrape_url(url)` (Web Unlocker/Browser) to fetch the full article.
4.  **Synthesize**: The LLM determines if the threat is "Active" and "Critical."

### Example Bright Data Payloads (Node.js/Axios)

**SERP Search:**
```json
{
  "zone": "serp_api_zone",
  "url": "https://www.google.com/search?q=BTC+exploit+news&tbs=qdr:h",
  "format": "json"
}
```

**Web Unlocker Scrape:**
```json
{
  "zone": "web_unlocker_zone",
  "url": "https://coindesk.com/policy/...",
  "format": "raw"
}
```

## 🤖 MCP Tool Interface

### `get_threat_report(asset: string)`
- **Input**: `asset` (e.g., "SOL", "USDC")
- **Internal Loop**: Performs 2-3 searches and 1-2 deep scrapes.
- **Output (JSON)**:
    ```json
    {
      "threatLevel": "CRITICAL" | "HIGH" | "LOW" | "NONE",
      "reasoning": "Brief explanation of the finding",
      "evidence": [
        { "title": "...", "url": "...", "timestamp": "..." }
      ]
    }
    ```

## 🔗 Vertex Sentinel Integration
The `vertex-sentinel` project has been prepared with a `WebOracleClient`.
1.  **Implement the MCP Client**: In `src/logic/clients/web_oracle_client.ts`, use the MCP SDK to connect to this new server.
2.  **Enable the Hook**: Set `WEB_ORACLE_ENABLED=true` in `.env`.
3.  **Fail-Closed**: The logic in `src/logic/strategy/risk_assessment.ts` already checks `threatLevel === 'CRITICAL'` to trigger a `HOLD`.

## 💡 System Prompt for Oracle LLM
> "You are the Sentinel Threat Analyst. Your goal is to determine if there is an active technical exploit, regulatory halt, or major security breach affecting [ASSET]. Use the provided tools to search the web and scrape full articles to confirm details. Do not rely on old data. If you find a confirmed exploit from the last 4 hours, set threatLevel to CRITICAL."
