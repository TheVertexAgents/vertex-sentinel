import { api } from './api-client.js';

// Theme Management
const updateThemeIcon = (isDark) => {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    themeToggle.innerHTML = isDark
        ? `<svg class="w-5 h-5 text-gray-400 group-hover:text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M6.343 6.343l.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z"></path></svg>`
        : `<svg class="w-5 h-5 text-gray-400 group-hover:text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
};

// Risk Radar Chart
let riskRadar = null;
function initRiskRadar() {
    const canvas = document.getElementById('risk-radar');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    riskRadar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Market', 'Portfolio', 'Sentiment', 'Manual', 'AI Score'],
            datasets: [{
                label: 'Risk Vector',
                data: [0, 0, 0, 0, 0],
                backgroundColor: 'rgba(0, 229, 255, 0.2)',
                borderColor: '#00E5FF',
                borderWidth: 2,
                pointBackgroundColor: '#00E5FF',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#00E5FF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    pointLabels: { color: '#64748b', font: { size: 10 } },
                    ticks: { display: false, stepSize: 0.2 },
                    suggestedMin: 0,
                    suggestedMax: 1
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function updateRiskRadar(breakdown) {
    if (!riskRadar || !breakdown) return;
    riskRadar.data.datasets[0].data = [
        breakdown.marketRisk,
        breakdown.portfolioRisk,
        breakdown.sentimentRisk,
        breakdown.manualPenalty,
        breakdown.aiScore
    ];
    riskRadar.update();
}

// Gauges and Heatmap
function initHeatmap() {
    const container = document.getElementById('volatility-heatmap');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.className = 'w-full h-full bg-white/5 rounded-sm transition-colors duration-500';
        cell.id = `heatmap-cell-${i}`;
        container.appendChild(cell);
    }
}

function updateGauges(breakdown) {
    if (!breakdown) return;
    const volOffset = 125.6 * (1 - (breakdown.marketRisk || 0));
    const liqOffset = 125.6 * (1 - (breakdown.portfolioRisk || 0));
    const volGauge = document.getElementById('volatility-gauge-path');
    const liqGauge = document.getElementById('volume-gauge-path');
    if (volGauge) volGauge.style.strokeDashoffset = volOffset;
    if (liqGauge) liqGauge.style.strokeDashoffset = liqOffset;
}

function updateHeatmap(value) {
    const index = Math.floor(Math.random() * 100);
    const cell = document.getElementById(`heatmap-cell-${index}`);
    if (!cell) return;
    let color = 'rgba(255, 255, 255, 0.05)';
    if (value > 0.8) color = 'rgba(239, 68, 68, 0.8)';
    else if (value > 0.5) color = 'rgba(245, 158, 11, 0.6)';
    else if (value > 0.2) color = 'rgba(0, 229, 255, 0.4)';
    cell.style.backgroundColor = color;
    setTimeout(() => { if (cell) cell.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }, 3000);
}

// Tab Management
window.switchTab = function(tabId) {
    ['terminal', 'operations', 'audit', 'hitl', 'esg', 'fleet', 'leaderboard'].forEach(t => {
        const view = document.getElementById('view-' + t);
        if (view) view.classList.add('hidden');
        const sideItem = document.getElementById('side-' + t);
        if (sideItem) sideItem.classList.remove('active');
    });
    const targetView = document.getElementById('view-' + tabId);
    if (targetView) targetView.classList.remove('hidden');
    const sideItem = document.getElementById('side-' + tabId);
    if (sideItem) sideItem.classList.add('active');

    if (tabId === 'terminal') {
        try {
            initTradingView();
        } catch (e) {
            console.warn("TradingView init failed:", e);
        }
    }
    if (tabId === 'hitl') {
        const indicator = document.getElementById('hitl-indicator');
        if (indicator) indicator.classList.add('hidden');
    }
    if (tabId === 'leaderboard') {
        refreshLeaderboard();
    }
}

// TradingView
let tvWidget = null;
function initTradingView() {
    if (tvWidget || typeof TradingView === 'undefined') return;
    try {
        tvWidget = new TradingView.widget({
            "autosize": true,
            "symbol": "KRAKEN:BTCUSD",
            "interval": "D",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": false,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "container_id": "tradingview-widget",
            "studies": ["RSI@tv-basicstudies", "MASimple@tv-basicstudies"],
            "backgroundColor": "rgba(11, 14, 20, 0)",
            "gridColor": "rgba(42, 46, 57, 0.06)",
            "hide_volume": true
        });
    } catch (e) {
        console.error("TradingView widget creation failed:", e);
    }
}

// Wallet & Web3
let userAddress = localStorage.getItem('USER_ADDRESS');
let isDemoMode = localStorage.getItem('DEMO_MODE') === 'true';

const RISK_ROUTER_ADDRESS = '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC';
const REGISTRY_ADDRESS = '0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3';

function updateWalletUI(addr) {
    const addrEl = document.getElementById('wallet-address');
    if (addrEl) addrEl.textContent = addr.substring(0, 6) + '...' + addr.substring(38);
    const connectBtn = document.getElementById('connect-wallet');
    const walletStatus = document.getElementById('wallet-status');
    if (connectBtn) connectBtn.classList.add('hidden');
    if (walletStatus) {
        walletStatus.classList.remove('hidden');
        walletStatus.classList.add('flex');
    }
    const networkBadge = document.getElementById('network-badge');
    if (addr.startsWith('0xDEMO') && networkBadge) {
        networkBadge.textContent = 'DEMO MODE';
        networkBadge.className = 'text-[10px] font-bold uppercase tracking-widest text-amber/70';
    }
}

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = provider.getSigner();
            userAddress = await signer.getAddress();
            isDemoMode = false;
            localStorage.setItem('DEMO_MODE', 'false');
            localStorage.setItem('USER_ADDRESS', userAddress);
            updateWalletUI(userAddress);
        } catch (err) {
            console.error("Web3 Connection failed:", err);
            switchToDemo();
        }
    } else {
        switchToDemo();
    }
}

function switchToDemo() {
    isDemoMode = true;
    userAddress = '0xDEMO' + Math.floor(Math.random()*1000000).toString(16).padStart(6, '0');
    localStorage.setItem('DEMO_MODE', 'true');
    localStorage.setItem('USER_ADDRESS', userAddress);
    updateWalletUI(userAddress);
}

// Data Rendering Functions
function updateStats(metrics) {
    if (!metrics) return;
    const savingsEl = document.getElementById('metric-savings');
    if (savingsEl) savingsEl.textContent = '$' + (metrics.sentinelSavings || 0).toLocaleString(undefined, {minimumFractionDigits: 2});

    const pnlEl = document.getElementById('metric-total-pnl');
    if (pnlEl) {
        const val = metrics.totalPnL || 0;
        pnlEl.textContent = (val >= 0 ? '+' : '') + '$' + Math.abs(val).toFixed(2);
        pnlEl.className = 'text-3xl font-bold ' + (val >= 0 ? 'text-emerald glow-emerald' : 'text-crimson');
    }

    const roiEl = document.getElementById('metric-roi');
    if (roiEl) {
        roiEl.textContent = (metrics.roiPercent || 0).toFixed(2) + '%';
        roiEl.className = 'text-xs font-bold ' + (metrics.roiPercent >= 0 ? 'text-emerald' : 'text-crimson');
    }
    const mddEl = document.getElementById('metric-mdd');
    if (mddEl) mddEl.textContent = (metrics.maxDrawdown || 0).toFixed(2) + '%';
    const winrateEl = document.getElementById('metric-winrate');
    if (winrateEl) winrateEl.textContent = (metrics.winRate || 0).toFixed(0) + '%';
    const winlossEl = document.getElementById('metric-winloss');
    if (winlossEl) winlossEl.textContent = (metrics.winLossRatio || 0).toFixed(2);
    const sharpeEl = document.getElementById('metric-sharpe');
    if (sharpeEl) sharpeEl.textContent = (metrics.sharpeRatio || 0).toFixed(2);
}

function renderReasoning(logs) {
    const container = document.getElementById('reasoning-stream');
    if (!container) return;
    container.innerHTML = '';
    logs.slice(0, 3).forEach(log => {
        const card = document.createElement('div');
        card.className = "p-4 glass border-white/5 space-y-3 flex flex-col";
        const actionColor = log.message.action === 'BUY' ? 'text-emerald' : log.message.action === 'SELL' ? 'text-crimson' : 'text-amber';
        const traceId = log.signature ? log.signature.substring(2, 14) : 'UNKNOWN';

        card.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="text-[9px] font-bold uppercase tracking-widest ${actionColor}">${log.message.action} ${log.message.pair}</span>
                <span class="text-[9px] text-gray-600 mono">${new Date(parseInt(log.message.timestamp)*1000).toLocaleTimeString()}</span>
            </div>
            <p class="text-[11px] leading-relaxed text-gray-400 line-clamp-3 mb-2" title="${log.reasoning}">${log.reasoning}</p>
            <div class="mt-auto pt-3 flex justify-between items-center border-t border-white/5">
                <span class="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">Confidence: ${(log.message.confidenceScaled/10).toFixed(1)}%</span>
                <button onclick="openDeepDive('${traceId}', \`${log.reasoning.replace(/"/g, '&quot;')}\`, ${log.riskScore})" class="text-[8px] font-bold text-cyan uppercase hover:underline">Deep Dive →</button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.openDeepDive = function(traceId, reasoning, riskScore) {
    const traceEl = document.getElementById('rd-trace-id');
    const sentimentEl = document.getElementById('rd-sentiment');
    const riskEl = document.getElementById('rd-risk');
    const decisionEl = document.getElementById('rd-decision');
    const modal = document.getElementById('reasoning-modal');

    if (traceEl) traceEl.textContent = 'TRACE: ' + traceId;
    if (sentimentEl) sentimentEl.textContent = riskScore < 0.4 ? 'Strong Bullish' : (riskScore > 0.7 ? 'Strong Bearish' : 'Neutral/Cautious');
    if (riskEl) {
        const displayScore = isNaN(riskScore) ? 0 : riskScore;
        riskEl.textContent = (displayScore * 100).toFixed(1) + '% Exposure';
    }

    const steps = reasoning.split('|').map(s => s.trim()).filter(s => s.length > 0);
    const cotContainer = document.getElementById('rd-cot');
    if (cotContainer) {
        cotContainer.innerHTML = '';
        steps.forEach((step, idx) => {
            const p = document.createElement('p');
            p.className = "mb-3 flex gap-3";
            p.innerHTML = `<span class="text-cyan/40 font-bold">${idx + 1}.</span> <span>${step}</span>`;
            cotContainer.appendChild(p);
        });
    }
    if (decisionEl) decisionEl.textContent = reasoning;
    if (modal) modal.classList.remove('hidden');
}

function renderAuditTable(logs) {
    const body = document.getElementById('log-body');
    if (!body) return;
    body.innerHTML = '';
    logs.forEach(log => {
        const row = document.createElement('tr');
        row.className = "border-b border-white/2 hover:bg-white/2 transition-colors";
        const actionColor = log.message.action === 'BUY' ? 'text-emerald' : log.message.action === 'SELL' ? 'text-crimson' : 'text-amber';
        const amount = (parseFloat(log.message.amountUsdScaled) / 100).toLocaleString(undefined, {style: 'currency', currency: 'USD'});
        const explorerUrl = `https://sepolia.etherscan.io/tx/${log.arcL1Proof}`;
        row.innerHTML = `
            <td class="px-8 py-4 text-gray-500">${new Date(parseInt(log.message.timestamp)*1000).toLocaleString()}</td>
            <td class="px-8 py-4 font-bold ${actionColor}">${log.message.action}</td>
            <td class="px-8 py-4 text-gray-300">${log.message.pair}</td>
            <td class="px-8 py-4 text-right font-bold text-gray-400">${amount}</td>
            <td class="px-8 py-4 text-center">
                ${log.arcL1Proof && log.arcL1Proof !== 'SKIP_AGENTSTACK' ?
                    `<a href="${explorerUrl}" target="_blank" class="text-cyan/60 hover:text-cyan transition-colors flex items-center justify-center gap-1">
                        <span class="mono">${log.arcL1Proof.substring(0,8)}</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>` : '<span class="text-gray-700">—</span>'}
            </td>
            <td class="px-8 py-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-cyan/5 text-cyan text-[9px] font-bold border border-cyan/20">EIP-712</span>
                </div>
            </td>
            <td class="px-8 py-4 text-gray-500 truncate max-w-xs" title="${log.reasoning}">${log.reasoning}</td>
        `;
        body.appendChild(row);
    });
}

