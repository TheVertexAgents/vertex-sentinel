import { test, expect } from '@playwright/test';
import { io } from 'socket.io-client';

test.describe('HITL Flow E2E', () => {
  test('should approve a pending intent from dashboard', async ({ page }) => {
    await page.goto('http://localhost:3005/dashboard/index.html');

    // Switch to Manual Mode
    const aiToggle = page.locator('#ai-toggle');
    const aiStatus = page.locator('#ai-status-label');
    const statusText = await aiStatus.innerText();
    if (statusText === 'ON') {
        await aiToggle.click();
    }

    // Connect a socket to simulate Agent Brain emitting a pending intent
    const socket = io('http://localhost:3006');

    const traceId = 'test-trace-' + Date.now();
    socket.emit('intent.pending', {
        traceId,
        intent: {
            pair: 'BTC/USDC',
            action: 'BUY',
            amountUsdScaled: 5000n,
        },
        reasoning: 'Testing HITL Flow',
        riskScore: 0.1
    });

    // Verify it appears on dashboard
    const pendingCard = page.locator(`#pending-${traceId}`);
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard).toContainText('Testing HITL Flow');

    // Click Approve
    await pendingCard.getByRole('button', { name: 'Approve' }).click();

    // Verify it shows "APPROVING..."
    await expect(pendingCard).toContainText('APPROVING...');

    socket.disconnect();
  });
});
