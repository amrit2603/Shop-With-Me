const crypto = require('node:crypto');
const { getDb } = require('../db/database');
const TTL = 7*24*60*60*1000;
const COOKIE = 'vyumi_session';
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
function cookie(res, token, maxAge=TTL) {
 res.cookie(COOKIE, token, {httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge,path:'/'});
}
function createSession(res,userId) {
 const token=crypto.randomBytes(32).toString('hex'); const now=Date.now();
 getDb().prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),userId,now+TTL,now);
 cookie(res,token); return token;
}
function readSession(req,res,next) {
 const token=req.headers['x-session-token'] ?? (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(token && /^[a-f0-9]{64}$/.test(token)) {
  const db=getDb(); const hash=digest(token);
  const row=db.prepare('SELECT u.id,u.email,u.display_name,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(hash);
  if(row && row.expires_at>Date.now()) {
   req.user={id:row.id,email:row.email,displayName:row.display_name}; req.sessionHash=hash;
   if(row.expires_at-Date.now()<TTL-60000) {db.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=?').run(Date.now()+TTL,hash);cookie(res,token);}
  } else if(row) {db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash);cookie(res,'',0);}
 }
 next();
}
function requireAccount(req,res,next) {return req.user ? next() : res.status(401).json({error:'Sign in to start a room.'});}
module.exports={TTL,COOKIE,digest,cookie,createSession,readSession,requireAccount};
