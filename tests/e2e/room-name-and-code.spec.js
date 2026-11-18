import {signInHost} from './account-helper';
import { test, expect } from '@playwright/test';

test.describe('R2: Mandatory Room Name and Easy Room Code', () => {
  test('disables create button until name is valid, supports quick-picks, displays large code & copies', async ({ page }) => {
    await signInHost(page,'Alice');
    await page.goto('/');

    // Scroll to builder

    // Select 2 products from catalog
    const addButtons = page.locator('.catalog-cards-grid .btn-card-action');
    await expect(addButtons.first()).toBeVisible({ timeout: 15000 });
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();

    const titleInput = page.locator('#room-title-input');
    await expect(titleInput).toBeVisible();

    const createBtn = page.locator('.btn-create-inline');

    // 1. Initially empty -> create button must be disabled
    await titleInput.fill('');
    await expect(createBtn).toBeDisabled();

    // 2. Spaces only -> disabled
    await titleInput.fill('   ');
    await expect(createBtn).toBeDisabled();

    // 3. Exactly 2 chars -> disabled
    await titleInput.fill('ab');
    await expect(createBtn).toBeDisabled();

    // 4. Literal word "room" -> disabled
    await titleInput.fill('room');
    await expect(createBtn).toBeDisabled();

    // 5. Test Quick-pick chips: click "Outfit"
    await page.getByText('Suggested room names',{exact:true}).click();
    const outfitChip = page.locator('.quick-pick-chip:has-text("Outfit")');
    await expect(outfitChip).toBeVisible();
    await outfitChip.click();

    // Title should be populated with starter text and create button enabled!
    await expect(titleInput).toHaveValue('Help me choose my wedding outfit');
    await expect(createBtn).toBeEnabled();

    // Character counter should be visible
    const counter = page.locator('.title-char-counter');
    await expect(counter).toContainText('/60');

    // 6. Submit room creation
    await page.getByText('Room options',{exact:true}).click();
    await createBtn.click();

    // 7. Verify "ROOM READY" card appears
    const roomReadyCard = page.locator('#room-ready-card');
    await expect(roomReadyCard).toBeVisible({ timeout: 15000 });

    // Room code in large monospaced letters
    const largeCodeBtn = roomReadyCard.locator('.large-code-display');
    await expect(largeCodeBtn).toBeVisible();
    const codeText = (await largeCodeBtn.textContent()).trim();
    expect(codeText).toHaveLength(6);

    // Assert code characters belong to unambiguous alphabet (no 0, O, 1, I, L, 5, S, 8, B)
    const ambiguousChars = ['0', 'O', '1', 'I', 'L', '5', 'S', '8', 'B'];
    for (const amb of ambiguousChars) {
      expect(codeText).not.toContain(amb);
    }

    // Latest request restores native Share and clickable code; QR remains removed.
    await expect(roomReadyCard.locator('.btn-copy-code,.ready-qr-box')).toHaveCount(0);
    await expect(roomReadyCard.getByRole('button',{name:'Share',exact:true})).toBeVisible();
    await expect(roomReadyCard.getByRole('link',{name:'Share on WhatsApp',exact:true})).toHaveAttribute('href',/^https:\/\/wa.me\//);
    const copyLinkBtn=roomReadyCard.locator('.btn-copy-link');
    await copyLinkBtn.click();await expect(copyLinkBtn).toHaveText('Copied!');

    // 8. Open Live Room and check Room Header
    await page.locator('.btn-enter-room').click();
    await expect(page.locator('.room-title, h1')).toHaveText('Help me choose my wedding outfit', { timeout: 15000 });

    // Room code visible in header
    const headerCodeBtn = page.locator('.room-code-tag-btn');
    await expect(headerCodeBtn).toBeVisible();
    await expect(headerCodeBtn).toContainText(codeText);

    // The room code is the single entry to invitation details.
    const inviteBtn = page.locator('.room-code-tag-btn');
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();

    const inviteModal = page.locator('.room-invite-modal-overlay');
    await expect(inviteModal).toBeVisible();
    await inviteModal.locator('.ready-close-btn').click();
    await expect(inviteModal).not.toBeVisible();
  });
});
