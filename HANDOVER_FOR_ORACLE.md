# Handover Guide: Building the Sentinel Web Oracle (Agentic Deep-Dive)

## 🎯 Goal
Build `sentinel-web-oracle` as a high-fidelity **Agentic Threat Microservice**. It must perform autonomous research to detect critical crypto threats (exploits, hacks, regulatory "black swans") using Bright Data's infrastructure.

## 🛠️ Infrastructure Setup (Bright Data)
You need three specialized zones in the Bright Data dashboard:
1.  **SERP API**: `serp_api1` (Format: JSON). Used for high-level headline discovery.
2.  **Web Unlocker**: `web_unlocker1` (Format: RAW). Used for scraping structured data from news archives and blogs while bypassing CAPTCHAs.
3.  **Scraping Browser**: `scraping_browser1`. Used for JS-heavy sites like Twitter/X or TradingView news feeds.

## 🧩 The "Deep-Dive" Agentic Loop
Use a **Tool-Use Loop** (Claude 3.5 Sonnet `claude-sonnet-4-20250514` or GPT-4o) to enable "reasoning" between steps.

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

### 4. Step: Final Synthesis & Verdict (API Contract)
The server must implement a `POST /analyze` endpoint that returns:
```typescript
{
  asset:      string;
  threatLevel: "CRITICAL" | "ELEVATED" | "NOMINAL";
  summary:    string;
  evidence:   { title: string; url: string }[];
  timestamp:  string;
  riskAction: "HOLD" | "MONITOR" | "CLEAR";
  riskReason: string;
}
```

## 🤖 Implementation Code Snippets (Node.js)

### SERP API Implementation
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

## 🔗 Vertex Sentinel Integration Details
- **Oracle Port**: **3008** (Base URL: `http://localhost:3008`)
- **Sentinel Dashboard Port**: 3005
- **Sentinel Socket Server Port**: 3006
- **AgentStack (Sibling) Port**: 3000
- **Logic Hook**: `src/logic/strategy/risk_assessment.ts` is already wired to trigger a `HOLD` if `riskAction === 'HOLD'`.

## 🏆 Hackathon "Winning" Tips
1.  **Conservative by Design**: A false positive (HOLD with no real threat) is better than a missed real attack.
2.  **Transparency**: Always include direct links to the scraped articles in the `evidence` field.
3.  **Speed**: Use parallel tool calls for the initial discovery phase.