function updateCircuitBreaker(log) {
    if (!log || !log.pnl || !log.pnl.onchainRisk) return;
    const risk = log.pnl.onchainRisk;
    const pnl = log.pnl;
    const maxPos = parseFloat(risk.maxPositionUsdScaled) / 100;
    const currentPos = (pnl.totalExposureUsd || 0);
    const posPerc = Math.min(100, Math.max(5, (Math.abs(currentPos) / maxPos) * 100));
    const posBar = document.getElementById('cb-pos-bar');
    const posText = document.getElementById('cb-pos-text');
    if (posBar) posBar.style.width = posPerc + '%';
    if (posText) posText.textContent = `$${Math.abs(currentPos).toFixed(0)} / $${maxPos.toLocaleString()}`;

    const maxTrades = parseInt(risk.maxTradesPerHour);
    const currentTrades = (pnl.totalTrades % maxTrades);
    const volPerc = (currentTrades / maxTrades) * 100;
    const volBar = document.getElementById('cb-vol-bar');
    const volText = document.getElementById('cb-vol-text');
    if (volBar) volBar.style.width = volPerc + '%';
    if (volText) volText.textContent = `${currentTrades} / ${maxTrades} trades`;
}

// Leaderboard Logic
async function refreshLeaderboard() {
    try {
        const response = await api.fetchLeaderboard(1, 10);
        renderLeaderboard(response.data);
    } catch (e) {
        console.error("Leaderboard refresh failed:", e);
    }
}

