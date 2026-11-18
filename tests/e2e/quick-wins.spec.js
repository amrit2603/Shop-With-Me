import {registerHost,signInHost} from './account-helper';
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

test('guest saves privately, changes vote, reacts live, reconnects and downloads the decision', async ({ browser, request }) => {
  const owner=await registerHost(request,'Avery');
  const created = await (await request.post('/api/rooms', { data: { title:'Weekend shopping with friends', expiresInHours:6 } })).json();
  const { products } = await (await request.get('/api/products')).json();
  for (const product of products.slice(0, 2)) {
    expect((await request.post(`/api/rooms/${created.room.id}/products`, { data:{ productId:product.id }, headers:{ 'X-Creator-Token':created.creatorToken } })).ok()).toBeTruthy();
  }
  const host = await browser.newContext({storageState:await request.storageState()}); const friend = await browser.newContext();
  const a=await host.newPage(),b=await friend.newPage();
  try {
    await a.goto('/');await a.evaluate(({owner,created})=>{sessionStorage.setItem('vyumi_tab_token',owner.sessionToken);sessionStorage.setItem('vyumi_tab_user',JSON.stringify(owner.user));sessionStorage.setItem(`creator_token_${created.room.id}`,created.creatorToken);},{owner,created});await a.reload();
    await a.goto(`/room/${created.room.id}`);await expect(a.locator('.connection-text')).toHaveText('Live');
    await b.goto(`/room/${created.room.id}`);await b.getByLabel('Your display name',{exact:true}).fill('Blair');await b.locator('.btn-join-room').click();await expect(b.locator('.connection-text')).toHaveText('Live');
    await expect(a.locator('.room-expiry-pill')).toContainText(/left$/);
    await b.getByRole('button',{name:'Select product',exact:true}).first().click();
    await b.getByRole('button', { name:'Save for me', exact:false }).first().click();
    await expect(b.getByRole('button', { name:'Saved for me', exact:false }).first()).toHaveAttribute('aria-pressed','true');
    const saved=b; await saved.goto('/saved');
    await expect(saved.getByRole('heading', { name:products[0].name })).toBeVisible();
    await b.goto(`/room/${created.room.id}`);await expect(b.locator('.connection-text')).toHaveText('Live');
    const hostSaved=a;await hostSaved.goto('/saved');
    await expect(hostSaved.getByText('No saved products yet.', { exact:false })).toBeVisible();await a.goto(`/room/${created.room.id}`);await expect(a.locator('.connection-text')).toHaveText('Live');
    await b.getByRole('button', { name:'Vote Like', exact:true }).first().click();
    await b.getByRole('button', { name:'Vote Love', exact:true }).first().click();
    await expect(b.locator('.room-action-message')).toHaveText('You changed Like to Love.');
    await expect(a.getByRole('button', { name:'Vote Love', exact:true }).first()).toContainText('1');
    await b.locator('#room-chat-message').fill('The first one is perfect'); await b.locator('#room-chat-message').press('Enter');
    const bubbleA = a.locator('.chat-bubble').filter({ hasText:'The first one is perfect' });
    const bubbleB = b.locator('.chat-bubble').filter({ hasText:'The first one is perfect' });
    await bubbleA.getByRole('button', { name:'React ❤️', exact:true }).click();
    await expect(bubbleB.getByRole('button', { name:'React ❤️', exact:true })).toContainText('1');
    await b.reload();
    await expect(bubbleB.getByRole('button', { name:'React ❤️', exact:true })).toContainText('1');
    await a.locator('.sidebar-tab-btn').filter({ hasText:'Votes' }).click();
    await a.getByRole('button', { name:'My Final Choice', exact:false }).first().click();
    await expect(a.locator('.decision-card--final-choice')).toBeVisible();
    const downloadEvent = a.waitForEvent('download');
    await a.getByRole('button', { name:'Download decision card', exact:false }).click();
    const download = await downloadEvent;
    const bytes = await fs.readFile(await download.path());
    expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(bytes.length).toBeGreaterThan(1000);
    await b.setViewportSize({ width:375, height:812 });
    expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(b.locator('.chat-panel')).not.toBeVisible();
  } finally { await host.close(); await friend.close(); }
});

test('screenshot builder preserves unknown prices and stores real bytes outside SQLite', async ({ page }) => {
  await signInHost(page,'Avery');
  await page.goto('/');
  await page.locator('#room-title-input').fill('Screenshot shortlist');
  await page.locator('.catalog-cards-grid .btn-card-action').first().click();
  await page.getByRole('button', { name:'Upload a screenshot', exact:false }).click();
  await page.getByLabel('Upload photo').setInputFiles(path.resolve('frontend/public/products/arkive-haircare-duo.jpg'));
  await page.getByPlaceholder('Product name', { exact:true }).fill('My screenshot product');
  await page.locator('.shot-fields-grid .btn-primary').click();
  await page.getByText('Room options',{exact:true}).click();
  await page.locator('.btn-create-inline').click();
  await expect(page.locator('#room-ready-card')).toBeVisible();
  await expect(page.getByRole('link', { name:'Share on WhatsApp', exact:false })).toBeVisible();
  await page.goto(await page.locator('.room-ready-link-input').inputValue());
  const card = page.locator('.room-products-grid .room-product-card').filter({ hasText:'My screenshot product' });
  await expect(card.locator('.card-product-price')).toHaveText('Price unknown');
  await expect(card.locator('.card-media-box img')).toHaveAttribute('src', /\/uploads\/[a-f0-9]+\.jpeg$/);
  await expect.poll(() => card.locator('.card-media-box img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
});
