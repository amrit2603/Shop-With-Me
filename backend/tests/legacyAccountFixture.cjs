// Existing token-authorization scenarios intentionally exercise legacy rooms.
// Supply a real hashed session to the now-authenticated creation endpoint, then
// migrate that fixture to legacy ownership without changing any assertions.
const crypto=require('node:crypto');
const {getDb}=require('../src/db/database');
const {digest}=require('../src/services/accountSessions');
function headers(){const db=getDb();const id='legacy-fixture-user';db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?,?)').run(id,'fixture@example.test','Fixture host','not-used-for-password-login',Date.now(),null);const token=crypto.randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),id,Date.now()+3600000,Date.now());return {Cookie:'vyumi_session='+token,Origin:'http://localhost:3001'};}
function legacy(room){if(room?.id)getDb().prepare('UPDATE rooms SET creator_user_id=NULL WHERE id=?').run(room.id);}
module.exports={headers,legacy};