function renderLeaderboard(data) {
    const body = document.getElementById('leaderboard-body');
    if (!body) return;
    body.innerHTML = '';

    if (data.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="px-8 py-12 text-center text-gray-600 italic">No agent data found on-chain.</td></tr>';
        return;
    }

    const localAgentId = localStorage.getItem('AGENT_ID') || '42';

    data.forEach((agent, index) => {
        const row = document.createElement('tr');
        const isLocal = agent.agentId == localAgentId;
        row.className = `border-b border-white/2 hover:bg-white/2 transition-colors ${isLocal ? 'bg-cyan/5 border-l-2 border-l-cyan' : ''}`;

        row.innerHTML = `
            <td class="px-8 py-4 ${isLocal ? 'text-cyan font-black' : 'text-gray-500'}">#${index + 1}</td>
            <td class="px-8 py-4 font-bold ${isLocal ? 'text-cyan' : 'text-gray-300'}">Agent #${agent.agentId} ${isLocal ? '<span class="text-[8px] bg-cyan/10 px-1 ml-1 rounded">LOCAL</span>' : ''}</td>
            <td class="px-8 py-4 text-center font-bold ${agent.reputationScore >= 80 ? 'text-emerald' : 'text-amber'}">${agent.reputationScore}</td>
            <td class="px-8 py-4 text-center text-gray-400">${agent.totalTrades}</td>
            <td class="px-8 py-4 text-right font-bold ${agent.pnlBps >= 0 ? 'text-emerald' : 'text-crimson'}">${agent.pnlBps >= 0 ? '+' : ''}${agent.pnlBps}</td>
            <td class="px-8 py-4 text-center">
                <span class="px-2 py-0.5 rounded bg-emerald/10 text-emerald text-[9px] font-bold uppercase">${agent.status}</span>
            </td>
        `;
        body.appendChild(row);
    });
}

