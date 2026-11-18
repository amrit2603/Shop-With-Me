import {test,expect} from '@playwright/test';
test('verified host identity and anonymous guest identity remain independent',async({page,browser})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('vyumi_last_user_name','Old Guest'));
 await page.reload();await expect(page.getByText('Old Guest',{exact:true})).toHaveCount(0);
 await page.goto('/signin');
 await expect(page.getByRole('button',{name:'Create account',exact:true})).toHaveCount(0);
 await page.getByLabel('Your name',{exact:true}).fill('Avery');
 await page.getByRole('button',{name:'Enter demo',exact:true}).click();
 await expect(page.locator('.navbar-user-area')).toContainText('Avery');
 await page.getByLabel('Room name',{exact:false}).fill('Weekend choices');
 const add=page.getByRole('button',{name:'+ Add to room',exact:true});await add.nth(0).click();await add.nth(0).click();
 await page.getByText('Room options',{exact:true}).click();
 await page.getByRole('button',{name:'Create room & get link'}).click();
 await page.getByRole('button',{name:/Open live room/i}).click();
 await expect(page.locator('.navbar-user-area')).toContainText('Avery');
 await expect(page.locator('.connection-text')).toHaveText('Live');
 await page.screenshot({path:'docs/screens/l1-host.png',fullPage:true});
 const context=await browser.newContext();const guest=await context.newPage();await guest.goto(page.url());
 await expect(guest.locator('.user-chip-name')).toHaveCount(0);
 await guest.getByPlaceholder(/name/i).fill('Blair');await guest.getByRole('button',{name:/join room/i}).click();
 await expect(guest.locator('.navbar-user-area')).toContainText('Blair');
 await expect(page.locator('.user-chip-name')).toContainText('Avery');
 await expect(guest.locator('.connection-text')).toHaveText('Live');
 await guest.screenshot({path:'docs/screens/l1-guest.png',fullPage:true});await context.close();
});

