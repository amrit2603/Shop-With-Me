import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
process.env.DATABASE_PATH=path.join(os.tmpdir(),`vyumi-auth-${process.pid}.sqlite`);
const {getDb,closeDb}=require('../src/db/database');
const app=require('../src/server');
const {digest}=require('../src/services/accountSessions');
let server,base,cookie;
const origin='http://localhost:3001';
async function call(method,url,body,headers={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',Origin:origin,...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,retryAfter:r.headers.get('retry-after'),cookie:r.headers.get('set-cookie')?.split(';')[0],data:await r.json()};}
beforeAll(async()=>{server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;});
afterAll(async()=>{await new Promise(r=>server.close(r));closeDb();fs.rmSync(process.env.DATABASE_PATH,{force:true});});
describe('account session boundary',()=>{
 it('does not invent a logged-out identity',async()=>{expect((await call('GET','/api/auth/me')).data.user).toBeNull();});
 it('requires login for creation',async()=>{expect((await call('POST','/api/rooms',{title:'My room'})).status).toBe(401);});
 it('registers with a normalized email and hashed password/session',async()=>{const r=await call('POST','/api/auth/register',{email:'Avery@Example.com',password:'correct-horse-472!',displayName:'Avery'});expect(r.status).toBe(201);cookie=r.cookie;expect(r.data.user.email).toBe('avery@example.com');const db=getDb();expect(db.prepare('SELECT password_hash FROM users').get().password_hash).toMatch(/^\$2[aby]\$12\$/);expect(db.prepare('SELECT token_hash FROM sessions').get().token_hash).toBe(digest(cookie.split('=')[1]));});
 it('returns the verified account and creates an owned room',async()=>{expect((await call('GET','/api/auth/me',undefined,{Cookie:cookie})).data.user.displayName).toBe('Avery');const r=await call('POST','/api/rooms',{title:'Weekend shortlist'},{Cookie:cookie});expect(r.status).toBe(201);expect(getDb().prepare('SELECT creator_user_id FROM rooms WHERE id=?').get(r.data.room.id).creator_user_id).toBe(r.data.room.creatorUserId||getDb().prepare('SELECT id FROM users').get().id);const guest=await call('POST',`/api/rooms/${r.data.room.id}/participants`,{name:'Blair'});expect(guest.status).toBe(201);expect(guest.data.participant.name).toBe('Blair');expect((await call('POST',`/api/rooms/${r.data.room.id}/products`,{productId:'missing'},{'X-Creator-Token':r.data.creatorToken})).status).toBe(403);});
 it('rejects cross-origin and missing-origin cookie writes',async()=>{expect((await call('POST','/api/auth/logout',{}, {Cookie:cookie,Origin:'https://evil.example'})).status).toBe(403);expect((await call('POST','/api/auth/logout',{}, {Cookie:cookie,Origin:''})).status).toBe(403);});
 it('uses identical failures for an unknown email and wrong password',async()=>{const a=await call('POST','/api/auth/login',{email:'unknown@example.com',password:'wrong-pass'});const b=await call('POST','/api/auth/login',{email:'avery@example.com',password:'wrong-pass'});expect(a.status).toBe(401);expect(b.status).toBe(401);expect(a.data.error.message).toBe(b.data.error.message);});
 it('keeps account room credentials valid across two tabs',async()=>{
  const r=await call('POST','/api/rooms',{title:'Two tabs'},{Cookie:cookie});const id=r.data.room.id;
  const a=await call('POST',`/api/rooms/${id}/participants`,{name:'Spoofed'},{Cookie:cookie});
  const b=await call('POST',`/api/rooms/${id}/participants`,{name:'Spoofed again'},{Cookie:cookie});
  expect(a.data.participant.name).toBe('Avery');expect(b.data.participant.id).toBe(a.data.participant.id);
  const {verifyParticipantToken}=require('../src/store/roomStore');
  expect(verifyParticipantToken(id,a.data.participant.id,a.data.participantToken)).toBe(true);
  expect(verifyParticipantToken(id,b.data.participant.id,b.data.participantToken)).toBe(true);
 });
 it('slides a valid session expiry',async()=>{const before=Date.now()+3600000;getDb().prepare('UPDATE sessions SET expires_at=?').run(before);await call('GET','/api/auth/me',undefined,{Cookie:cookie});expect(getDb().prepare('SELECT expires_at FROM sessions').get().expires_at).toBeGreaterThan(before);});
 it('revokes on logout',async()=>{expect((await call('POST','/api/auth/logout',{}, {Cookie:cookie})).status).toBe(200);expect((await call('GET','/api/auth/me',undefined,{Cookie:cookie})).data.user).toBeNull();});
 it('logs in, then rejects an expired session',async()=>{const r=await call('POST','/api/auth/login',{email:'avery@example.com',password:'correct-horse-472!'});expect(r.status).toBe(200);getDb().prepare('UPDATE sessions SET expires_at=?').run(Date.now()-1);expect((await call('GET','/api/auth/me',undefined,{Cookie:r.cookie})).data.user).toBeNull();});
 it('rate limits attempts without bypassing test mode',async()=>{for(let i=0;i<3;i++)await call('POST','/api/auth/login',{email:'avery@example.com',password:'wrong-pass'});const r=await call('POST','/api/auth/login',{email:'avery@example.com',password:'wrong-pass'});expect(r.status).toBe(429);});
 it('limits the same email across independently forwarded client IPs',async()=>{
  app.set('trust proxy',ip=>ip==='127.0.0.1'||ip==='::ffff:127.0.0.1');
  try {
   for(let i=0;i<5;i++)expect((await call('POST','/api/auth/login',{email:'shared-target@example.test',password:'wrong-pass'},{'X-Forwarded-For':`192.0.2.${i+1}`})).status).toBe(401);
   const blocked=await call('POST','/api/auth/login',{email:'SHARED-TARGET@example.test',password:'wrong-pass'},{'X-Forwarded-For':'192.0.2.99'});
   expect(blocked.status).toBe(429);expect(Number(blocked.retryAfter)).toBeGreaterThan(0);
  } finally {app.set('trust proxy',false);}
 });

});

it('explicit tab sessions override cookies and logout cannot revoke another tab',async()=>{
 const a=await call('POST','/api/auth/demo',{displayName:'Alice'},{'X-Session-Token':'none'});
 const b=await call('POST','/api/auth/demo',{displayName:'Blair'},{Cookie:a.cookie,'X-Session-Token':'none'});
 expect((await call('GET','/api/auth/me',undefined,{Cookie:b.cookie,'X-Session-Token':a.data.sessionToken})).data.user.id).toBe(a.data.user.id);
 expect((await call('GET','/api/auth/me',undefined,{Cookie:a.cookie,'X-Session-Token':'invalid'})).data.user).toBeNull();
 await call('POST','/api/auth/logout',{}, {Cookie:a.cookie,'X-Session-Token':b.data.sessionToken});
 expect((await call('GET','/api/auth/me',undefined,{'X-Session-Token':a.data.sessionToken})).data.user.id).toBe(a.data.user.id);
 expect((await call('GET','/api/auth/me',undefined,{'X-Session-Token':b.data.sessionToken})).data.user).toBeNull();
});
