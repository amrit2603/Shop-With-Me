import {signInHost} from './account-helper';
import { test, expect } from '@playwright/test';

test.describe('Shop With Me - Collaborative Journey (2 Browser Contexts)', () => {
  test('creates room, friend joins via link, votes, chats, and creator makes final choice', async ({ browser }) => {
    // Context A: Room Creator (Alice)
    const creatorContext = await browser.newContext();
    const creatorPage = await creatorContext.newPage();

    // 1. Creator visits home page and starts a room
    await signInHost(creatorPage,'Alice');
    await creatorPage.goto('/');
    await expect(creatorPage.getByRole('heading', { name: /Choose together/i })).toBeVisible();

    // Scroll to builder section

    // Add first 2 products from catalog
    const addButtons = creatorPage.locator('.catalog-cards-grid .btn-card-action');
    await expect(addButtons.first()).toBeVisible({ timeout: 15000 });
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();

    // Enter room title
    const titleInput = creatorPage.locator('#room-title-input, input[placeholder*="title"], input[placeholder*="Name"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('Wedding Guest Shortlist');
    }

    // Submit room creation
    const createButton = creatorPage.locator('.btn-create-inline');
    await expect(createButton).toBeEnabled();
    await creatorPage.getByText('Room options',{exact:true}).click();
    await createButton.click();

    // Wait for "ROOM READY" card
    const roomReadyCard = creatorPage.locator('#room-ready-card');
    await expect(roomReadyCard).toBeVisible({ timeout: 15000 });

    const shareUrlInput = creatorPage.locator('.room-ready-link-input');
    const shareUrl = await shareUrlInput.inputValue();
    expect(shareUrl).toContain('/room/');

    // Creator navigates to the room
    await creatorPage.goto(shareUrl);
    await expect(creatorPage.locator('.room-title, h1')).toBeVisible({ timeout: 15000 });

    // The authenticated host joins automatically using the account name.
    await expect(creatorPage.locator('text=Alice').first()).toBeVisible({ timeout: 10000 });

    // Context B: Friend (Bob) joins via shareable link with NO account
    const friendContext = await browser.newContext();
    const friendPage = await friendContext.newPage();
    await friendPage.goto(shareUrl);

    // Bob enters display name and joins
    const friendNameInput = friendPage.locator('input[aria-label="Your display name"]');
    await expect(friendNameInput).toBeVisible({ timeout: 15000 });
    await friendNameInput.fill('Bob');
    await friendPage.locator('button.btn-join-room').click();
    await expect(friendPage.locator('text=Bob').first()).toBeVisible({ timeout: 10000 });

    // 2. Live Voting & Realtime Sync
    // Alice votes "Love" on the first product card
    const aliceLoveBtn = creatorPage.locator('button[aria-label="Vote Love"]').first();
    await expect(aliceLoveBtn).toBeVisible();
    await aliceLoveBtn.click();

    // Bob should see the updated Love count without refreshing
    const bobLoveBtn = friendPage.locator('button[aria-label="Vote Love"]').first();
    await expect(bobLoveBtn).toContainText('1', { timeout: 10000 });

    // Bob votes "Like" on the first product card
    const bobLikeBtn = friendPage.locator('button[aria-label="Vote Like"]').first();
    await bobLikeBtn.click();

    // Alice should see the Like vote count without refreshing
    const aliceLikeBtn = creatorPage.locator('button[aria-label="Vote Like"]').first();
    await expect(aliceLikeBtn).toContainText('1', { timeout: 10000 });

    await expect(friendPage.locator('.product-discussion-container')).toHaveCount(0);

    // 4. Live Room Chat (Realtime chat sync)
    // Bob sends a message in room chat
    const bobChatInput = friendPage.locator('#room-chat-message');
    await expect(bobChatInput).toBeVisible({ timeout: 10000 });
    await bobChatInput.fill('Hey Alice! I really love this one!');
    await bobChatInput.press('Enter');

    // Alice should receive Bob's chat message within 1s
    const aliceChatMessage = creatorPage.locator('.chat-message-list').getByText('Hey Alice! I really love this one!');
    await expect(aliceChatMessage).toBeVisible({ timeout: 5000 });

    // Alice replies in room chat
    const aliceChatInput = creatorPage.locator('#room-chat-message');
    await aliceChatInput.fill('Thanks Bob, selecting it now!');
    await aliceChatInput.press('Enter');

    // Bob should see Alice's message in chat
    const bobReplyMessage = friendPage.locator('.chat-message-list').getByText('Thanks Bob, selecting it now!');
    await expect(bobReplyMessage).toBeVisible({ timeout: 5000 });

    // 5. Creator Final Choice
    // Switch to summary tab if side tabs are active
    const creatorSummaryTab = creatorPage.locator('button:has-text("Votes"), button:has-text("Summary")').first();
    if (await creatorSummaryTab.isVisible()) {
      await creatorSummaryTab.click();
    }

    // Alice selects "My Final Choice"
    const finalChoiceBtn = creatorPage.locator('button:has-text("My Final Choice")').first();
    await expect(finalChoiceBtn).toBeVisible({ timeout: 10000 });
    await finalChoiceBtn.click();

    // Both Alice and Bob should see the Official Final Choice card live
    await expect(creatorPage.locator('.decision-card--final-choice')).toBeVisible({ timeout: 10000 });

    const friendSummaryTab = friendPage.locator('button:has-text("Votes"), button:has-text("Summary")').first();
    if (await friendSummaryTab.isVisible()) {
      await friendSummaryTab.click();
    }
    await expect(friendPage.locator('.decision-card--final-choice')).toBeVisible({ timeout: 10000 });

    await creatorContext.close();
    await friendContext.close();
  });
});
