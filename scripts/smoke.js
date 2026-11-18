/* End-to-end delivery smoke test. Requires backend chat support and exercises the public API. */
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createServer } = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { io } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'socket.io-client'));

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function main() {
  const port = await freePort();
  const dbPath = path.join(os.tmpdir(), `vyumi-smoke-${process.pid}.sqlite`);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..', 'backend'),
    env: { ...process.env, PORT: String(port), FRONTEND_URL: base, DATABASE_PATH: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  const sockets = [];
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Server exited early: ${logs}`);
      try {
        const response = await fetch(`${base}/api/health`);
        if (response.ok) { ready = true; break; }
      } catch { /* wait for startup */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error(`Server did not become ready: ${logs}`);

    const registered=await fetch(`${base}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:'smoke@example.test',password:'Smoke-test-472!',displayName:'Smoke Host'})});
    if(registered.status!==201)throw new Error('Account registration failed: '+await registered.text());
    const ownerCookie=registered.headers.get('set-cookie').split(';')[0];
    const me=await fetch(`${base}/api/auth/me`,{headers:{Cookie:ownerCookie}});
    if((await me.json()).user?.displayName!=='Smoke Host')throw new Error('Session identity did not restore');
    const anonymous=await fetch(`${base}/api/rooms`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({title:'Anonymous room'})});
    if(anonymous.status!==401)throw new Error('Anonymous room creation was accepted');
    const call = async (method, url, body, headers = {}) => {
      const response = await fetch(`${base}${url}`, {
        method,
        headers: { 'content-type': 'application/json', Origin:base, ...((url==='/api/rooms'||(headers['X-Creator-Token']||headers.authorization))?{Cookie:ownerCookie}:{}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${JSON.stringify(data)}`);
      return data;
    };

    const { room, creatorId, creatorToken } = await call('POST', '/api/rooms', { title: 'Smoke test room' });
    const catalog = await call('GET', '/api/products');
    const product = catalog.products[0];
    await call('POST', `/api/rooms/${room.id}/products`, { productId: product.id }, { 'X-Creator-Token': creatorToken });
    const guests = await Promise.all(['Avery', 'Blair'].map((name) => call('POST', `/api/rooms/${room.id}/participants`, { name })));
    for (let index = 0; index < guests.length; index += 1) {
      await call('POST', `/api/rooms/${room.id}/products/${product.id}/votes`, {
        participantId: guests[index].participant.id, vote: index ? 'Like' : 'Love',
      }, { 'x-participant-token': guests[index].participantToken });
      await call('POST', `/api/rooms/${room.id}/products/${product.id}/comments`, {
        participantId: guests[index].participant.id, text: `Smoke comment ${index + 1}`,
      }, { 'x-participant-token': guests[index].participantToken });
    }

    const connect = () => new Promise((resolve, reject) => {
      const socket = io(base, { transports: ['websocket'], timeout: 3000 });
      sockets.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
    const [first, second] = await Promise.all([connect(), connect()]);
    for (const [index, socket] of [first, second].entries()) {
      socket.emit('room:join', { roomId: room.id, participantId: guests[index].participant.id, participantToken: guests[index].participantToken });
      await new Promise((resolve, reject) => {
        socket.once('room:joined', resolve);
        socket.once('room:error', reject);
        setTimeout(() => reject(new Error('Socket room join timed out')), 3000);
      });
    }
    const incoming = new Promise((resolve) => {
      second.once('chat:message', resolve);
    });
    const ack = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chat send acknowledgement timed out')), 2000);
      first.emit('chat:send', { text: 'Smoke chat message' }, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
    });
    if (!ack?.ok || !ack.message?.id) throw new Error(`Chat send failed: ${ack?.error || 'missing acknowledgement'}`);
    const received = await Promise.race([
      incoming,
      new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (received?.message?.id !== ack.message.id || received.message.text !== 'Smoke chat message') {
      throw new Error('Chat message payload did not match the persisted acknowledgement');
    }
    first.disconnect();
    sockets.splice(sockets.indexOf(first), 1);
    const reconnected = await connect();
    reconnected.emit('room:join', { roomId: room.id, participantId: guests[0].participant.id, participantToken: guests[0].participantToken });
    await new Promise((resolve, reject) => {
      reconnected.once('room:joined', resolve);
      reconnected.once('room:error', reject);
      setTimeout(() => reject(new Error('Socket reconnect join timed out')), 3000);
    });
    const history = await call('GET', `/api/rooms/${room.id}/messages?participantId=${guests[0].participant.id}`, undefined, { 'x-participant-token': guests[0].participantToken });
    const copies = history.messages.filter((message) => message.id === ack.message.id);
    if (copies.length !== 1 || copies[0].text !== 'Smoke chat message') {
      throw new Error(`Expected exactly one persisted chat message after reconnect, found ${copies.length}`);
    }

    // Attachment upload and linked chat message verification
    const form = new FormData();
    const pngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
    form.append('files', new Blob([pngBytes], { type: 'image/png' }), 'smoke-attach.png');
    const uploadRes = await fetch(`${base}/api/rooms/${room.id}/attachments`, {
      method: 'POST',
      headers: {
        'x-participant-id': guests[0].participant.id,
        'x-participant-token': guests[0].participantToken,
      },
      body: form,
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.attachments?.length) {
      throw new Error(`Attachment upload failed in smoke: ${JSON.stringify(uploadData)}`);
    }
    const uploadedAttId = uploadData.attachments[0].id;

    const attachAck = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chat send with attachment timed out')), 2000);
      reconnected.emit('chat:send', { text: 'Look at this photo', attachmentIds: [uploadedAttId] }, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
    });
    if (!attachAck?.ok || attachAck.message?.attachments?.[0]?.id !== uploadedAttId) {
      throw new Error(`Chat message with attachment failed in smoke: ${JSON.stringify(attachAck)}`);
    }

    const { summary } = await call('GET', `/api/rooms/${room.id}`);
    if (summary.totalVotesCast !== 2) throw new Error(`Expected 2 votes, got ${summary.totalVotesCast}`);
    const final = await call('PUT', `/api/rooms/${room.id}/final-choice`, { productId: product.id }, { authorization: `Bearer ${creatorToken}` });
    if (!final.summary?.finalChoice) throw new Error('Creator final choice was not persisted');
    if (!creatorId) throw new Error('Room creator identity missing');
    const demo=await fetch(`${base}/api/auth/demo`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({displayName:'Demo Visitor'})});
    if(demo.status!==201||(await demo.json()).user.displayName!=='Demo Visitor')throw new Error('Name-only demo entry failed');
    const hostMember=await call('POST',`/api/rooms/${room.id}/participants`,{name:'Smoke Host'},{Cookie:ownerCookie});
    const secondProduct=catalog.products[1];
    await call('POST',`/api/rooms/${room.id}/products`,{productId:secondProduct.id},{'X-Creator-Token':creatorToken});
    await call('POST',`/api/rooms/${room.id}/party`,{participantId:hostMember.participant.id,participantToken:hostMember.participantToken},{Cookie:ownerCookie});
    const hostSocket=await connect();
    const partyEmit=(socket,event,payload)=>new Promise((resolve,reject)=>socket.timeout(3000).emit(event,payload,(err,r)=>err?reject(err):resolve(r)));
    for(const [socket,member] of [[hostSocket,hostMember],[reconnected,guests[0]]]) {
      const joined=await partyEmit(socket,'party:join',{roomId:room.id,participantId:member.participant.id,participantToken:member.participantToken});
      if(!joined.ok)throw new Error('Party join failed: '+joined.error);
    }
    const stateReceived=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Party fan-out timed out')),3000);reconnected.once('party:state',p=>{clearTimeout(timer);resolve(p);});});
    const nav=await partyEmit(hostSocket,'party:navigate',{productId:secondProduct.id});
    if(!nav.ok||(await stateReceived).state.currentProductId!==secondProduct.id)throw new Error('Party synchronized navigation failed');
    const reaction=await partyEmit(reconnected,'party:react',{productId:secondProduct.id,vote:'Love'});
    if(!reaction.ok||reaction.totals.Love!==1)throw new Error('Party reaction failed');
    const comparison=await partyEmit(hostSocket,'party:host',{action:'compare',a:product.id,b:secondProduct.id});
    if(!comparison.ok||comparison.reply.rows[0][1]!==product.name)throw new Error('Party host comparison failed');
    if(!(await partyEmit(hostSocket,'party:transfer',{toParticipantId:guests[0].participant.id})).ok)throw new Error('Host transfer failed');
    const ended=await partyEmit(reconnected,'party:end',{});
    if(!ended.ok||ended.state.status!=='ended')throw new Error('Party end failed');
    if((await partyEmit(reconnected,'party:navigate',{productId:product.id})).ok)throw new Error('Ended party accepted navigation');
    const publicResult=await fetch(`${base}/r/${ended.state.shareId}`);
    if(!publicResult.ok||!(await publicResult.text()).includes('og:title'))throw new Error('Public party result failed');
    const loggedIn=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:'smoke@example.test',password:'Smoke-test-472!'})});
    if(loggedIn.status!==200)throw new Error('Login failed');
    const newCookie=loggedIn.headers.get('set-cookie').split(';')[0];
    const loggedOut=await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:newCookie},body:'{}'});
    if(!loggedOut.ok)throw new Error('Logout failed');
    const afterLogout=await fetch(`${base}/api/auth/me`,{headers:{Cookie:newCookie}});
    if((await afterLogout.json()).user)throw new Error('Logout session remains valid');
    console.log('SMOKE PASS: demo entry, synchronized party, reaction, host comparison/transfer, end/public result; register/login/logout/me and authenticated creation; room, 2 guests, 2 votes, 2 comments, live chat, reconnect history, summary, and final choice');
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(dbPath + suffix); } catch { /* already removed */ }
    }
  }
}

main().catch((error) => {
  console.error(`SMOKE FAIL: ${error.message}`);
  process.exitCode = 1;
});
