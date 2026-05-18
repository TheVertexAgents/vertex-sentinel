import { test, expect, Page } from '@playwright/test';

/**
 * Injects a visual mouse tracker into the page to make clicks and movements
 * visible in the recorded video. High-fidelity version for marketing.
 */
async function injectMouseTracker(page: Page) {
  await page.addInitScript(() => {
    const container = document.createElement('div');
    container.id = 'mouse-tracker';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '35px';
    container.style.height = '35px';
    container.style.borderRadius = '50%';
    container.style.backgroundColor = 'rgba(0, 229, 255, 0.2)';
    container.style.border = '2px solid rgba(0, 229, 255, 0.8)';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999999';
    container.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.3s, border-width 0.2s';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.boxShadow = '0 0 25px rgba(0, 229, 255, 0.5)';

    // Pulse effect
    const pulse = document.createElement('div');
    pulse.style.position = 'absolute';
    pulse.style.top = '50%';
    pulse.style.left = '50%';
    pulse.style.width = '100%';
    pulse.style.height = '100%';
    pulse.style.borderRadius = '50%';
    pulse.style.border = '1px solid #00e5ff';
    pulse.style.transform = 'translate(-50%, -50%)';
    pulse.style.animation = 'mouse-pulse 2.5s infinite';
    container.appendChild(pulse);

    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes mouse-pulse {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
        100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
      }
      #step-overlay {
        font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
    `;
    document.head.appendChild(style);
    document.documentElement.appendChild(container);

    window.addEventListener('mousemove', (e) => {
      container.style.left = `${e.clientX}px`;
      container.style.top = `${e.clientY}px`;
    });

    window.addEventListener('mousedown', () => {
      container.style.backgroundColor = 'rgba(255, 0, 128, 0.6)';
      container.style.borderColor = '#ff0080';
      container.style.transform = 'translate(-50%, -50%) scale(0.6)';
      container.style.boxShadow = '0 0 40px rgba(255, 0, 128, 0.8)';
    });

    window.addEventListener('mouseup', () => {
      container.style.backgroundColor = 'rgba(0, 229, 255, 0.2)';
      container.style.borderColor = 'rgba(0, 229, 255, 0.8)';
      container.style.transform = 'translate(-50%, -50%) scale(1)';
      container.style.boxShadow = '0 0 25px rgba(0, 229, 255, 0.5)';
    });
  });
}

/**
 * Displays a cinematic floating step annotation for marketing video storytelling.
 */
async function showStep(page: Page, title: string, description: string, duration: number = 15000) {
  console.log(`SCENE START: ${title} (${duration}ms)`);
  await page.evaluate(({ title, description, duration }) => {
    const existing = document.getElementById('step-overlay');
    if (existing) {
        existing.style.opacity = '0';
        existing.style.transform = 'translateY(40px)';
        setTimeout(() => existing.remove(), 800);
    }

    const overlay = document.createElement('div');
    overlay.id = 'step-overlay';
    overlay.style.position = 'fixed';
    overlay.style.bottom = '100px';
    overlay.style.left = '50%';
    overlay.style.transform = 'translateX(-50%) translateY(40px)';
    overlay.style.width = '700px';
    overlay.style.background = 'rgba(8, 10, 15, 0.95)';
    overlay.style.backdropFilter = 'blur(20px)';
    overlay.style.borderTop = '5px solid #00e5ff';
    overlay.style.padding = '50px';
    overlay.style.color = 'white';
    overlay.style.zIndex = '10000000';
    overlay.style.boxShadow = '0 40px 120px rgba(0,0,0,1)';
    overlay.style.transition = 'all 1.2s cubic-bezier(0.19, 1, 0.22, 1)';
    overlay.style.opacity = '0';
    overlay.style.borderRadius = '0 0 30px 30px';
    overlay.style.textAlign = 'center';

    overlay.innerHTML = `
      <div style="font-size: 13px; font-weight: 800; color: #00e5ff; text-transform: uppercase; letter-spacing: 7px; margin-bottom: 20px; opacity: 0.6;">Institutional Demo Protocol // Scene 0x${Math.floor(Math.random()*256).toString(16).toUpperCase()}</div>
      <div style="font-size: 40px; font-weight: 900; margin-bottom: 20px; font-style: italic; letter-spacing: -1.5px; line-height: 1.1; background: linear-gradient(to right, #fff, #00e5ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${title}</div>
      <div style="font-size: 18px; color: #94a3b8; line-height: 1.8; font-weight: 500; max-width: 600px; margin: 0 auto; opacity: 0.9;">${description}</div>
      <div style="margin-top: 40px; height: 4px; width: 100%; background: rgba(255,255,255,0.03); border-radius: 4px; overflow: hidden; position: relative;">
        <div id="step-progress" style="height: 100%; width: 0%; background: linear-gradient(90deg, #00e5ff, #7c3aed, #00e5ff); background-size: 200% 100%; transition: width linear;"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Trigger entrance
    setTimeout(() => {
        overlay.style.opacity = '1';
        overlay.style.transform = 'translateX(-50%) translateY(0)';
        const progress = document.getElementById('step-progress');
        if (progress) {
            progress.style.transitionDuration = `${duration}ms`;
            progress.style.width = '100%';
        }
    }, 200);

    // Auto-dismiss
    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transform = 'translateX(-50%) translateY(40px)';
        setTimeout(() => overlay.remove(), 1200);
    }, duration);
  }, { title, description, duration });

  await page.waitForTimeout(duration);
}

