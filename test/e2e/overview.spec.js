import {test,expect} from '@playwright/test';

test('spatial dashboard and AEM simulated operations are functional',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#humanoidShell')).toBeVisible();
  await page.getByRole('button',{name:'SPATIAL'}).click();
  await expect(page.getByRole('heading',{name:/One space/i})).toBeVisible();
  await expect(page.locator('.module-card')).toHaveCount(7);
  await page.getByRole('button',{name:'AEM operations'}).click();
  await expect(page.getByRole('dialog',{name:'AEM operations'})).toBeVisible();
  await expect(page.locator('#aemDataLabel')).toContainText('SIMULATED');
  await expect(page.locator('#aemStats .aem-stat')).toHaveCount(7);
  await expect(page.locator('#aemSitesCount')).toContainText('120');
  await page.locator('#aemScenario').selectOption('incident');
  await expect(page.locator('#aemSites .aem-status.down')).toHaveCount(2);
  await expect(page.locator('#aemAlerts')).toContainText('Synthetic outage');
  await page.getByRole('button',{name:'Close AEM operations'}).click();
  await page.locator('#commandInput').fill('How many rollbacks this quarter?');
  await page.getByRole('button',{name:'Send command'}).click();
  await expect(page.locator('.chat-bubble.assistant').last()).toContainText('unknown');
});

test('responsive mock AEM dashboard works on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'AEM operations'}).click();
  await expect(page.locator('#aemStats .aem-stat')).toHaveCount(7);
  await page.locator('#aemScenario').selectOption('degraded');
  await expect(page.locator('#aemSites .aem-status.degraded')).toHaveCount(1);
});


test('humanoid presence has functional modes and pointer canvas',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#humanoidShell')).toBeVisible();
  await expect(page.locator('#humanoidState')).toContainText('IDLE');
  await expect(page.locator('#humanoidCanvas')).toBeVisible();
  await page.locator('[data-humanoid-state="listening"]').click();
  await expect(page.locator('#humanoidState')).toContainText('LISTENING');
  await page.locator('[data-humanoid-state="thinking"]').click();
  await expect(page.locator('#humanoidState')).toContainText('THINKING');
  await page.locator('[data-humanoid-state="speaking"]').click();
  await expect(page.locator('#humanoidState')).toContainText('SPEAKING');
  await page.locator('[data-humanoid-state="idle"]').click();
  await expect(page.locator('#humanoidState')).toContainText('IDLE');
  await page.getByRole('button',{name:'SPATIAL'}).click();
  await expect(page.locator('#humanoidShell')).toBeHidden();
  await page.getByRole('button',{name:'HUMANOID'}).click();
  await expect(page.locator('#humanoidShell')).toBeVisible();
});