// HITL Logic
window.hitlApprove = function(traceId) {
    api.emit('hitl.approve', { traceId });
    removeHitlCard(traceId);
}
window.hitlReject = function(traceId) {
    api.emit('hitl.reject', { traceId, reason: 'Rejected by operator via dashboard' });
    removeHitlCard(traceId);
}
function removeHitlCard(traceId) {
    const card = document.getElementById(`hitl-${traceId}`);
    if (card) {
        card.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            card.remove();
            const container = document.getElementById('hitl-container');
            if (container && container.children.length === 0) {
                container.innerHTML = `<div class="text-gray-600 text-xs italic p-12 text-center border border-dashed border-white/5 rounded-xl">No pending high-stakes trade authorizations...</div>`;
            }
        }, 300);
    }
}
function renderHitlRequest(data) {
    const container = document.getElementById('hitl-container');
    if (!container) return;
    if (container.querySelector('div.italic')) container.innerHTML = '';
    const card = document.createElement('div');
    card.id = `hitl-${data.traceId}`;
    card.className = "glass p-8 border-amber/30 bg-gradient-to-r from-amber/5 to-transparent flex flex-col md:flex-row justify-between items-center gap-8 animate-in fade-in slide-in-from-top-4 duration-500";
    card.innerHTML = `
        <div class="flex-grow space-y-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-amber/10 flex items-center justify-center border border-amber/30 text-amber">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <div>
                    <span class="px-2 py-0.5 bg-amber/20 text-amber text-[9px] font-bold rounded uppercase tracking-widest">Intercepted: High Stakes</span>
                    <h4 class="text-lg font-black italic tracking-tighter text-white mt-1">${data.action} ${data.pair} <span class="text-amber/50">— $${data.amountUsd.toFixed(2)}</span></h4>
                </div>
            </div>
            <div class="p-4 bg-white/5 rounded-xl border border-white/10">
                <p class="text-xs text-gray-400 font-medium leading-relaxed italic">"${data.reasoning}"</p>
            </div>
            <div class="flex gap-6 text-[9px] text-gray-500 uppercase font-black tracking-widest mono">
                <span class="flex items-center gap-2"><span class="w-1 h-1 rounded-full bg-gray-700"></span> TRACE: ${data.traceId.substring(0,12)}</span>
            </div>
        </div>
        <div class="flex flex-col gap-3 shrink-0 w-full md:w-48">
            <button onclick="hitlApprove('${data.traceId}')" class="w-full py-4 bg-emerald text-obsidian text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-emerald/20">Approve</button>
            <button onclick="hitlReject('${data.traceId}')" class="w-full py-3 bg-white/5 hover:bg-white/10 text-crimson text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all border border-crimson/20">Reject</button>
        </div>
    `;
    container.prepend(card);
}

