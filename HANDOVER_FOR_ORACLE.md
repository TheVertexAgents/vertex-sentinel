# Handover Guide: Building the Sentinel Web Oracle (Agentic Deep-Dive)

## 🎯 Goal
Build `sentinel-web-oracle` as a high-fidelity **Agentic MCP Server**. It must perform autonomous research to detect critical crypto threats (exploits, hacks, regulatory "black swans") using Bright Data's infrastructure.

## 🛠️ Infrastructure Setup (Bright Data)
You need three specialized zones in the Bright Data dashboard:
1.  **SERP API**: `serp_api1` (Format: JSON). Used for high-level headline discovery.
2.  **Web Unlocker**: `web_unlocker1` (Format: RAW). Used for scraping structured data from news archives and blogs while bypassing CAPTCHAs.
3.  **Scraping Browser**: `scraping_browser1`. Used for JS-heavy sites like Twitter/X or TradingView news feeds.

## 🧩 The "Deep-Dive" Agentic Loop
Do not implement a simple linear script. Use a **Tool-Use Loop** (Claude 3.5 Sonnet or GPT-4o) to enable "reasoning" between steps.

### 1. Step: Disambiguation & Search
The agent should first search to confirm the asset's canonical name.
- **Tool**: `search_web(query)`
- **Query**: `"What is the official Twitter and news source for [ASSET] protocol?"`
- **Logic**: This prevents the agent from confusing "Linear" (the protocol) with "Linear" (the mathematical concept).

### 2. Step: Multi-Angle Discovery
The agent fires parallel searches to cover different risk vectors.
- **Tool**: `search_web(query)`
- **Queries**:
    - `"[ASSET] + exploit news last 24h"`
    - `"[ASSET] + SEC enforcement"`
    - `"[ASSET] + flash loan attack"`

### 3. Step: Deep Scrape & Verification
For every suspicious headline, the agent **must** read the full page.
- **Tool**: `scrape_url(url)`
- **Logic**: Use the **Web Unlocker** or **Scraping Browser** to extract the article text.
- **Validation**: The LLM compares the article text against known attack patterns.

### 4. Step: Final Synthesis & Verdict
- **Logic**: If the agent finds a confirmed technical vulnerability or a regulatory "Cease and Desist" with a timestamp < 4 hours old, it returns `threatLevel: "CRITICAL"`.

## 🤖 Implementation Code Snippets

### SERP API Implementation (Node.js)
```typescript
async function searchWeb(query: string) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbs=qdr:h`;
    const response = await axios.post('https://api.brightdata.com/request', {
        zone: process.env.SERP_ZONE,
        url: searchUrl,
        format: 'json'
    }, {
        headers: { 'Authorization': `Bearer ${process.env.BRIGHTDATA_API_KEY}` }
    });
    const body = JSON.parse(response.data.body);
    return body.organic.slice(0, 5).map(r => `${r.title}: ${r.url}\n${r.description}`).join('\n---\n');
}
```

### Web Unlocker Implementation (Node.js)
```typescript
async function scrapeUrl(url: string) {
    const response = await axios.post('https://api.brightdata.com/request', {
        zone: process.env.UNLOCKER_ZONE,
        url: url,
        format: 'raw'
    }, {
        headers: { 'Authorization': `Bearer ${process.env.BRIGHTDATA_API_KEY}` }
    });
    // Strip HTML tags and scripts
    return response.data.replace(/<script[^>]*>.*?<\/script>/gs, '').replace(/<[^>]+>/g, ' ').substring(0, 5000);
}
```

## 🔗 Vertex Sentinel Integration Details
- **Port**: The oracle server should run on **port 3008** (to avoid conflict with Sentinel Dashboard on 3005 and Socket Server on 3006).
- **Client**: `src/logic/clients/web_oracle_client.ts` is pre-configured to point to `http://localhost:3008`.
- **Logic Hook**: `src/logic/strategy/risk_assessment.ts` is already wired to trigger a `HOLD` if `threatLevel === 'CRITICAL'`.

## 🏆 Hackathon "Winning" Tips
1.  **Transparency**: In the MCP tool output, always include the `evidence` array with direct links to the scraped articles.
2.  **Speed**: Use parallel tool calls for the initial discovery phase.
3.  **Safety**: Implement a "System Prompt" that instructs the agent to be extremely conservative—false positives for "CRITICAL" are better than missed hacks.
