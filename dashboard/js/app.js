/**
 * Vertex Sentinel — Core Dashboard Logic
 * High-fidelity real-time data orchestration and institutional UI management.
 */

// Global State
let socket;
let currentTab = 'terminal';
let riskRadarChart = null;
let isAutomationEnabled = false;

// Institutional Color Palette
const COLORS = {
    cyan: '#00e5ff',
    amber: '#ffb300',
    emerald: '#10b981',
    crimson: '#ef4444',
    purple: '#7c3aed',
    slate: {
        500: '#64748b',
        700: '#334155',
        900: '#0f172a'
    },
    obsidian: '#0b0e14'
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initSocket();
    initUIControls();
    initRiskRadar();
    initVolatilityHeatmap();
    pollAgentStatus();
});

// --- Theme Management ---

function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    // Default to light if no preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        const newTheme = isDark ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

function applyTheme(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-mode');
        document.documentElement.classList.add('dark'); // For Tailwind
        themeToggle.innerHTML = `<svg class="w-5 h-5 text-cyan" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fill-rule="evenodd" clip-rule="evenodd"></path></svg>`;
    } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-mode');
        document.documentElement.classList.remove('dark'); // For Tailwind
        themeToggle.innerHTML = `<svg class="w-5 h-5 text-gray-400 group-hover:text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M6.343 6.343l.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z"></path></svg>`;
    }
    // Update charts if they exist
    if (riskRadarChart) {
        initRiskRadar();
    }
}

// --- Navigation ---

function initTabs() {
    window.switchTab = (tabId) => {
        // Hide all views
        document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
        // Remove active class from nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        // Show target
        document.getElementById(`view-${tabId}`).classList.remove('hidden');
        document.getElementById(`side-${tabId}`).classList.add('active');
        currentTab = tabId;

        if (tabId === 'terminal') initTradingView();
    };
    initTradingView();
}

// --- Real-time Data ---

function initSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Institutional Data Stream Connected');
    });

    socket.on('agent.metadata', (metadata) => {
        document.getElementById('agent-id-display').textContent = `Agent #${metadata.id || '42'}`;
        document.getElementById('network-badge').textContent = metadata.network || 'Sepolia Testnet';
    });

    socket.on('risk.update', (data) => {
        updateRiskMetrics(data);
        if (data.decision) addReasoningCard(data);
    });

    socket.on('fleet.update', (data) => {
        document.getElementById('fleet-active-count').textContent = data.activeCount || '1';
    });

    socket.on('automation.state', (state) => {
        isAutomationEnabled = state.enabled;
        document.getElementById('automation-toggle').checked = isAutomationEnabled;
        updateAutomationUI();
    });
}

function updateRiskMetrics(data) {
    if (data.pnl) {
        document.getElementById('metric-total-pnl').textContent = `$${data.pnl.total.toFixed(2)}`;
        document.getElementById('metric-total-pnl').className = `text-3xl font-bold ${data.pnl.total >= 0 ? 'text-emerald' : 'text-crimson'}`;
        document.getElementById('metric-roi').textContent = `${data.pnl.roi >= 0 ? '+' : ''}${data.pnl.roi.toFixed(2)}%`;
        document.getElementById('metric-roi').className = `text-xs font-bold ${data.pnl.roi >= 0 ? 'text-emerald' : 'text-crimson'}`;
    }

    if (data.drawdown) {
        document.getElementById('metric-mdd').textContent = `${data.drawdown.toFixed(2)}%`;
    }

    if (data.savings) {
        document.getElementById('metric-savings').textContent = `$${data.savings.toFixed(2)}`;
    }

    // Update Radar
    if (riskRadarChart && data.breakdown) {
        riskRadarChart.data.datasets[0].data = [
            data.breakdown.market || 0,
            data.breakdown.portfolio || 0,
            data.breakdown.sentiment || 0,
            data.breakdown.manual || 0,
            data.breakdown.ai || 0
        ];
        riskRadarChart.update();
    }
}

