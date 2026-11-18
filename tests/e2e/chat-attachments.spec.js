import {signInHost} from './account-helper';
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screensDir = path.resolve(process.cwd(), 'docs', 'screens');

test.describe('Phase R3: Live Chat with Attachments (3 Clients + Mobile)', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }
  });

  test('3 clients join room, exchange live messages and attachments, lightbox opens, mobile 375px verified', async ({ browser }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const hostPage = await hostContext.newPage();

    await signInHost(hostPage,'Alice');
    await hostPage.goto('/');
    await hostPage.waitForLoadState('networkidle');

    // Create room with mandatory title
    const addButtons = hostPage.locator('.catalog-cards-grid .btn-card-action');
    await addButtons.first().waitFor({ state: 'visible', timeout: 10000 });
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();
    await hostPage.locator('#room-title-input').fill('Chat Feature 5 Demo');
    await hostPage.getByText('Room options',{exact:true}).click();
    await hostPage.locator('.btn-create-inline').click();

    await hostPage.locator('#room-ready-card').waitFor({ state: 'visible', timeout: 10000 });
    const shareUrl = await hostPage.locator('.room-ready-link-input').inputValue();

    // Host joins as "Alice (Host)"
    await hostPage.goto(shareUrl);
    await hostPage.waitForLoadState('networkidle');
    // The authenticated host joins automatically using the account name.
    await expect(hostPage.locator('.navbar-current-user-chip .user-chip-name')).toHaveText('Alice');

    // 2. Client 2 (Bob) joins
    const bobContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const bobPage = await bobContext.newPage();
    await bobPage.goto(shareUrl);
    await bobPage.waitForLoadState('networkidle');
    const bobNameInput = bobPage.locator('input[aria-label="Your display name"]');
    await bobNameInput.waitFor({ state: 'visible' });
    await bobNameInput.fill('Bob');
    await bobPage.locator('button.btn-join-room').click();
    await expect(bobPage.locator('.navbar-current-user-chip .user-chip-name')).toHaveText('Bob');

    // 3. Client 3 (Charlie on Mobile 375px) joins
    const charlieContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const charliePage = await charlieContext.newPage();
    await charliePage.goto(shareUrl);
    await charliePage.waitForLoadState('networkidle');
    const charlieNameInput = charliePage.locator('input[aria-label="Your display name"]');
    await charlieNameInput.waitFor({ state: 'visible' });
    await charlieNameInput.fill('Charlie');
    await charliePage.locator('button.btn-join-room').click();
    await expect(charliePage.locator('.navbar-current-user-chip .user-chip-name')).toHaveText('Charlie');

    // On mobile, switch to Chat tab
    const chatTabBtn = charliePage.locator('button.mobile-tab-btn:has-text("Chat")');
    if (await chatTabBtn.isVisible()) {
      await chatTabBtn.first().click({ force: true });
    }

    // 4. Alice sends a chat message
    const hostChatInput = hostPage.locator('#room-chat-message');
    await hostChatInput.fill('Hello everyone! Check this out.');
    await hostChatInput.press('Enter');

    // Bob and Charlie see Alice's message
    await expect(bobPage.locator('.chat-message-list')).toContainText('Hello everyone! Check this out.');
    await expect(charliePage.locator('.chat-message-list')).toContainText('Hello everyone! Check this out.');

    // 5. Bob attaches an image and sends
    // Create a temporary PNG file buffer for attachment
    const tempImgPath = path.resolve(process.cwd(), 'docs', 'screens', 'sample-test-image.png');
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89]);
    fs.writeFileSync(tempImgPath, validPngBuffer);

    const fileInput = bobPage.locator('input[type="file"]');
    await fileInput.setInputFiles(tempImgPath);

    // Staged chip appears in Bob's composer
    await expect(bobPage.locator('.chat-staged-chip')).toBeVisible();

    const bobChatInput = bobPage.locator('#room-chat-message');
    await bobChatInput.fill('Here is the sample photo!');
    await bobPage.locator('.chat-send-btn').click();
    await expect(bobPage.locator('.chat-staged-chip')).toBeHidden({ timeout: 10000 });

    // Alice and Charlie receive Bob's message and attachment
    await expect(hostPage.locator('.chat-message-list')).toContainText('Here is the sample photo!');
    await expect(charliePage.locator('.chat-message-list')).toContainText('Here is the sample photo!');

    const hostAttachmentThumb = hostPage.locator('.chat-attachment-thumb-btn').first();
    await hostAttachmentThumb.waitFor({ state: 'visible', timeout: 8000 });

    // 6. Alice clicks thumbnail to open Lightbox
    await hostAttachmentThumb.click();
    const lightbox = hostPage.locator('.chat-lightbox-backdrop');
    await expect(lightbox).toBeVisible();

    // Close Lightbox via Esc
    await hostPage.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();

    // 7. Verify Charlie mobile 375px layout and capture screenshot
    await charliePage.waitForTimeout(600);
    await charliePage.screenshot({
      path: path.join(screensDir, 'chat-mobile-375px.png'),
      fullPage: true,
    });

    // Clean up temporary image
    try { fs.unlinkSync(tempImgPath); } catch {}

    await hostContext.close();
    await bobContext.close();
    await charlieContext.close();
  });
});