test.describe('Institutional Investor Marketing Masterpiece (10-Minute Extended Cut)', () => {
  test.beforeEach(async ({ page }) => {
    await injectMouseTracker(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('DEMO_MODE', 'true');
    });
  });

  test('The Sentinel Lifecycle: Deep Institutional Walkthrough', async ({ page }) => {
    // 10-minute target means we need deep, slow, and illustrative scenes
    await page.setViewportSize({ width: 1920, height: 1080 });

    // --- SCENE 1: THE OPENING ---
    await page.goto('http://localhost:3006/dashboard/onboarding.html');
    await page.waitForTimeout(8000);
    await showStep(page, 'Vertex Sentinel: Verifiable Autonomy', 'Welcome to the future of institutional DeFi. This session provides a 10-minute deep dive into the Sentinel lifecycle—from trustless deployment to on-chain execution protection.', 20000);

    // --- SCENE 2: THE CRYPTOGRAPHIC HANDSHAKE ---
    await showStep(page, 'Establishing the Root of Trust', 'Every institutional journey begins with a secure handshake. We connect the operator\'s wallet to anchor all future agent actions to a verifiable on-chain identity.', 22000);
    await page.click('#btn-connect');
    await page.waitForTimeout(8000);

    // --- SCENE 3: SOVEREIGN IDENTITY MINTING ---
    await showStep(page, 'Minting the Sovereign Agent', 'We now mint a soulbound ERC-8004 NFT. This is not just a token; it is the immutable identity of your sentinel, housing its reputation and execution authority on the Arc L1 ledger.', 25000);
    await page.fill('#agent-name', 'SENTINEL-INSTITUTIONAL-ALPHA-01');
    await page.waitForTimeout(5000);
    await page.click('#btn-mint');
    await page.waitForTimeout(15000); // Extended processing time for "gravity"

    // --- SCENE 4: RISK ARCHETYPE CALIBRATION ---
    await showStep(page, 'Calibrating Behavioral Guardrails', 'Institutional Sentinels are purpose-built. We select the "Guardian" archetype—a profile engineered for capital preservation and sophisticated risk-mitigation in volatile markets.', 22000);
    await page.click('#p-guardian');
    await page.waitForTimeout(6000);
    await page.click('#btn-personality');
    await page.waitForTimeout(8000);

    // --- SCENE 5: THE PROTOCOL-LEVEL ENFORCEMENT ---
    await showStep(page, 'Hard-Coded Execution Limits', 'Governance is code. We define maximum position sizes and trade frequency limits that are hard-coded into the RiskRouter contract, ensuring the agent never exceeds authorized risk limits.', 25000);
    await page.hover('#max-pos');
    await page.waitForTimeout(5000);
    await page.click('#btn-config');
    await page.waitForTimeout(12000);

    // --- SCENE 6: ENTERING THE TERMINAL ---
    await showStep(page, 'Deployment Verified // Entering Terminal', 'The agent is onboarded. The identity is minted. The guardrails are locked. We now proceed to the Professional Risk Terminal for live autonomous operations.', 20000);
    await page.click('text=Open Risk Terminal');
    await page.waitForTimeout(8000);

    // --- SCENE 7: THE PORTFOLIO SHIELD ---
    await showStep(page, 'Professional Risk Analytics', 'Behold the Institutional Command Center. Real-time monitoring of PnL, MDD, and Sentinel Savings—the metric of capital successfully protected by our active circuit breakers.', 28000);
    await page.hover('#metric-savings');
    await page.waitForTimeout(8000);
    await page.hover('#metric-mdd');
    await page.waitForTimeout(8000);

    // --- SCENE 8: THE TRANSPARENCY ENGINE ---
    await showStep(page, 'Deep-Dive Verifiable Reasoning', 'Witness the transparency of Sentinel AI. Every decision is backed by signed EIP-712 reasoning steps, allowing institutional operators to audit the "Why" behind every "What" in real-time.', 35000);
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'smooth' }));
    await page.waitForTimeout(12000);

    // Simulate interaction with reasoning cards
    const cards = page.locator('.glass');
    await cards.nth(2).hover();
    await page.waitForTimeout(8000);

    // --- SCENE 9: THE AGENT CONTROL CENTER ---
    await showStep(page, 'Dynamic Operations Management', 'The operator remains the final authority. Our Control Center enables real-time adjustment of risk parameters and position sizes through a professional, high-fidelity interface.', 30000);
    await page.click('#side-operations');
    await page.waitForTimeout(8000);
    await page.hover('#slider-max-pos-v-bar');
    await page.waitForTimeout(12000);

    // --- SCENE 10: HITL CIRCUIT BREAKERS ---
    await showStep(page, 'Human-in-the-Loop Safeguards', 'Security is paramount. For high-stakes trade authorizations, the Sentinel triggers a mandatory circuit breaker, requiring manual operator verification before execution continues.', 35000);
    await page.click('#side-hitl');
    await page.waitForTimeout(15000);

    // --- SCENE 11: PIXEL-PERFECT AUDIT LOGS ---
    await showStep(page, 'The Gold Standard of Auditability', 'The Technical Audit Log provides a pixel-perfect, verifiable trail of intent. Every volume proof and action is timestamped and anchored to the L1 ledger for institutional compliance.', 35000);
    await page.click('#side-audit');
    await page.waitForTimeout(10000);
    await page.hover('#log-body tr:first-child .integrity-badge-container');
    await page.waitForTimeout(15000);

    // --- SCENE 12: ESG & SUSTAINABILITY ---
    await showStep(page, 'ESG Sentinel: Ethical Alpha', 'Institutional grade means socially responsible. We track real-time energy efficiency and verifiable carbon offset proofs for every compute cycle performed by your sentinel fleet.', 30000);
    await page.click('#side-esg');
    await page.waitForTimeout(15000);

    // --- SCENE 13: THE FINAL ACCOUNTING ---
    await showStep(page, 'Session Reports & Capital Proof', 'As we conclude the operational cycle, the Sentinel generates an institutional Session Report. Verifiable performance data and saved capital metrics, ready for your compliance desk.', 25000);
    await page.click('#side-terminal');
    await page.waitForTimeout(6000);
    await page.click('#session-report-btn');
    await page.waitForTimeout(12000);
    await page.click('#export-pnl-btn');
    await page.waitForTimeout(8000);
    await page.click('#close-pnl-modal');

    // --- SCENE 14: THE SENTINEL PROMISE ---
    await showStep(page, 'Vertex Sentinel: The Shield', 'You have just witnessed the full lifecycle of an Institutional Sentinel. Verifiable. Autonomous. Secure. The future of decentralized execution is here.', 30000);
    await page.waitForTimeout(20000);

    console.log('Production Masterpiece Finalized: "The Sentinel Lifecycle"');
  });
});
