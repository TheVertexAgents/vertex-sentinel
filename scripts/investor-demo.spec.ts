import { test, expect } from '@playwright/test';

/**
 * Investor Demo: The Vertex Sentinel Shield
 * Automated walkthrough following the Investor Storyboard.
 */
test('Investor Demo Walkthrough', async ({ page }) => {
  // Setup: Enable Demo Mode
  await page.goto('http://localhost:3006/onboarding.html');
  await page.evaluate(() => {
    localStorage.setItem('DEMO_MODE', 'true');
    localStorage.setItem('THEME', 'light');
  });
  await page.reload();

  // Scene 1: The Vision (Onboarding)
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification/investor/01-onboarding.png' });

  // Step 1: Connect Wallet (Demo Mode)
  await page.click('#btn-connect');
  await page.waitForTimeout(500);

  // Scene 2: Human-Centric Identity
  // Step 2: Mint Identity
  await page.fill('#agent-name', 'Sentinel-Guardian');
  await page.screenshot({ path: 'verification/investor/02-identity-mint.png' });
  await page.click('#btn-mint');
  await page.waitForTimeout(2000);

  // Step 3: Personality
  await page.click('#p-guardian');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verification/investor/03-personality.png' });
  await page.click('#btn-personality');
  await page.waitForTimeout(1000);

  // Step 4: Risk Parameters
  const maxPosSlider = page.locator('#max-pos');
  await maxPosSlider.evaluate((el: HTMLInputElement) => el.value = '5000');
  await maxPosSlider.dispatchEvent('input');
  await page.screenshot({ path: 'verification/investor/04-guardrails.png' });
  await page.click('#btn-config');
  await page.waitForTimeout(1500);

  // Final Success Step
  await page.screenshot({ path: 'verification/investor/05-success.png' });
  await page.goto('http://localhost:3006/index.html');

  // Scene 3: The Risk Terminal (Institutional Light)
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verification/investor/06-dashboard-light.png' });

  // Toggle Dark Mode then back to Light
  await page.click('#theme-toggle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification/investor/07-dashboard-dark.png' });
  await page.click('#theme-toggle');
  await page.waitForTimeout(1000);

  // Scene 4: The Fail-Closed Master Switch
  await page.evaluate(() => {
    const toggle = document.getElementById('automation-toggle') as HTMLInputElement;
    if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification/investor/08-automation-paused.png' });

  await page.evaluate(() => {
    const toggle = document.getElementById('automation-toggle') as HTMLInputElement;
    if (toggle) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
    }
  });
  await page.waitForTimeout(1000);

  // Scene 5: AI Transparency (Deep-Dive)
  const deepDiveBtn = page.locator('button:has-text("Deep Dive")').first();
  if (await deepDiveBtn.isVisible()) {
    await deepDiveBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verification/investor/09-deep-dive-modal.png' });
    await page.click('#close-reasoning-modal');
    await page.waitForTimeout(500);
  }

  // Scene 6: Strategic Calibration (Operations)
  await page.click('#side-operations');
  await page.waitForTimeout(1000);

  // Adjust Sentiment Weight slider
  const sentimentSlider = page.locator('input[type="range"]').first();
  await sentimentSlider.evaluate((el: HTMLInputElement) => el.value = '0.8');
  await sentimentSlider.dispatchEvent('change');
  await page.screenshot({ path: 'verification/investor/10-operations-calibration.png' });

  // Scene 7: Scaling the Fleet (Fleet Tab)
  await page.click('#side-fleet');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification/investor/11-fleet-management.png' });

  // Scene 8: Technical Audit
  await page.click('#side-audit');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification/investor/12-technical-audit.png' });

  console.log('Investor demo screenshots captured in verification/investor/');
});
