const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {spawn} = require('node:child_process');
const root = path.resolve(process.env.VYUMI_CAPTURE_ROOT || path.join(__dirname, '..'));
const {chromium} = require(path.join(root,'node_modules/playwright'));
const phase = process.argv[2] || 'after';
if (!['before','after'].includes(phase)) throw Error('Use before or after');
const out = path.join(root,'docs/screens/orb',phase);
fs.mkdirSync(out,{recursive:true});
const base='http://localhost:3012';
const server=spawn(process.execPath,['src/server.js'],{cwd:path.join(root,'backend'),env:{...process.env,PORT:'3012',FRONTEND_URL:base,NODE_ENV:'test',DATABASE_PATH:path.join(os.tmpdir(),`orb-${Date.now()}.sqlite`)},stdio:'pipe'});
let logs='';server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
(async()=>{
 let browser;
 try {
  for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  browser=await chromium.launch();
  const host=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const page=await host.newPage();
  async function shot(p,name){for(const width of [1280,375,320]){await p.setViewportSize({width,height:900});if(width<=375 && ['chat','votes'].includes(name))await p.locator('.room-mobile-tabs .mobile-tab-btn').nth(name==='chat'?1:2).click();await p.evaluate(()=>scrollTo(0,0));await p.evaluate(()=>document.fonts.ready);if(width!==320)await p.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true,animations:'disabled'});const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error(`Overflow ${name} ${width}`);}if(['chat','votes'].includes(name))await p.locator('.room-mobile-tabs .mobile-tab-btn').nth(0).click();await p.setViewportSize({width:1280,height:900});}
  await page.goto(base);await page.getByRole('button',{name:'Enter demo',exact:true}).waitFor();await shot(page,'landing');
  await page.getByLabel('Your name',{exact:true}).fill('Riya');await page.getByRole('button',{name:'Enter demo',exact:true}).click();await page.locator('#room-title-input').waitFor();await page.locator('.catalog-cards-grid .btn-card-action').first().waitFor();await shot(page,'builder');await page.getByRole('button',{name:'Paste a product URL',exact:true}).click();await shot(page,'url-input');await page.getByRole('button',{name:'Upload a screenshot',exact:true}).click();await shot(page,'screenshot-input');await page.getByRole('button',{name:'Browse demo catalog',exact:true}).click();
  await page.locator('#room-title-input').fill('Find our favourite');for(let i=0;i<3;i++)await page.locator('.catalog-cards-grid .btn-card-action').nth(i).click();await page.getByRole('button',{name:'Start Shopping Party',exact:true}).click();await page.locator('.party-stage').waitFor();const roomURL=page.url();
  const gc=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const guest=await gc.newPage();await guest.goto(roomURL);await guest.getByLabel('Your display name',{exact:true}).waitFor();await shot(guest,'guest-entry');await guest.getByLabel('Your display name',{exact:true}).fill('Avery');await guest.getByRole('button',{name:'Join Room',exact:true}).click();await guest.locator('.connection-text').filter({hasText:'Live'}).waitFor();
  await page.locator('.party-rail>div>button').nth(1).click();await page.locator('.party-reactions button').first().click();await guest.locator('.party-reactions button').nth(1).click();
  await shot(page,'party');await page.getByLabel('Message friends',{exact:true}).fill('Shall we compare these?');await page.locator('.chat-panel').getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('log').filter({hasText:'Shall we compare these?'}).waitFor();await shot(page,'chat');
  await page.locator('.room-code-tag-btn').click();await shot(page,'invite');await page.getByLabel('Close dialog',{exact:true}).click();
  await page.locator('.party-shortlist>summary').click();await page.getByRole('button',{name:'♡ Save for me',exact:true}).first().click();
  await page.goto(base+'/saved');await shot(page,'saved');await page.goto(roomURL);await page.locator('.party-stage').waitFor();
  await page.locator('.sidebar-tab-btn').nth(1).click();await shot(page,'votes');await page.locator('.sidebar-tab-btn').first().click();
  await page.locator('.party-controls>summary').click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'End party',exact:true}).click();await page.locator('.party-result').waitFor();await page.getByRole('link',{name:'View public result',exact:true}).waitFor();await shot(page,'result');
  const publicPage=await gc.newPage();await publicPage.goto(await page.getByRole('link',{name:'View public result',exact:true}).getAttribute('href'));await shot(publicPage,'public-result');
  const download=page.waitForEvent('download');await page.locator('.party-result').getByRole('button',{name:'Download image',exact:true}).click();await (await download).saveAs(path.join(out,'party-export.png'));
  await page.goto(base);await page.locator('#room-title-input').fill('Standard room');for(let i=0;i<2;i++)await page.locator('.catalog-cards-grid .btn-card-action').nth(i).click();await page.getByText('Room options',{exact:true}).click();await page.getByLabel('Start as a live shopping party',{exact:true}).uncheck();await page.locator('.btn-create-inline').click();await page.locator('#room-ready-card').waitFor();await shot(page,'room-ready');const standardURL=await page.locator('.room-ready-link-input').inputValue();await page.goto(standardURL);await page.locator('.room-products-grid').waitFor();await shot(page,'standard-room');
  const empty=await gc.newPage();empty.on('pageerror',e=>console.error('PAGE ERROR',e.message));await empty.goto(base);await empty.getByLabel('Your name',{exact:true}).fill('Empty List');await empty.getByRole('button',{name:'Enter demo',exact:true}).click();await empty.locator('#room-title-input').waitFor();await empty.goto(base+'/saved');await shot(empty,'saved-empty');await empty.goto(base+'/room/not-a-real-room');await empty.locator('.room-state--error').waitFor();await shot(empty,'room-error');
  for(const f of fs.readdirSync(out).filter(n=>n.endsWith('-1280.png'))) { const mobile=path.join(out,f.replace('-1280.png','-375.png'));if(!fs.existsSync(mobile))throw Error('Missing mobile capture '+f); }
  console.log('CAPTURE PASS '+phase+' '+fs.readdirSync(out).filter(n=>n.endsWith('-1280.png')).length+' surfaces x 2 capture widths + 320px overflow checks, plus PNG export');
 } catch(e){console.error(e);console.error(logs.slice(-1500));process.exitCode=1;}
 finally {await browser?.close();server.kill();}
})();

