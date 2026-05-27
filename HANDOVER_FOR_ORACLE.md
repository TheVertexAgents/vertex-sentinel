# Handover Guide: Building the Sentinel Web Oracle

## 🎯 Goal
Create a standalone MCP Server called `sentinel-web-oracle` for the **Web Data UNLOCKED Hackathon (Track 3: Security & Compliance)**. This server will provide live "Threat Intelligence" to the `vertex-sentinel` trading agent using Bright Data's infrastructure.

## 🛠️ Project Setup
1.  **Directory**: `../sentinel-web-oracle` (Initialize as a separate git repository).
2.  **Environment**: Node.js, TypeScript, Model Context Protocol (MCP) SDK.
3.  **Bright Data Credentials**: (To be provided by the operator in `.env`)
    - `BRIGHTDATA_API_KEY`
    - `BRIGHTDATA_SERP_ZONE`
    - `BRIGHTDATA_SCRAPER_ZONE`

## 🧩 Required MCP Tools

### 1. `get_web_threats(asset: string)`
- **Technology**: Bright Data **SERP API**.
- **Source**: Google News / Bing.
- **Query Pattern**: `[asset] + "exploit" OR "hack" OR "vulnerability" OR "SEC investigation"`.
- **Reasoning**: If a critical news item is found with a timestamp < 2 hours old, return `threatLevel: "CRITICAL"`.

### 2. `verify_news_integrity(url: string)`
- **Technology**: Bright Data **Scraping Browser**.
- **Action**: Visit the provided URL and extract the full article body.
- **Analysis**: Use an LLM to determine if the article confirms a live technical threat or if it is just general market sentiment.

### 3. `regulatory_monitor()`
- **Technology**: Bright Data **Web Scraper API**.
- **Sources**:
    - `https://www.sec.gov/news/pressreleases`
    - `https://www.cftc.gov/PressRoom/PressReleases/index.htm`
- **Keyword Match**: `crypto`, `stablecoin`, `enforcement`, `exchange`.

## 🔗 Integration into Vertex Sentinel
1.  **Config**: Set `WEB_ORACLE_ENABLED=true` in `.env`.
2.  **Client**: A placeholder client has been created at `src/logic/clients/web_oracle_client.ts`. You must implement the MCP connection logic inside this class.
3.  **Logic**: `src/logic/strategy/risk_assessment.ts` has been pre-hooked to use `webThreatRisk`. You need to uncomment the call to `WebOracleClient.getThreats(baseAsset)`.
3.  **Fail-Closed Action**: If Oracle returns `threatLevel: "CRITICAL"`, the Sentinel **MUST** return `action: 'HOLD'`.

## 🏆 Hackathon Submission Criteria
- Must demonstrably use at least one Bright Data product (we are using three).
- Must solve a real enterprise problem (Institutional Risk Compliance).
- Must include a public GitHub repository for `sentinel-web-oracle`.