// UI Initialization & Automation Toggle
function updateAutomationUI(enabled) {
    const statusText = document.getElementById('status-text');
    const overlay = document.getElementById('paused-overlay');
    const toggle = document.getElementById('automation-toggle');
    if (toggle) toggle.checked = enabled;
    if (statusText) {
        if (enabled) {
            statusText.textContent = 'System Live';
            statusText.className = 'text-[10px] font-bold uppercase tracking-widest text-emerald/80';
        } else {
            statusText.textContent = 'System Paused';
            statusText.className = 'text-[10px] font-bold uppercase tracking-widest text-amber/80';
        }
    }
    if (overlay) {
        if (enabled) overlay.classList.add('hidden');
        else overlay.classList.remove('hidden');
    }
}

// Initial Data Loading
async function initialLoad() {
    try {
        const [agent, pnl, audit, automation] = await Promise.all([
            api.fetchAgent().catch(() => ({ agentId: '?' })),
            api.fetchPnL().catch(() => ({})),
            api.fetchAudit(1, 50).catch(() => ({ logs: [] })),
            api.fetchAutomation().catch(() => ({ enabled: false }))
        ]);

        const agentIdEl = document.getElementById('agent-id-display');
        if (agentIdEl) agentIdEl.textContent = 'Agent #' + agent.agentId;

        updateStats(pnl);
        renderReasoning(audit.logs);
        renderAuditTable(audit.logs);
        updateAutomationUI(automation.enabled);

        if (audit.logs[0]) {
            updateRiskRadar(audit.logs[0].breakdown);
            updateHeatmap(audit.logs[0].riskScore);
            updateCircuitBreaker(audit.logs[0]);
            updateGauges(audit.logs[0].breakdown);
        }
    } catch (err) {
        console.error('Initial data load failed:', err);
    }
}

