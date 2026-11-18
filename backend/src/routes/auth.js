const router=require('express').Router();
const bcrypt=require('bcryptjs');
const crypto=require('node:crypto');
const {z}=require('zod');
const {rateLimit}=require('express-rate-limit');
const {getDb}=require('../db/database');
const {containsProfanity}=require('../services/profanityFilter');
const {createSession,cookie}=require('../services/accountSessions');
const invalid='Email or password is incorrect';
const dummy=bcrypt.hashSync(crypto.randomBytes(32).toString('hex'),12);
const email=z.string().trim().toLowerCase().email().max(254);
const loginSchema=z.object({email,password:z.string().min(1).max(72)});
const registerSchema=loginSchema.extend({password:z.string().min(8).max(72).refine(p=>Buffer.byteLength(p)<=72 && !['password','password123','12345678','qwerty123','123456789'].includes(p.toLowerCase()),'Choose a stronger password.'),displayName:z.string().trim().min(2).max(24).refine(n=>/[\p{L}\p{N}]/u.test(n) && !/[<>]/.test(n) && !containsProfanity(n),'Choose a different display name.')});
const byIp=rateLimit({windowMs:900000,limit:5,standardHeaders:'draft-8',legacyHeaders:false,message:{error:invalid}});
const byEmail=rateLimit({windowMs:900000,limit:5,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:req=>crypto.createHash('sha256').update(String(req.body?.email||'').trim().toLowerCase()).digest('hex'),message:{error:invalid}});
router.post('/register',rateLimit({windowMs:900000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res,next)=>{
 try {
  const parsed=registerSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Enter a valid email, a strong password of 8–72 bytes, and a display name of 2–24 characters.'});
  const {email,password,displayName}=parsed.data;
  const passwordHash=await bcrypt.hash(password,12); const id=crypto.randomUUID(); const db=getDb();
  try {db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id,email,displayName,passwordHash,Date.now(),Date.now());}
  catch(e){if(e.code?.startsWith('SQLITE_CONSTRAINT'))return res.status(409).json({error:'An account with that email already exists.'});throw e;}
  const sessionToken=createSession(res,id);return res.status(201).json({user:{id,email,displayName},sessionToken});
 }catch(e){next(e);}
});
router.post('/login',byIp,byEmail,async(req,res,next)=>{
 try {
  const parsed=loginSchema.safeParse(req.body);
  const user=parsed.success?getDb().prepare('SELECT * FROM users WHERE email=?').get(parsed.data.email):null;
  const matches=await bcrypt.compare(parsed.success?parsed.data.password:'invalid',user?.password_hash||dummy);
  if(!user||!matches)return res.status(401).json({error:invalid});
  getDb().prepare('UPDATE users SET last_login_at=? WHERE id=?').run(Date.now(),user.id);
  const sessionToken=createSession(res,user.id);res.json({user:{id:user.id,email:user.email,displayName:user.display_name},sessionToken});
 }catch(e){next(e);}
});
router.post('/demo',rateLimit({windowMs:900000,limit:30,standardHeaders:'draft-8',legacyHeaders:false}),(req,res)=>{
 const parsed=registerSchema.shape.displayName.safeParse(req.body?.displayName);
 if(!parsed.success)return res.status(400).json({error:'Enter a name of 2–24 characters.'});
 if(req.sessionHash)getDb().prepare('DELETE FROM sessions WHERE token_hash=?').run(req.sessionHash);
 const id=crypto.randomUUID();const displayName=parsed.data;
 getDb().prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id,`demo-${id}@demo.invalid`,displayName,dummy,Date.now(),Date.now());
 const sessionToken=createSession(res,id);return res.status(201).json({user:{id,displayName,demo:true},sessionToken});
});
router.get('/me' ,(req,res)=>res.json({user:req.user||null}));
router.post('/logout',(req,res)=>{if(req.sessionHash)getDb().prepare('DELETE FROM sessions WHERE token_hash=?').run(req.sessionHash);cookie(res,'',0);res.json({ok:true});});
module.exports=router;
