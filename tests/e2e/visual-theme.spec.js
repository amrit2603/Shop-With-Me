import { test, expect } from '@playwright/test';

test('new theme keeps entry usable from 320px, with focus and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter demo', exact: true })).toBeVisible();
  for (const width of [320, 375, 480, 700, 768, 900, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const name of ['Enter demo', 'Join with a code']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  }
  const input = page.getByLabel('Your name', { exact: true });
  await input.focus();
  await expect(input).toBeFocused();
  expect(await input.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  expect(await page.locator('.demo-orb-body').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.locator('body').evaluate(el => getComputedStyle(el, '::before').animationName)).toBe('none');
  await expect(page.getByLabel('Sample party preview')).toContainText('preview only');
});

test('theme text and control token pairs meet AA contrast', async ({ page }) => {
  await page.goto('/');
  const ratios = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const read = name => css.getPropertyValue(`--${name}`).trim();
    const luminance = hex => {
      const channels = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
        .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    return [['text','surface'],['text-muted','surface'],['text-subtle','surface'],['accent','surface'],['primary-fg','primary'],['border-hover','surface']].map(([a,b]) => {
      const values = [luminance(read(a)),luminance(read(b))].sort((x,y) => y-x);
      return { a, b, ratio: (values[0]+.05)/(values[1]+.05) };
    });
  });
  for (const pair of ratios) expect(pair.ratio, `${pair.a}/${pair.b}`).toBeGreaterThanOrEqual(pair.a === 'border-hover' ? 3 : 4.5);
});

test('URL entry keeps the complete action inside its mobile panel', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your name', { exact: true }).fill('Nora');
  await page.getByRole('button', { name: 'Enter demo', exact: true }).click();
  await page.getByRole('button', { name: 'Paste a product URL', exact: true }).click();
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    const action = page.locator('.custom-input-row').getByRole('button', { name: 'Add to room', exact: true });
    const button = await action.boundingBox();
    const panel = await page.locator('.custom-source-panel').boundingBox();
    expect(button.x + button.width).toBeLessThanOrEqual(panel.x + panel.width);
    expect(await action.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
