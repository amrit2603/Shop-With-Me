import {signInHost} from './account-helper';
import { test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screensDir = path.resolve(process.cwd(), 'docs', 'screens');

test.describe('Responsive Screenshots (1280px Desktop & 375px Mobile)', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }
  });

  test('captures Home and Room screenshots at 1280px desktop and 375px mobile', async ({ browser }) => {
    // 1. Desktop context (1280 x 800)
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();

    await signInHost(desktopPage,'Alice');
    await desktopPage.goto('/');
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.screenshot({ path: path.join(screensDir, 'home-1280px.png'), fullPage: true });

    // 2. Mobile context (375 x 812)
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto('/');
    await mobilePage.waitForLoadState('networkidle');
    await mobilePage.screenshot({ path: path.join(screensDir, 'home-375px.png'), fullPage: true });

    // Now create a room to capture the room interface
    const addButtons = desktopPage.locator('.catalog-cards-grid .btn-card-action');
    await addButtons.first().waitFor({ state: 'visible', timeout: 10000 });
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();
    await desktopPage.locator('#room-title-input').fill('Wedding Outfit Shortlist');
    await desktopPage.getByText('Room options',{exact:true}).click();
    await desktopPage.locator('.btn-create-inline').click();

    await desktopPage.locator('#room-ready-card').waitFor({ state: 'visible', timeout: 10000 });
    const shareUrl = await desktopPage.locator('.room-ready-link-input').inputValue();

    // Capture Room Desktop
    await desktopPage.goto(shareUrl);
    await desktopPage.waitForLoadState('networkidle');
    // The authenticated host joins automatically using the account name.
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({ path: path.join(screensDir, 'room-1280px.png'), fullPage: true });

    // Capture Room Mobile
    await mobilePage.goto(shareUrl);
    await mobilePage.waitForLoadState('networkidle');
    const friendNameInput = mobilePage.locator('input[aria-label="Your display name"]');
    if (await friendNameInput.isVisible()) {
      await friendNameInput.fill('Bob');
      await mobilePage.locator('button.btn-join-room').click();
    }
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({ path: path.join(screensDir, 'room-375px.png'), fullPage: true });

    await desktopContext.close();
    await mobileContext.close();
  });
});
