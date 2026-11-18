import { test, expect } from "@playwright/test";
test("name-only demo: four screens navigate, react, compare, transfer, explore and share", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Your name", { exact: true }).fill("Riya");
  await page.getByRole("button", { name: "Enter demo", exact: true }).click();

  await page.locator("#room-title-input").fill("Our shopping party");
  const add = page.locator(".catalog-cards-grid .btn-card-action");
  await add.nth(0).click();
  await add.nth(1).click();
  await page.getByRole('button',{name:'Start Shopping Party',exact:true}).click();
  await expect(page.locator(".party-stage")).toBeVisible();
  await expect(page.locator(".connection-text")).toHaveText("Live");
  await expect(page.getByLabel('Party mode',{exact:true})).toBeHidden();
  // Latest request: visible questions and a separate small comment thread.
  await expect(page.getByLabel('Ask about this product',{exact:true})).toBeVisible();
  await expect(page.locator('.party-quick-choices')).not.toHaveAttribute('open','');
  await expect(page.locator('.party-notes').getByRole('button',{name:'Share',exact:true})).toBeHidden();
  await page.locator('.party-notes .product-extra-actions>summary').click();
  await expect(page.locator('.party-notes').getByRole('button',{name:'Share',exact:true})).toBeVisible();
  await page.locator('.party-notes .product-extra-actions>summary').click();
  await expect(page.locator('.party-comments .discussion-input')).toBeVisible();
  await expect(page.locator('.party-host>summary')).toHaveText('Product help');
  await expect(page.locator('.host-badge')).toHaveText('Leading');
  await expect(page.locator('.party-stage').getByRole('button',{name:'End party',exact:true})).toBeHidden();
  await page.screenshot({path:'docs/screens/compact-party-default.png',fullPage:true});

  const guests = [];
  const contexts = [];
  for (const name of ["Avery", "Blair", "Casey"]) {
    const context = await browser.newContext();
    contexts.push(context);
    const p = await context.newPage();
    guests.push(p);
    await p.goto(page.url());
    await p.getByLabel("Your display name", { exact: true }).fill(name);
    await p.getByRole("button", { name: "Join Room", exact: true }).click();
    await expect(p.locator(".party-stage")).toBeVisible();
    await expect(p.locator(".connection-text")).toHaveText("Live");
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await expect(page.getByLabel('Party presence')).toContainText('4 in the room');
  await expect(page.locator('.party-avatar')).toHaveCount(4);
  await page.screenshot({path:'docs/screens/compact-party-default.png',fullPage:true});
  await guests[2].setViewportSize({width:375,height:812});
  await guests[2].evaluate(()=>window.scrollTo(0,0));
  await expect(guests[2].locator('.party-stage').getByRole('button',{name:'Love it',exact:true})).toBeInViewport();
  const tabs=await guests[2].locator('.room-mobile-tabs').boundingBox();
  for(const label of ['Love it','Looks great','Not for me','Unsure']){const box=await guests[2].locator('.party-stage').getByRole('button',{name:label,exact:true}).boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(tabs.y);}
  await guests[2].screenshot({path:'docs/screens/compact-party-mobile-default.png',fullPage:true});
  await guests[2].setViewportSize({width:1280,height:720});
  const all = [page, ...guests];
  const first = await page.getByTestId("party-current-product").textContent();
  const rail = page.locator(".party-rail>div>button:first-child");
  const second = await rail.nth(1).getAttribute("aria-label");
  await page.getByRole("button",{name:"Next product",exact:true}).click();
  for (const p of all)
    await expect(p.getByTestId("party-current-product")).toHaveText(
      second.slice(5),
    );
  await page.getByLabel('Message friends', { exact: true }).fill('What do you think of this one?');
  await page.locator('.chat-panel').getByRole('button', { name: 'Send', exact: true }).click();
  for (const p of all) {
    await expect(p.locator('.chat-panel').getByRole('log')).toContainText('What do you think of this one?');
    await expect(p.locator('.chat-bubble').filter({hasText:'What do you think of this one?'}).locator('.chat-product-badge')).toHaveCount(0);
  }
  const tag=page.getByLabel('Tag a product (optional)',{exact:true});
  await page.locator('.chat-tag-details>summary').click();
  await tag.selectOption({index:1});
  await page.getByLabel('Message friends',{exact:true}).fill('I mean this one');
  await page.locator('.chat-panel').getByRole('button',{name:'Send',exact:true}).click();
  for(const p of all) await expect(p.locator('.chat-bubble').filter({hasText:'I mean this one'}).locator('.chat-product-badge')).toHaveCount(1);
  await tag.selectOption('');
  await page.getByLabel('Message friends',{exact:true}).fill('Just chatting now');
  await page.locator('.chat-panel').getByRole('button',{name:'Send',exact:true}).click();
  for(const p of all) {
    const message=p.locator('.chat-bubble').filter({hasText:'Just chatting now'});
    await expect(message).toBeVisible();
    await expect(message.locator('.chat-product-badge')).toHaveCount(0);
  }
  await guests[1].reload();
  await expect(guests[1].locator('.chat-bubble').filter({hasText:'Just chatting now'})).toBeVisible();
  await expect(guests[1].locator('.chat-bubble').filter({hasText:'Just chatting now'}).locator('.chat-product-badge')).toHaveCount(0);
  await expect(guests[1].locator('.chat-bubble').filter({hasText:'I mean this one'}).locator('.chat-product-badge')).toHaveCount(1);
  const productHelp=page.locator('.party-host');
  await productHelp.getByLabel('Ask about this product',{exact:true}).fill('What does it cost?');
  await productHelp.getByRole('button',{name:'Ask VYUMI',exact:true}).click();
  await expect(productHelp.locator('.party-host-note')).toContainText(second.slice(5));
  await expect(productHelp.locator('.party-host-note')).toContainText(/₹|Price unknown/);
  await productHelp.locator('.party-compare-options>summary').click();
  await productHelp.getByRole('button',{name:'Compare products',exact:true}).click();
  for(const p of all) {
    await expect(p.getByRole('table',{name:'Product comparison'})).toContainText(first);
    await expect(p.getByRole('table',{name:'Product comparison'})).toContainText(second.slice(5));
  }
  await productHelp.getByRole('button',{name:'Dismiss answer',exact:true}).click();
  await productHelp.locator('.party-compare-options>summary').click();
  await page.locator('.party-comments .discussion-input').fill('The group is comparing this option.');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  for (const p of all) await expect(p.locator('.party-comments')).toContainText('The group is comparing this option.');
  await page
    .locator(".party-stage")
    .getByRole("button", { name: "Love it", exact: true })
    .click();
  await guests[0]
    .locator(".party-stage")
    .getByRole("button", { name: "Love it", exact: true })
    .click();
  await guests[1]
    .locator(".party-stage")
    .getByRole("button", { name: "Not for me", exact: true })
    .click();
  await guests[2]
    .locator(".party-stage")
    .getByRole("button", { name: "Not for me", exact: true })
    .click();
  await expect(page.locator(".party-host")).toHaveAttribute("open", "");
  // Keep the optional three-question selection; restore questions/comparison above it.
  const help=page.locator('.party-host');
  await help.locator('.party-quick-choices>summary').click();
  await help.getByRole('button',{name:'Any budget',exact:true}).click();
  await help.getByRole('button',{name:'Price',exact:true}).click();
  await help.getByRole('button',{name:'No preference',exact:true}).click();
  await expect(help.locator('.quick-recommendations li')).toHaveCount(2);
  await expect(help).toContainText('Top recommendation');
  await help.getByRole('button',{name:'Start over',exact:true}).click();
  await expect(help).toContainText('1 of 3');
  await help.locator('.party-quick-choices>summary').click();
  await page.locator('.party-tools').screenshot({path:'docs/screens/product-tools-desktop.png',style:'.vyumi-navbar,.room-mobile-tabs {visibility:hidden}'});
  await page.setViewportSize({width:375,height:812});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.party-tools').screenshot({path:'docs/screens/product-tools-mobile.png',style:'.vyumi-navbar,.room-mobile-tabs {visibility:hidden}'});
  await page.setViewportSize({width:1280,height:720});
  await page.locator(".party-controls>summary").click();
  // Transfer now reuses the one member picker instead of a second duplicate selector.
  await page.getByLabel("Choose a person", {exact:true}).selectOption({label:"Avery"});
  await page.getByRole("button", {name:"Let this person lead",exact:true}).click();
  await guests[0].locator(".party-controls>summary").click();
  await expect(
    guests[0].getByLabel("Party mode", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Party mode", { exact: true })).toHaveCount(0);
  await guests[0]
    .getByLabel("Party mode", { exact: true })
    .selectOption("explore");
  await guests[1].locator(".party-rail>div>button:first-child").nth(0).click();
  await expect(guests[1].getByTestId("party-current-product")).toHaveText(
    first,
  );
  await expect(page.getByTestId("party-current-product")).toHaveText(
    second.slice(5),
  );
  // Existing independent following must not override the host's regroup action.
  await page.getByLabel("Choose a person",{exact:true}).selectOption({label:"Blair"});
  await page.getByRole("button",{name:"Follow",exact:true}).click();
  await expect(page.getByTestId("party-current-product")).toHaveText(first);
  await guests[1]
    .getByRole("button", { name: "Suggest this", exact: true })
    .click();
  await guests[0]
    .getByRole("button", { name: "Bring everyone here", exact: true })
    .click();
  for (const p of all)
    await expect(p.getByTestId("party-current-product")).toHaveText(first);
  await expect(page.getByRole("button",{name:"Unfollow",exact:true})).toBeDisabled();
  await guests[0].getByLabel("Party mode",{exact:true}).selectOption("host");
  await guests[0].getByRole("button",{name:"Next product",exact:true}).click();
  for (const p of all) await expect(p.getByTestId("party-current-product")).toHaveText(second.slice(5));
  await guests[0].reload();
  await expect(guests[0].locator(".connection-text")).toHaveText("Live");
  await guests[0].locator(".party-controls>summary").click();
  await guests[0].getByRole("button",{name:"Previous",exact:true}).click();
  for (const p of all) await expect(p.getByTestId("party-current-product")).toHaveText(first);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({
    path: "docs/screens/party-desktop.png",
    fullPage: true,
  });
  await guests[2].setViewportSize({ width: 375, height: 812 });
  await guests[2].evaluate(()=>window.scrollTo(0,0));
  await guests[2].screenshot({
    path: "docs/screens/party-mobile.png",
    fullPage: true,
  });
  expect(
    await guests[2].evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  guests[0].once("dialog", (d) => d.accept());
  await guests[0]
    .getByRole("button", { name: "End party", exact: true })
    .click();
  for (const p of all) await expect(p.locator(".party-result")).toBeVisible();
  await expect(page.locator(".party-result")).toContainText("4 participants");
  const share = await page
    .getByRole("link", { name: "View public result", exact: true })
    .getAttribute("href");
  const publicPage = await contexts[2].newPage();
  await publicPage.goto(share);
  await expect(publicPage.getByRole("heading", { level: 1 })).toContainText(
    "Four friends.",
  );
  await publicPage.screenshot({
    path: "docs/screens/party-public-result.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Revoke public link", exact: true })
    .click();
  await publicPage.reload();
  await expect(
    publicPage.getByRole("heading", { name: "This result is unavailable." }),
  ).toBeVisible();
  for (const c of contexts) await c.close();
});
