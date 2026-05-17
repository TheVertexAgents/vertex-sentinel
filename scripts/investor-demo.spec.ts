import { test, expect } from '@playwright/test';

/**
 * Investor Demo: The Vertex Sentinel Shield
 * Automated 4-minute cinematic walkthrough - DARK THEME + HITL.
 */
test.use({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

test('4-Minute Investor Walkthrough - Dark Mode', async ({ page }) => {
  // Setup: Enable Demo Mode & Dark Theme
  await page.goto('http://localhost:3006/onboarding.html');
  await page.evaluate(() => {
    localStorage.setItem('DEMO_MODE', 'true');
    localStorage.setItem('THEME', 'dark');
    document.body.classList.add('dark-theme');
    localStorage.removeItem('USER_ADDRESS');
    localStorage.removeItem('AGENT_ID');
  });
  await page.reload();

  // Scene 1: The Vision (Onboarding)
  console.log('Scene 1: Onboarding Start (Dark)');
  await page.waitForTimeout(8000);

  // Step 1: Connect Wallet
  await page.click('#btn-connect');
  await page.waitForTimeout(6000);

  // Scene 2: Identity Minting
  console.log('Scene 2: Identity Minting');
  await page.fill('#agent-name', 'Sentinel-Obsidian-Primary');
  await page.waitForTimeout(4000);
  await page.click('#btn-mint');
  await page.waitForTimeout(10000);

  // Step 3: Personality Archetypes
  console.log('Scene 3: Personality Selection');
  await page.click('#p-predator');
  await page.waitForTimeout(8000);
  await page.click('#btn-personality');
  await page.waitForTimeout(6000);

  // Step 4: Risk Parameters & Guardrails
  console.log('Scene 4: Guardrail Configuration');
  const maxPosSlider = page.locator('#max-pos');
  await maxPosSlider.evaluate((el: HTMLInputElement) => el.value = '9000');
  await maxPosSlider.dispatchEvent('input');
  await page.waitForTimeout(4000);

  await page.click('#btn-config');
  await page.waitForTimeout(8000);

  // Scene 5: Terminal Entry
  console.log('Scene 5: Dark Terminal Entry');
  await page.goto('http://localhost:3006/index.html');
  await page.evaluate(() => {
    localStorage.setItem('THEME', 'dark');
    document.body.classList.add('dark-theme');
  });
  await page.reload();
  await page.waitForTimeout(10000);

  // Scene 6: Risk Terminal Exploration (Filled with data)
  console.log('Scene 6: Data Visualization');
  await page.waitForTimeout(10000);

  // Scene 7: AI Transparency (Deep-Dive)
  console.log('Scene 7: AI Reasoning Deep-Dive');
  const deepDiveBtn = page.locator('button:has-text("Deep Dive")').first();
  if (await deepDiveBtn.isVisible()) {
    await deepDiveBtn.click();
    await page.waitForTimeout(15000);
    await page.click('#close-reasoning-modal');
    await page.waitForTimeout(5000);
  }

  // Scene 8: Strategic Calibration (Operations Tab)
  console.log('Scene 8: Operations');
  await page.click('#side-operations');
  await page.waitForTimeout(10000);

  const sentWeight = page.locator('#slider-sent-weight');
  await sentWeight.evaluate((el: HTMLInputElement) => el.value = '0.95');
  await sentWeight.dispatchEvent('input');
  await page.waitForTimeout(8000);

  // Scene 9: Human-in-the-Loop (HITL) - The Approval
  console.log('Scene 9: HITL Approval Flow');
  await page.click('#side-hitl');
  await page.waitForTimeout(10000);

  const approveBtn = page.locator('button:has-text("Approve")').first();
  if (await approveBtn.isVisible()) {
    await approveBtn.click();
    await page.waitForTimeout(8000);
  } else {
    console.log('No pending HITL found, waiting longer...');
    await page.waitForTimeout(15000);
  }

  // Scene 10: ESG Sentinel
  console.log('Scene 10: ESG Monitoring');
  await page.click('#side-esg');
  await page.waitForTimeout(15000);

  // Scene 11: Fleet Scale
  console.log('Scene 11: Fleet Management');
  await page.click('#side-fleet');
  await page.waitForTimeout(12000);

  // Scene 12: Technical Audit
  console.log('Scene 12: Audit Proofs');
  await page.click('#side-audit');
  await page.waitForTimeout(12000);
  await page.evaluate(() => {
    const table = document.querySelector('.overflow-x-auto');
    if (table) table.scrollBy({ top: 800, behavior: 'smooth' });
  });
  await page.waitForTimeout(10000);

  // Scene 13: Session Report
  console.log('Scene 13: Final Report');
  await page.click('#side-terminal');
  await page.waitForTimeout(5000);
  await page.click('#session-report-btn');
  await page.waitForTimeout(15000);
  await page.click('#close-pnl-modal');
  await page.waitForTimeout(5000);

  // Outro
  console.log('Scene 14: Dark Outro');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(10000);

  console.log('4-Minute Dark Walkthrough Complete.');
});
