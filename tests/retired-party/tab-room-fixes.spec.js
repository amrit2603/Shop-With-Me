import { test, expect } from "@playwright/test";
test("acceptance: same-browser tabs, private saves, comments, follow controls and complete cards", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const errors = [];
  const watch = (p) => {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
  };
  watch(page);
  context.on("page", watch);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const bounds = await page.locator("#root").boundingBox();
  expect(bounds.x).toBe(20);
  expect(bounds.width).toBe(1240);
  expect(await page.locator("#root").evaluate(el=>parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThan(0);
  await page.screenshot({
    path: "docs/screens/tab-fixes-landing-1280.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screens/tab-fixes-landing-375.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByLabel("Your name", { exact: true }).fill("Amrit");
  await page.getByRole("button", { name: "Enter demo", exact: true }).click();
  await page.locator("#room-title-input").fill("Two-tab shopping");
  for (let i = 0; i < 3; i++)
    await page.locator(".catalog-cards-grid .btn-card-action").nth(i).click();
  await page
    .getByRole("button", { name: "Start Shopping Party", exact: true })
    .click();
  await expect(page.locator(".party-stage")).toBeVisible();
  const invite = page.url();
  const inherited = await page.evaluate(() =>
    Object.fromEntries(Object.entries(sessionStorage)),
  );
  const duplicate = await context.newPage();
  await duplicate.addInitScript((values) => {
    if (!window.name) {
      for (const [k, v] of Object.entries(values)) sessionStorage.setItem(k, v);
      window.name = "inherited-test-session";
    }
  }, inherited);
  await duplicate.goto("/");
  await expect(
    duplicate.getByRole("button", { name: "Enter demo", exact: true }),
  ).toBeEnabled();
  await expect(duplicate.locator(".user-chip-name")).toHaveCount(0);
  expect(
    await duplicate.evaluate(() => sessionStorage.getItem("vyumi_tab_token")),
  ).toBeNull();
  await duplicate.close();
  const b = await context.newPage();
  await b.goto("/");
  await expect(
    b.getByRole("button", { name: "Enter demo", exact: true }),
  ).toBeVisible();
  await expect(b.locator(".user-chip-name")).toHaveCount(0);
  // User requested invitation retention instead of a guard redirect that clears the input.
  await b.getByRole("textbox", {name:"Room code or link",exact:true}).fill(invite);
  await b.getByRole("button", {name:"Join with a code",exact:true}).click();
  await expect(b).toHaveURL("http://localhost:5173/");
  await expect(b.getByRole("textbox", {name:"Room code or link",exact:true})).toHaveValue(invite);
  await expect(b.getByLabel("Your display name", {exact:true})).toBeFocused();
  await expect(b.getByRole("button",{name:"Join Room",exact:true})).toBeInViewport();
  await b.setViewportSize({width:375,height:812});
  await expect(b.getByRole("button",{name:"Join Room",exact:true})).toBeInViewport();
  expect(await b.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await b.screenshot({path:"docs/screens/simplified-invite-mobile.png",fullPage:true});
  await b.setViewportSize({width:1280,height:900});
  await b.screenshot({path:"docs/screens/simplified-invite-name.png",fullPage:true});
  await b.getByLabel("Your display name", { exact: true }).fill("Blair");
  await b.getByRole("button", { name: "Join Room", exact: true }).click();
  await expect(b.locator(".connection-text")).toHaveText("Live");
  await page.reload();
  await expect(page.locator(".user-chip-name")).toHaveText("Amrit");
  await expect(b.locator(".user-chip-name")).toHaveText("Blair");
  await expect(page.getByLabel("Party presence")).toContainText(
    "2 in the room",
  );
  await page.locator(".room-code-tag-btn").click();
  const share = page.locator("#room-ready-card");
  const code=(await share.locator('.large-code-display').textContent()).trim();
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(code);
  await page.evaluate(()=>navigator.clipboard.writeText('impeccable'));
  await share.getByRole('button',{name:`Copy room code ${code}`,exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(code);
  await expect(share.getByRole('status')).toHaveText('Code copied!');
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
  await share.getByRole('button',{name:'Share',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(invite);
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__sharedInvitation=data;}}));
  await share.getByRole('button',{name:'Share',exact:true}).click();
  expect((await page.evaluate(()=>window.__sharedInvitation)).url).toBe(invite);

  const nativeBox=await share.getByRole("button",{name:"Share",exact:true}).boundingBox();
  const whatsappBox=await share.getByRole("link",{name:"Share on WhatsApp",exact:true}).boundingBox();
  expect(whatsappBox.x).toBeGreaterThan(nativeBox.x+nativeBox.width);
  await share.screenshot({path:"docs/screens/tab-fixes-share-card.png"});
  const codeGuest=await context.newPage();
  await codeGuest.goto("/");
  await codeGuest.getByRole("textbox",{name:"Room code or link",exact:true}).fill(code);
  await codeGuest.getByRole("button",{name:"Join with a code",exact:true}).click();
  await expect(codeGuest.getByRole("textbox",{name:"Room code or link",exact:true})).toHaveValue(code);
  await codeGuest.getByLabel("Your display name",{exact:true}).fill("Drea");
  await codeGuest.getByRole("button",{name:"Join Room",exact:true}).click();
  await expect(codeGuest.locator(".party-stage")).toBeVisible();
  await expect(codeGuest.locator(".user-chip-name")).toHaveText("Drea");
  await codeGuest.getByRole("button",{name:"Leave room / Log out",exact:true}).click();
  await codeGuest.close();
  expect(new URL(await share.getByRole("link",{name:"Share on WhatsApp",exact:true}).getAttribute("href")).searchParams.get("text")).toContain(invite);
  await expect(
    share.locator(".btn-copy-link"),
  ).toBeVisible();
  await expect(
    share.getByRole("link", { name: "Share on WhatsApp", exact: true }),
  ).toHaveAttribute("href", new RegExp("^https://wa.me/"));
  await expect(
    share.locator(".btn-copy-code,.ready-qr-box"),
  ).toHaveCount(0);
  expect(await share.locator("button:not(.ready-close-btn)").count()).toBe(3);
  await share.locator(".btn-copy-link").click();
  await expect(
    share.getByRole("button", { name: "Copied!", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    invite,
  );
  await page.getByLabel("Close dialog", { exact: true }).click();
  const rail = page.locator(".party-rail>div>button");
  await rail.nth(1).click();
  await expect(page.getByTestId("party-current-product")).toHaveText(
    await rail.nth(1).getAttribute("title"),
  );
  const product = await page.getByTestId("party-current-product").textContent();
  await expect(b.getByTestId("party-current-product")).toHaveText(product);
  const comments = page.locator(".party-comments");
  await expect(
    comments.getByRole("button", { name: "Post comment", exact: true }),
  ).toBeDisabled();
  await comments
    .getByLabel("Write a comment or question")
    .fill("Check this with me");
  await comments.getByLabel("Write a comment or question").press("Enter");
  await expect(b.locator(".party-comments .comment-message")).toHaveText(
    "Check this with me",
  );
  await b.reload();
  await expect(b.locator(".party-comments .comment-message")).toHaveText(
    "Check this with me",
  );
  await expect(b.locator(".party-comments .comment-username")).toHaveText("Amrit");
  await expect(b.locator(".party-comments time")).toHaveAttribute(
    "datetime",
    /.+/,
  );
  await page
    .locator(".party-notes")
    .getByRole("button", { name: "♡ Save for me", exact: true })
    .click();
  await expect(
    page
      .locator(".party-notes")
      .getByRole("button", { name: "Saved – copy link", exact: true }),
  ).toBeVisible();
  await page
    .locator(".party-notes")
    .getByRole("button", { name: "Saved – copy link", exact: true })
    .click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain("/product/");
  await b.goto("/saved");
  await expect(
    b.getByText("No saved products yet.", { exact: false }),
  ).toBeVisible();
  await b.goto(invite);
  await expect(b.locator(".connection-text")).toHaveText("Live");
  await page.goto("/saved");
  await expect(
    page.getByRole("heading", { name: product, exact: true }),
  ).toBeVisible();
  await page.goto(invite);
  await expect(page.locator(".connection-text")).toHaveText("Live");
  await page.locator(".party-rail>div>button").nth(2).click();
  const c = await context.newPage();
  await c.goto(link);
  await c.getByLabel("Your display name", { exact: true }).fill("Casey");
  await c.getByRole("button", { name: "Join Room", exact: true }).click();
  await expect(c.getByTestId("party-current-product")).toHaveText(product);
  await c
    .getByRole("button", { name: "Leave room / Log out", exact: true })
    .click();
  await expect(
    c.getByRole("button", { name: "Enter demo", exact: true }),
  ).toBeVisible();
  expect(
    await c.evaluate(() => sessionStorage.getItem("vyumi_tab_token")),
  ).toBeNull();
  expect(
    await c.evaluate(() => sessionStorage.getItem("vyumi_current_room")),
  ).toBeNull();
  await c.close();
  const manage = async (p) => {
    if ((await p.locator(".party-controls").getAttribute("open")) === null)
      await p.locator(".party-controls>summary").click();
  };
  await manage(page);
  await page.getByLabel("Party mode", { exact: true }).selectOption("explore");
  await b.locator(".party-rail>div>button").nth(0).click();
  await expect(b.getByTestId("party-current-product")).toHaveText(
    await b.locator(".party-rail>div>button").nth(0).getAttribute("title"),
  );
  const first = await b.getByTestId("party-current-product").textContent();
  await page
    .getByLabel("Choose a person", { exact: true })
    .selectOption({ label: "Blair" });
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.getByTestId("party-current-product")).toHaveText(first);
  await expect(page.locator(".party-notes").getByRole("button",{name:"♡ Save for me",exact:true})).toBeVisible();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"docs/screens/tab-fixes-manage-party.png",fullPage:true});
  await manage(b);
  await expect(b.getByLabel("Party members")).toContainText("Following Blair");
  await b.locator(".party-rail>div>button").nth(1).click();
  await expect(page.getByTestId("party-current-product")).toHaveText(product);
  await page.getByRole("button", { name: "Unfollow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Let this person lead", exact: true })
    .click();
  await expect(b.getByLabel("Party mode", { exact: true })).toBeVisible();
  await b
    .getByLabel("Choose a person", { exact: true })
    .selectOption({ label: "Amrit" });
  await b
    .getByRole("button", { name: "Let this person lead", exact: true })
    .click();
  await expect(page.getByLabel("Party mode", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await b
    .getByRole("button", { name: "Leave room / Log out", exact: true })
    .click();
  await expect(page.getByLabel("Party presence")).toContainText(
    "1 in the room",
  );
  await expect(
    page.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("No other friends online.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Follow Amrit", exact: true }),
  ).toHaveCount(0);
  const help = page.locator(".party-host");
  // Product questions/comparison are primary; the existing quick selector is optional.
  await help.locator(".party-quick-choices>summary").click();
  await help.getByRole("button", { name: "Any budget", exact: true }).click();
  await help.getByRole("button", { name: "Price", exact: true }).click();
  await help
    .getByRole("button", { name: "No preference", exact: true })
    .click();
  await expect(help.locator(".quick-recommendations li")).toHaveCount(3);
  await expect(help).toContainText("Top recommendation");
  await help.screenshot({path:"docs/screens/tab-fixes-recommendations.png"});
  await help.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(help).toContainText("1 of 3");
  await page
    .locator(".party-reactions")
    .getByRole("button", { name: "Love it", exact: true })
    .click();
  await page.locator(".sidebar-tab-btn").filter({ hasText: "Votes" }).click();
  const cards = page.locator(".vote-product-cards .room-product-card");
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    await expect(card.locator(".card-expanded-details")).not.toHaveAttribute("open", "");
    expect((await card.boundingBox()).height).toBeLessThan(360);
    await expect(card.locator("img")).toBeVisible();
    await card.locator(".card-expanded-details>summary").click();
    await expect(card).toContainText("Added by: Amrit");
    await expect(card).toContainText("Store/source:");
    await expect(card).toContainText("Voted by:");
    await expect(card.locator(".product-specs")).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Share", exact: true }),
    ).toBeVisible();
    await card.locator(".card-expanded-details>summary").click();
  }
  await page.locator(".vote-product-cards").evaluate(el=>{el.scrollTop=0;});
  const voteList=await page.locator(".vote-product-cards").evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));
  expect(voteList.height).toBeLessThanOrEqual(680);
  expect(voteList.scroll).toBeGreaterThan(voteList.height);
  await page.getByRole("button",{name:/Current participant: Amrit/}).click();
  const leave=page.getByRole("menuitem",{name:"Leave demo",exact:true});
  await expect(leave).toBeVisible();
  expect(await leave.evaluate(el=>getComputedStyle(el).justifyContent)).toBe("center");
  await expect.poll(()=>page.locator(".navbar-chip-dropdown").evaluate(el=>getComputedStyle(el).opacity)).toBe("1");
  await page.screenshot({path:"docs/screens/simplified-identity-menu.png"});
  await page.getByRole("button",{name:/Current participant: Amrit/}).click();
  await expect(
    page.locator(".vote-product-cards .product-winner"),
  ).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screens/tab-fixes-room-1280.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator(".room-mobile-tabs .mobile-tab-btn").nth(2).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screens/tab-fixes-votes-375.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
