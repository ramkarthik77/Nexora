import { test, expect } from '@playwright/test';

test('V8: conversation dock remains outside avatar stage',async({page})=>{
 await page.goto('/');
 await page.locator('#demoOpen').click();
 await expect(page.locator('#demoPanel')).toBeVisible();
 const state=await page.locator('#demoPanel').evaluate(el=>({
   parent:el.parentElement.tagName,
   position:getComputedStyle(el).position,
   maxHeight:parseInt(getComputedStyle(el).maxHeight,10)
 }));
 expect(state.parent).toBe('BODY');
 expect(state.position).toBe('fixed');
 expect(state.maxHeight).toBeGreaterThan(120);
 await expect(page.locator('.avatar-art')).toBeVisible();
});
test('V8: choosing a live avatar does not force slow neural audio',async({page})=>{
 await page.route('**/live-avatar.js',r=>r.fulfill({contentType:'text/javascript',body:`window.NexoraLive3D={create:()=>({isSupported:true,ready:false,async load(){this.ready=true;},setActive(){},stopSpeech(){},destroy(){},interact(){},look(){},speak(){}})};`}));
 await page.goto('/');
 await page.locator('[data-visual="live"]').click();
 await expect(page.locator('#humanoidShell')).toHaveAttribute('data-visual','live');
 await expect(page.locator('#demoVoiceSource')).toHaveValue('browser');
 await page.locator('#demoOpen').click(); // Open the dock before operating its hidden form control.
 await page.locator('#demoVoiceSource').selectOption('neural');
 await expect(page.locator('#demoVoiceSource')).toHaveValue('neural');
});