// --- Visualizations ---

function initRiskRadar() {
    const ctx = document.getElementById('risk-radar').getContext('2d');
    if (riskRadarChart) riskRadarChart.destroy();

    const isDark = document.body.classList.contains('dark-theme');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const labelColor = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';

    riskRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Market', 'Portfolio', 'Sentiment', 'Manual', 'AI Score'],
            datasets: [{
                label: 'Risk Exposure',
                data: [65, 40, 30, 20, 80],
                backgroundColor: 'rgba(0, 229, 255, 0.2)',
                borderColor: COLORS.cyan,
                borderWidth: 2,
                pointBackgroundColor: COLORS.cyan,
                pointHoverBorderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: gridColor },
                    grid: { color: gridColor },
                    pointLabels: { color: labelColor, font: { size: 9, weight: 'bold' } },
                    ticks: { display: false },
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function initVolatilityHeatmap() {
    const container = document.getElementById('volatility-heatmap');
    container.innerHTML = '';
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.className = 'w-full h-full bg-cyan/5 rounded-[1px]';
        // Random opacity for mock effect
        cell.style.opacity = Math.random() * 0.8 + 0.1;
        container.appendChild(cell);
    }
}

function initTradingView() {
    try {
        new TradingView.widget({
            "autosize": true,
            "symbol": "BINANCE:BTCUSDT",
            "interval": "60",
            "timezone": "Etc/UTC",
            "theme": document.body.classList.contains('dark-theme') ? "dark" : "light",
            "style": "1",
            "locale": "en",
            "toolbar_bg": "transparent",
            "enable_publishing": false,
            "hide_side_toolbar": true,
            "allow_symbol_change": true,
            "container_id": "tradingview-widget",
            "backgroundColor": "transparent"
        });
    } catch (e) {
        console.warn("TradingView failed to load", e);
    }
}

// --- UI Controls ---

function initUIControls() {
    const automationToggle = document.getElementById('automation-toggle');
    automationToggle.addEventListener('change', (e) => {
        isAutomationEnabled = e.target.checked;
        socket.emit('automation.toggle', { enabled: isAutomationEnabled });
        updateAutomationUI();
    });

    document.getElementById('session-report-btn').addEventListener('click', showPnLReport);
    document.getElementById('close-pnl-modal').addEventListener('click', () => {
        document.getElementById('pnl-modal').classList.add('hidden');
    });

    // Slider updates
    const sliders = ['max-pos', 'max-trades', 'sent-weight', 'liq-floor'];
    sliders.forEach(id => {
        const slider = document.getElementById(`slider-${id}`);
        const display = document.getElementById(`val-${id}`);
        if (slider && display) {
            slider.addEventListener('input', (e) => {
                let val = e.target.value;
                if (id === 'max-pos') display.textContent = `$${Number(val).toLocaleString()}`;
                else if (id === 'liq-floor') display.textContent = `$${Number(val)/1000}k`;
                else display.textContent = val;
            });
        }
    });

    document.getElementById('update-risk-btn').addEventListener('click', () => {
        const params = {
            maxPosition: document.getElementById('slider-max-pos').value,
            maxTrades: document.getElementById('slider-max-trades').value,
            sentimentWeight: document.getElementById('slider-sent-weight').value,
            liquidityFloor: document.getElementById('slider-liq-floor').value
        };
        socket.emit('risk.params.update', params);
        alert('Institutional Guardrails Updated');
    });
}

function updateAutomationUI() {
    const overlay = document.getElementById('paused-overlay');
    const statusDot = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');

    if (isAutomationEnabled) {
        overlay.classList.add('hidden');
        statusDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald animate-pulse';
        statusText.textContent = 'System Active';
        statusText.className = 'text-[10px] font-bold uppercase tracking-widest text-emerald';
    } else {
        overlay.classList.remove('hidden');
        statusDot.className = 'w-1.5 h-1.5 rounded-full bg-amber animate-pulse-emerald';
        statusText.textContent = 'System Paused';
        statusText.className = 'text-[10px] font-bold uppercase tracking-widest text-amber';
    }
}

function addReasoningCard(data) {
    const stream = document.getElementById('reasoning-stream');
    if (stream.children[0] && stream.children[0].innerText.includes('Awaiting')) stream.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'glass p-5 border-white/5 animate-in slide-in-from-bottom-4 duration-500';
    card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <span class="text-[9px] font-bold text-gray-500 mono uppercase tracking-widest">${new Date().toLocaleTimeString()}</span>
            <span class="px-2 py-0.5 bg-cyan/10 text-cyan text-[8px] font-bold rounded uppercase">Signed Decision</span>
        </div>
        <p class="text-[11px] font-bold text-white leading-tight mb-4">${data.decision.justification || 'Analyzing market equilibrium...'}</p>
        <div class="flex justify-between items-center">
             <div class="flex gap-2">
                <span class="text-[8px] px-1.5 py-0.5 bg-white/5 rounded text-gray-400 uppercase font-bold tracking-tighter">Confidence: ${(data.decision.confidence * 100).toFixed(0)}%</span>
             </div>
             <button onclick="showReasoningDeepDive('${data.traceId || '42'}')" class="text-[9px] font-black italic text-cyan hover:underline uppercase tracking-widest">Deep Dive →</button>
        </div>
    `;
    stream.prepend(card);
    if (stream.children.length > 3) stream.lastChild.remove();
}

async function showPnLReport() {
    const modal = document.getElementById('pnl-modal');
    modal.classList.remove('hidden');

    try {
        const response = await fetch('/api/pnl');
        const data = await response.json();

        document.getElementById('report-session-id').textContent = `SESSION: ${data.sessionId || 'SESS-2026'}`;
        document.getElementById('report-realized').textContent = `$${data.realizedPnL >= 0 ? '+' : ''}${data.realizedPnL.toFixed(2)}`;
        document.getElementById('report-winrate').textContent = `${data.winRate.toFixed(2)}%`;
        document.getElementById('report-mdd').textContent = `${data.maxDrawdown.toFixed(2)}%`;
        document.getElementById('report-savings').textContent = `$${data.savings.toFixed(2)}`;

        const banner = document.getElementById('report-status-banner');
        if (data.realizedPnL > 0) {
            banner.className = 'px-6 py-2 rounded-full font-black uppercase tracking-widest text-xs bg-emerald/10 text-emerald border border-emerald/20';
            banner.textContent = 'PROFITABLE SESSION';
        } else {
            banner.className = 'px-6 py-2 rounded-full font-black uppercase tracking-widest text-xs bg-crimson/10 text-crimson border border-crimson/20';
            banner.textContent = 'DEFENSIVE SESSION';
        }
    } catch (e) {
        console.error('Failed to load PnL report', e);
    }
}

window.showReasoningDeepDive = (traceId) => {
    document.getElementById('reasoning-modal').classList.remove('hidden');
    document.getElementById('rd-trace-id').textContent = `TRACE: ${traceId}`;
    // Mock deep dive for now
    document.getElementById('rd-cot').innerHTML = `
        <div class="space-y-2">
            <p>1. Ingesting Kraken Orderbook for BTC/USDT...</p>
            <p>2. Sentimental Overlay: Positive momentum detected in institutional news stream (+0.82).</p>
            <p>3. Risk Calculus: Current volatility at 4.2%, well within EIP-712 guardrails.</p>
            <p>4. Strategic Inference: Weighted decision favors accumulation before anticipated resistance breakout.</p>
        </div>
    `;
};

document.getElementById('close-reasoning-modal').addEventListener('click', () => {
    document.getElementById('reasoning-modal').classList.add('hidden');
});

function pollAgentStatus() {
    setInterval(async () => {
        try {
            const res = await fetch('/api/agent');
            const data = await res.json();
            // Update any dynamic status here
        } catch (e) {}
    }, 5000);
}
