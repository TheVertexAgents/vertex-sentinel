import { test, expect } from '@playwright/test';

/**
 * Investor Demo: The Vertex Sentinel Shield
 * Automated 4-minute cinematic walkthrough.
 */
test.use({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

test('4-Minute Investor Walkthrough', async ({ page }) => {
  // Setup: Enable Demo Mode
  await page.goto('http://localhost:3006/onboarding.html');
  await page.evaluate(() => {
    localStorage.setItem('DEMO_MODE', 'true');
    localStorage.setItem('THEME', 'light');
    localStorage.removeItem('USER_ADDRESS');
    localStorage.removeItem('AGENT_ID');
  });
  await page.reload();

  // Scene 1: The Vision (Onboarding)
  console.log('Scene 1: Onboarding Start');
  await page.waitForTimeout(8000); // 8s

  // Step 1: Connect Wallet (Demo Mode)
  await page.click('#btn-connect');
  await page.waitForTimeout(6000); // 14s

  // Scene 2: Human-Centric Identity
  console.log('Scene 2: Identity Minting');
  await page.fill('#agent-name', 'Sentinel-Guardian-Beta');
  await page.waitForTimeout(4000);
  await page.click('#btn-mint');
  await page.waitForTimeout(10000); // 28s - Simulating L1 Minting delay

  // Step 3: Personality Archetypes
  console.log('Scene 3: Personality Selection');
  await page.click('#p-scout');
  await page.waitForTimeout(3000);
  await page.click('#p-predator');
  await page.waitForTimeout(3000);
  await page.click('#p-guardian');
  await page.waitForTimeout(5000);
  await page.click('#btn-personality');
  await page.waitForTimeout(6000); // 45s

  // Step 4: Risk Parameters & Guardrails
  console.log('Scene 4: Guardrail Configuration');
  const maxPosSlider = page.locator('#max-pos');
  await maxPosSlider.evaluate((el: HTMLInputElement) => el.value = '7500');
  await maxPosSlider.dispatchEvent('input');
  await page.waitForTimeout(4000);

  const maxTradesSlider = page.locator('#max-trades');
  await maxTradesSlider.evaluate((el: HTMLInputElement) => el.value = '15');
  await maxTradesSlider.dispatchEvent('input');
  await page.waitForTimeout(6000);

  await page.click('#btn-config');
  await page.waitForTimeout(8000); // 1m 09s

  // Final Success Step
  console.log('Scene 5: Success & Redirect');
  await page.waitForTimeout(5000);
  await page.goto('http://localhost:3006/index.html');

  // Scene 6: The Risk Terminal - Global View
  console.log('Scene 6: Risk Terminal Exploration');
  await page.waitForTimeout(10000); // Let data settle

  // Theme Toggle Demo
  await page.click('#theme-toggle');
  await page.waitForTimeout(8000);
  await page.click('#theme-toggle');
  await page.waitForTimeout(6000); // 1m 33s

  // Scene 7: AI Transparency (Deep-Dive)
  console.log('Scene 7: AI Reasoning Deep-Dive');
  const deepDiveBtn = page.locator('button:has-text("Deep Dive")').first();
  if (await deepDiveBtn.isVisible()) {
    await deepDiveBtn.click();
    await page.waitForTimeout(15000); // 15s for reading CoT
    await page.click('#close-reasoning-modal');
    await page.waitForTimeout(5000);
  } else {
    await page.waitForTimeout(10000);
  } // 1m 53s

  // Scene 8: Strategic Calibration (Operations Tab)
  console.log('Scene 8: Operations & Calibration');
  await page.click('#side-operations');
  await page.waitForTimeout(8000);

  const sentWeight = page.locator('#slider-sent-weight');
  await sentWeight.evaluate((el: HTMLInputElement) => el.value = '0.9');
  await sentWeight.dispatchEvent('input');
  await page.waitForTimeout(4000);

  const liqFloor = page.locator('#slider-liq-floor');
  await liqFloor.evaluate((el: HTMLInputElement) => el.value = '50000');
  await liqFloor.dispatchEvent('input');
  await page.waitForTimeout(8000); // 2m 13s

  // Scene 9: Human-in-the-Loop (HITL)
  console.log('Scene 9: HITL Interaction');
  await page.click('#side-hitl');
  await page.waitForTimeout(12000); // 2m 25s

  // Scene 10: ESG Sentinel (Sustainability)
  console.log('Scene 10: ESG Monitoring');
  await page.click('#side-esg');
  await page.waitForTimeout(15000); // 2m 40s

  // Scene 11: Fleet Management (Expansion)
  console.log('Scene 11: Fleet Scale');
  await page.click('#side-fleet');
  await page.waitForTimeout(15000);

  await page.click('#hire-agent-fleet-btn');
  await page.waitForTimeout(8000);
  await page.click('#close-modal');
  await page.waitForTimeout(5000); // 3m 08s

  // Scene 12: Technical Audit (Proof of Execution)
  console.log('Scene 12: Audit Trail');
  await page.click('#side-audit');
  await page.waitForTimeout(10000);

  // Scroll through the audit trail
  await page.evaluate(() => {
    const table = document.querySelector('.overflow-x-auto');
    if (table) table.scrollBy({ top: 500, behavior: 'smooth' });
  });
  await page.waitForTimeout(10000); // 3m 28s

  // Scene 13: Final Session Report
  console.log('Scene 13: Session Report');
  await page.click('#side-terminal');
  await page.waitForTimeout(5000);
  await page.click('#session-report-btn');
  await page.waitForTimeout(15000);
  await page.click('#close-pnl-modal');
  await page.waitForTimeout(5000); // 3m 53s

  // Outro: System Live
  console.log('Scene 14: Closing');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(10000); // Total ~4m 03s

  console.log('4-Minute Walkthrough Complete.');
});
