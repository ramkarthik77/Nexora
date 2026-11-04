import { test, expect } from '@playwright/test';

// All API data in this suite comes from the synthetic AEM preview adapter.
test('spatial dashboard and AEM simulated operations are functional', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#humanoidShell')).toBeVisible();
  await page.getByRole('button', { name: 'SPATIAL', exact: true }).click();
  await expect(page.getByRole('heading', { name: /One space/i })).toBeVisible();
  await expect(page.locator('.module-card')).toHaveCount(7);

  // The sidebar and quick-command panel both contain an AEM button. Target the sidebar explicitly.
  await expect(page.locator('#navAem')).toBeVisible();
  await page.locator('#navAem').click();
  await expect(page.getByRole('dialog', { name: 'AEM operations' })).toBeVisible();
  await expect(page.locator('#aemDataLabel')).toContainText('SIMULATED');
  await expect(page.locator('#aemStats .aem-stat')).toHaveCount(7);
  await expect(page.locator('#aemSitesCount')).toContainText('120');
  await page.locator('#aemScenario').selectOption('incident');
  await expect(page.locator('#aemSites .aem-status.down')).toHaveCount(2);
  await expect(page.locator('#aemAlerts')).toContainText('Synthetic outage');
  await page.getByRole('button', { name: 'Close AEM operations' }).click();

  await page.locator('#commandInput').fill('How many rollbacks this quarter?');
  await page.getByRole('button', { name: 'Send command' }).click();
  await expect(page.locator('.chat-bubble.assistant').last()).toContainText(/unknown/i);
});

test('responsive mock AEM dashboard works on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  // The humanoid layout intentionally hides the sidebar and inspector on narrow screens.
  // Its dedicated Cloud Operations CTA is the visible mobile entry point.
  const openAem = page.locator('#aemHudButton');
  await expect(openAem).toBeVisible();
  await openAem.click();
  await expect(page.getByRole('dialog', { name: 'AEM operations' })).toBeVisible();
  await expect(page.locator('#aemStats .aem-stat')).toHaveCount(7);
  await page.locator('#aemScenario').selectOption('degraded');
  await expect(page.locator('#aemSites .aem-status.degraded')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close AEM operations' }).click();
  await expect(page.locator('#humanoidShell')).toBeVisible();
});

test('humanoid presence supports cinematic, 3D particle, and interaction modes', async ({ page }) => {
  await page.goto('/');
  const shell = page.locator('#humanoidShell');
  const canvas = page.locator('#humanoidCanvas');
  const artwork = page.locator('.avatar-image');
  await expect(shell).toBeVisible();
  await expect(page.locator('#humanoidState')).toContainText('IDLE');

  // Cinematic portrait is the V4 default. The 3D canvas is intentionally hidden in that mode.
  await expect(shell).toHaveAttribute('data-visual', 'portrait');
  await expect(artwork).toBeVisible();
  await expect(canvas).toBeHidden();

  await page.locator('[data-visual="particles"]').click();
  await expect(shell).toHaveAttribute('data-visual', 'particles');
  await expect(canvas).toBeVisible();
  await expect(artwork).toBeHidden();

  for (const [mode, label] of [
    ['listening', 'LISTENING'], ['thinking', 'THINKING'],
    ['speaking', 'SPEAKING'], ['idle', 'IDLE'],
  ]) {
    await page.locator('[data-humanoid-state="' + mode + '"]').click();
    await expect(page.locator('#humanoidState')).toContainText(label);
    await expect(shell).toHaveAttribute('data-mode', mode);
  }

  await page.locator('[data-visual="portrait"]').click();
  await expect(artwork).toBeVisible();
  await expect(canvas).toBeHidden();
  await page.getByRole('button', { name: 'SPATIAL', exact: true }).click();
  await expect(shell).toBeHidden();
  await page.getByRole('button', { name: 'HUMANOID', exact: true }).click();
  await expect(shell).toBeVisible();
  await expect(artwork).toBeVisible();
});
