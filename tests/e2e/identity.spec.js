import {signInHost} from './account-helper';
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

function searchForStringInDir(dir, searchStr) {
  const matches = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (['node_modules', '.git', 'dist', 'coverage', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    if (fullPath.includes('identity.spec.js')) continue;
    if (entry.isDirectory()) {
      matches.push(...searchForStringInDir(fullPath, searchStr));
    } else if (/\.(jsx?|tsx?|html|css|json|md)$/i.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.toLowerCase().includes(searchStr.toLowerCase())) {
        matches.push(fullPath);
      }
    }
  }
  return matches;
}

test.describe('R1: Identity - Scoped Per-Room & Per-Tab Identity', () => {
  test('repo has zero occurrences of Amrit Kumar', async () => {
    const rootDir = path.resolve(__dirname, '../../');
    const matches = searchForStringInDir(rootDir, 'Amrit Kumar');
    expect(matches, `Found 'Amrit Kumar' in: ${matches.join(', ')}`).toEqual([]);
  });

  test('two browser contexts + extra tab each see their own name at top and others in strip', async ({ browser }) => {
    // -------------------------------------------------------------
    // 1. Context A: Creator (Alice) creates a room
    // -------------------------------------------------------------
    const contextA = await browser.newContext();
    const pageAlice = await contextA.newPage();

    await signInHost(pageAlice,'Alice');
    await pageAlice.goto('/');

    // Select first 2 products
    const addButtons = pageAlice.locator('.catalog-cards-grid .btn-card-action');
    await expect(addButtons.first()).toBeVisible({ timeout: 15000 });
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();

    const titleInput = pageAlice.locator('#room-title-input, input[placeholder*="title"], input[placeholder*="Name"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('Fashion Identity Room');
    }

    const createButton = pageAlice.locator('.btn-create-inline');
    await expect(createButton).toBeEnabled();
    await pageAlice.getByText('Room options',{exact:true}).click();
    await createButton.click();

    const roomReadyCard = pageAlice.locator('#room-ready-card');
    await expect(roomReadyCard).toBeVisible({ timeout: 15000 });
    const shareUrl = await pageAlice.locator('.room-ready-link-input').inputValue();

    // Navigate to room
    await pageAlice.goto(shareUrl);
    await expect(pageAlice.locator('.room-title, h1')).toBeVisible({ timeout: 15000 });

    // The authenticated host joins automatically using the account name.
    // Assert Alice sees her own chip at the top bar with "Host" badge
    const aliceChip = pageAlice.locator('.navbar-current-user-chip');
    await expect(aliceChip).toBeVisible({ timeout: 10000 });
    await expect(aliceChip.locator('.user-chip-name')).toHaveText('Alice');
    await expect(aliceChip.locator('.host-badge')).toBeVisible();

    // -------------------------------------------------------------
    // 2. Context B, Tab 1: Friend (Bob) joins
    // -------------------------------------------------------------
    const contextB = await browser.newContext();
    const pageBob = await contextB.newPage();
    await pageBob.goto(shareUrl);

    // Bob enters name and joins
    const joinNameBob = pageBob.locator('input[aria-label="Your display name"]');
    await expect(joinNameBob).toBeVisible({ timeout: 15000 });
    await joinNameBob.fill('Bob');
    await pageBob.locator('button.btn-join-room').click();

    // Bob sees his own chip "Bob" (no Host badge)
    const bobChip = pageBob.locator('.navbar-current-user-chip');
    await expect(bobChip).toBeVisible({ timeout: 10000 });
    await expect(bobChip.locator('.user-chip-name')).toHaveText('Bob');
    await expect(bobChip.locator('.host-badge')).not.toBeVisible();

    // Bob sees Alice in the participants strip
    await expect(pageBob.locator('.navbar-participants-strip')).toBeVisible();
    await expect(pageBob.locator('.navbar-participants-strip .strip-avatar-wrap[title*="Alice"]')).toBeVisible({ timeout: 10000 });

    // Alice sees Bob in her participants strip
    await expect(pageAlice.locator('.navbar-participants-strip .strip-avatar-wrap[title*="Bob"]')).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------
    // 3. Context B, Tab 2: Extra tab in SAME browser context (Charlie)
    // -------------------------------------------------------------
    const pageCharlie = await contextB.newPage();
    await pageCharlie.goto(shareUrl);

    // Every new tab starts at explicit name entry, without Bob's identity.
    await expect(pageCharlie.getByLabel('Your display name',{exact:true})).toBeVisible();
    await expect(pageCharlie.getByRole('button',{name:'Continue as Bob',exact:false})).toHaveCount(0);

    // Enters Charlie
    const charlieInput = pageCharlie.locator('input[aria-label="Your display name"]');
    await expect(charlieInput).toBeVisible();
    await charlieInput.fill('Charlie');
    await pageCharlie.locator('button.btn-join-room').click();

    // Charlie sees "Charlie" at top of Tab 2
    const charlieChip = pageCharlie.locator('.navbar-current-user-chip');
    await expect(charlieChip).toBeVisible({ timeout: 10000 });
    await expect(charlieChip.locator('.user-chip-name')).toHaveText('Charlie');

    // Tab 1 is STILL Bob!
    await expect(pageBob.locator('.navbar-current-user-chip .user-chip-name')).toHaveText('Bob');

    // In Alice's strip, all 3 are visible
    await expect(pageAlice.locator('.navbar-participants-strip .strip-avatar-wrap[title*="Alice"]')).toBeVisible({ timeout: 10000 });
    await expect(pageAlice.locator('.navbar-participants-strip .strip-avatar-wrap[title*="Bob"]')).toBeVisible({ timeout: 10000 });
    await expect(pageAlice.locator('.navbar-participants-strip .strip-avatar-wrap[title*="Charlie"]')).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------
    // 4. Rename: Charlie renames to "Charles"
    // -------------------------------------------------------------
    await charlieChip.locator('.current-user-chip-btn').click();
    const changeNameBtn = pageCharlie.locator('.dropdown-action-btn:has-text("Change name")');
    await expect(changeNameBtn).toBeVisible();
    await changeNameBtn.click();

    // Fill rename modal
    const renameModal = pageCharlie.locator('.rename-modal-card');
    await expect(renameModal).toBeVisible();
    const renameInput = renameModal.locator('.rename-input');
    await renameInput.fill('Charles');
    await renameModal.locator('button:has-text("Save name")').click();

    // Tab 2 now shows Charles
    await expect(pageCharlie.locator('.navbar-current-user-chip .user-chip-name')).toHaveText('Charles');

    // Bob and Alice see the updated name "Charles" in their participants strip
    await expect(pageBob.locator('.navbar-participants-strip .strip-avatar-wrap[title*="Charles"]')).toBeVisible({ timeout: 10000 });
    await expect(pageAlice.locator('.navbar-participants-strip .strip-avatar-wrap[title*="Charles"]')).toBeVisible({ timeout: 10000 });

    await contextA.close();
    await contextB.close();
  });
});