// Main Application Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Wrap initializers in try/catch to prevent failure propagation
    try { initRiskRadar(); } catch (e) { console.warn("Risk radar skipped:", e); }
    try { initHeatmap(); } catch (e) { console.warn("Heatmap skipped:", e); }
    try { initTradingView(); } catch (e) { console.warn("TradingView skipped:", e); }

    try {
        api.initSocket();
    } catch(e) {
        console.error("Socket failed", e);
    }

    // Element bindings
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('THEME', isDark ? 'dark' : 'light');
            updateThemeIcon(isDark);
        });
        if (localStorage.getItem('THEME') === 'dark') {
            document.body.classList.add('dark-theme');
        }
        updateThemeIcon(document.body.classList.contains('dark-theme'));
    }

    const connectBtn = document.getElementById('connect-wallet');
    if (connectBtn) {
        connectBtn.addEventListener('click', connectWallet);
        if (userAddress) updateWalletUI(userAddress);
    }

    const automationToggle = document.getElementById('automation-toggle');
    if (automationToggle) {
        automationToggle.addEventListener('change', async (e) => {
            try {
                await api.toggleAutomation(e.target.checked);
                updateAutomationUI(e.target.checked);
            } catch (err) {
                console.error(err);
                e.target.checked = !e.target.checked;
            }
        });
    }

    const closeReasoningBtn = document.getElementById('close-reasoning-modal');
    if (closeReasoningBtn) {
        closeReasoningBtn.addEventListener('click', () => {
            const modal = document.getElementById('reasoning-modal');
            if (modal) modal.classList.add('hidden');
        });
    }

    const sessionReportBtn = document.getElementById('session-report-btn');
    if (sessionReportBtn) {
        sessionReportBtn.addEventListener('click', async () => {
            const pnlModal = document.getElementById('pnl-modal');
            const statusBanner = document.getElementById('report-status-banner');
            if (pnlModal) pnlModal.classList.remove('hidden');
            if (statusBanner) statusBanner.textContent = 'FETCHING...';
            try {
                const metrics = await api.fetchPnL();
                const sessionIdEl = document.getElementById('report-session-id');
                const realizedEl = document.getElementById('report-realized');
                const winrateEl = document.getElementById('report-winrate');
                const mddEl = document.getElementById('report-mdd');
                const savingsEl = document.getElementById('report-savings');

                if (sessionIdEl) sessionIdEl.textContent = 'SESSION: ' + (metrics.sessionId || 'ACTIVE');
                if (realizedEl) realizedEl.textContent = '$' + (metrics.totalPnL || 0).toFixed(2);
                if (winrateEl) winrateEl.textContent = (metrics.winRate || 0).toFixed(0) + '%';
                if (mddEl) mddEl.textContent = (metrics.maxDrawdown || 0).toFixed(2) + '%';
                if (savingsEl) savingsEl.textContent = '$' + (metrics.sentinelSavings || 0).toFixed(2);

                if (statusBanner) {
                    statusBanner.textContent = 'LIVE';
                    statusBanner.className = 'px-6 py-2 rounded-full font-black uppercase tracking-widest text-xs bg-emerald/20 text-emerald';
                }
            } catch (e) {
                if (statusBanner) statusBanner.textContent = 'ERROR';
            }
        });
    }

    const closePnlBtn = document.getElementById('close-pnl-modal');
    if (closePnlBtn) {
        closePnlBtn.addEventListener('click', () => {
            const modal = document.getElementById('pnl-modal');
            if (modal) modal.classList.add('hidden');
        });
    }

    const hireBtns = [document.getElementById('hire-agent-btn'), document.getElementById('hire-agent-fleet-btn')];
    hireBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                const modal = document.getElementById('hire-modal');
                if (modal) modal.classList.remove('hidden');
            });
        }
    });

    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            const modal = document.getElementById('hire-modal');
            if (modal) modal.classList.add('hidden');
        });
    }

    const confirmHireBtn = document.getElementById('confirm-hire-btn');
    if (confirmHireBtn) {
        confirmHireBtn.addEventListener('click', () => {
            alert("Hiring sequence initiated on Arc L1. Waiting for validator attestations...");
            const modal = document.getElementById('hire-modal');
            if (modal) modal.classList.add('hidden');
        });
    }

    // Socket Event Handlers
    api.on('connect', () => {
        const indicator = document.getElementById('status-indicator');
        if (indicator) {
            indicator.classList.remove('bg-amber');
            indicator.classList.add('bg-emerald');
        }
    });

    api.on('disconnect', () => {
        const indicator = document.getElementById('status-indicator');
        if (indicator) {
            indicator.classList.remove('bg-emerald');
            indicator.classList.add('bg-amber');
        }
    });

    api.on('automation.sync', (data) => updateAutomationUI(data.enabled));
    api.on('balance.update', (data) => updateStats(data.pnl));
    api.on('hitl.pending', (data) => {
        renderHitlRequest(data);
        const indicator = document.getElementById('hitl-indicator');
        if (indicator) indicator.classList.remove('hidden');
    });
    api.on('risk.update', (data) => {
        updateRiskRadar(data.breakdown);
        updateHeatmap(data.riskScore);
        updateGauges(data.breakdown);
    });

    api.on('leaderboard.update', (data) => {
        if (Array.isArray(data)) {
            renderLeaderboard(data);
        } else if (data.data) {
            renderLeaderboard(data.data);
        }
    });

    // Start initial load
    initialLoad();

    // Periodic Refresh
    setInterval(async () => {
        try {
            const pnl = await api.fetchPnL();
            updateStats(pnl);
        } catch (_) {}
    }, 10000);
});
