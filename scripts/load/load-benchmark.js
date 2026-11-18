/**
 * 200-room / 2,000-participant, two-minute REST and Socket.IO scenario.
 * Optional LOAD_ROOMS and LOAD_DURATION_SECONDS overrides support local tuning.
 */
const { spawn, execFileSync } = require('node:child_process');
const { createServer } = require('node:net');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const autocannon = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'autocannon'));
const { io: ioClient } = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'socket.io-client'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values, fraction) => values.length
  ? values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))]
  : 0;

function sampleChildProcess(pid) {
  if (process.platform !== 'win32') return null;
  try {
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', `$p=Get-Process -Id ${pid}; '{0},{1}' -f $p.WorkingSet64,$p.TotalProcessorTime.TotalSeconds`], { encoding: 'utf8', timeout: 3000 }).trim();
    const [rssBytes, cpuSeconds] = raw.split(',').map(Number);
    return { rssMB: rssBytes / 1024 / 1024, cpuSeconds };
  } catch { return null; }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options?.method || 'GET'} ${url} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function waitForRoomJoin(socket, payload) {
  socket.emit('room:join', payload);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket room join timed out')), 5000);
    socket.once('room:joined', () => { clearTimeout(timeout); resolve(); });
    socket.once('room:error', (error) => { clearTimeout(timeout); reject(new Error(JSON.stringify(error))); });
  });
}

async function run() {
  const args = process.argv.slice(2);
  const roomsArg = args.indexOf('--rooms') !== -1 ? args[args.indexOf('--rooms') + 1] : null;
  const durationArg = args.indexOf('--duration') !== -1 ? args[args.indexOf('--duration') + 1] : null;
  const roomCount = Math.max(1, Number.parseInt(roomsArg || process.env.LOAD_ROOMS, 10) || 200);
  const durationSeconds = Math.max(3, Number.parseInt(durationArg || process.env.LOAD_DURATION_SECONDS, 10) || 120);
  const participantCount = 10;
  const productId = 'prod-beauty-arkive';
  const totalParticipants = roomCount * participantCount;
  const port = await getFreePort();
  const dbPath = path.join(os.tmpdir(), `vyumi-load-${Date.now()}.sqlite`);
  const backendPath = process.env.LOAD_BACKEND_PATH || path.join(__dirname, '..', '..', 'backend');
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: backendPath,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, NODE_ENV: 'test', LOAD_TEST_MODE: 'true', REDIS_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  const base = `http://127.0.0.1:${port}`;
  const sockets = [];
  const fanoutLatencies = [];
  const startTimes = new Map();
  let firstError = null;
  let processPeakRssMB = 0;
  let processCpuSeconds = 0;
  const processSampler = setInterval(() => {
    const metrics = sampleChildProcess(child.pid);
    if (metrics) {
      processPeakRssMB = Math.max(processPeakRssMB, metrics.rssMB);
      processCpuSeconds = metrics.cpuSeconds;
    }
  }, 5000);

  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch { /* server starting */ }
      if (child.exitCode !== null) throw new Error(`Backend exited with code ${child.exitCode} before readiness`);
      await sleep(250);
    }
    if (!ready) throw new Error('Backend did not become ready');
    console.log(`Load server ready at ${base}; rooms=${roomCount}, participants=${totalParticipants}, duration=${durationSeconds}s`);

    const rooms = [];
    for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
      const created = await jsonRequest(`${base}/api/rooms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Benchmark room ${roomIndex + 1}` }),
      });
      const roomId = created.room.id;
      await jsonRequest(`${base}/api/rooms/${roomId}/products`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Creator-Token': created.creatorToken },
        body: JSON.stringify({ productId }),
      });
      const participants = [];
      for (let participantIndex = 0; participantIndex < participantCount; participantIndex += 1) {
        const result = await jsonRequest(`${base}/api/rooms/${roomId}/participants`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `Load ${roomIndex}-${participantIndex}` }),
        });
        participants.push(result);
      }
      rooms.push({ roomId, participants });
      if ((roomIndex + 1) % 25 === 0) console.log(`Seeded ${roomIndex + 1}/${roomCount} rooms`);
    }

    console.log('Opening authenticated Socket.IO clients...');
    const socketEntries = [];
    for (const room of rooms) {
      for (const participant of room.participants) {
        const socket = ioClient(base, { transports: ['websocket'], forceNew: true, auth: {
          roomId: room.roomId,
          participantId: participant.participant.id,
          token: participant.participantToken,
        } });
        sockets.push(socket);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Socket connection timed out')), 7000);
          socket.once('connect', () => { clearTimeout(timeout); resolve(); });
          socket.once('connect_error', (error) => { clearTimeout(timeout); reject(error); });
        });
        await waitForRoomJoin(socket, {
          roomId: room.roomId,
          participantId: participant.participant.id,
          participantToken: participant.participantToken,
        });
        socket.on('chat:message', ({ message }) => {
          const sentAt = startTimes.get(message?.text);
          if (sentAt) fanoutLatencies.push(Date.now() - sentAt);
        });
        socketEntries.push({ socket, roomId: room.roomId, participant });
      }
    }
    console.log(`Connected ${sockets.length} clients.`);

    await fetch(`${base}/__load/reset`, { method: 'POST' });

    const restLatencySamples = [];
    const restResultPromise = autocannon({
      url: `${base}/api/rooms/${rooms[0].roomId}`,
      connections: 50,
      duration: durationSeconds,
      pipelining: 1,
      headers: { Accept: 'application/json' },
      requests: [{
        path: `/api/rooms/${rooms[0].roomId}`,
        setupRequest: (request, context) => { context.startedAt = performance.now(); return request; },
        onResponse: (_status, _body, context) => { restLatencySamples.push(performance.now() - context.startedAt); },
      }],
    });

    const errors = [];
    const actionPromises = socketEntries.map(async (entry, index) => {
      const participant = entry.participant.participant;
      const headers = { 'Content-Type': 'application/json', 'X-Participant-Token': entry.participant.participantToken };
      const roomIndex = Math.floor(index / participantCount);
      const actionStart = Date.now() + Math.floor((roomIndex / roomCount) * durationSeconds * 1000 * 0.7);
      try {
        await sleep(Math.max(0, actionStart - Date.now()));
        const vote = await fetch(`${base}/api/rooms/${entry.roomId}/products/${productId}/votes`, {
          method: 'POST', headers, body: JSON.stringify({ participantId: participant.id, vote: 'Love' }),
        });
        if (!vote.ok) throw new Error(`vote HTTP ${vote.status}`);
        await sleep(250);
        const comment = await fetch(`${base}/api/rooms/${entry.roomId}/products/${productId}/comments`, {
          method: 'POST', headers, body: JSON.stringify({ participantId: participant.id, text: `Load comment ${index}` }),
        });
        if (!comment.ok) throw new Error(`comment HTTP ${comment.status}`);
        await sleep(250);
        const messageText = `Load message ${index}`;
        startTimes.set(messageText, Date.now());
        const ack = await new Promise((resolve) => entry.socket.emit('chat:send', { text: messageText }, resolve));
        if (!ack?.ok) throw new Error(`chat rejected: ${ack?.error || 'missing acknowledgement'}`);
      } catch (error) {
        errors.push(error.message);
        if (!firstError) firstError = error;
      }
    });

    await Promise.all(actionPromises);
    const rest = await restResultPromise;
    const serverMetrics = await fetch(`${base}/__load/metrics`).then((response) => response.ok ? response.json() : null).catch(() => null);
    const processEndMetrics = sampleChildProcess(child.pid);
    if (processEndMetrics) {
      processPeakRssMB = Math.max(processPeakRssMB, processEndMetrics.rssMB);
      processCpuSeconds = processEndMetrics.cpuSeconds;
    }
    const fanout = {
      p50: percentile(fanoutLatencies, 0.50),
      p95: percentile(fanoutLatencies, 0.95),
      p99: percentile(fanoutLatencies, 0.99),
      deliveries: fanoutLatencies.length,
    };
    const result = {
      scenario: { rooms: roomCount, participantsPerRoom: participantCount, durationSeconds },
      rest: {
        p50: percentile(restLatencySamples, 0.50),
        p95: percentile(restLatencySamples, 0.95),
        p99: percentile(restLatencySamples, 0.99),
        measuredRequests: serverMetrics?.count ?? restLatencySamples.length,
        requestsPerSecond: rest.requests.average,
        errors: rest.errors + (serverMetrics?.errors || 0),
      },
      fanout,
      mutationErrors: errors.length,
      memory: { peakChildRssMB: +processPeakRssMB.toFixed(1), rssMB: serverMetrics?.rssMB ?? null, heapMB: serverMetrics?.heapMB ?? null },
      cpu: { childTotalSeconds: +processCpuSeconds.toFixed(2), userMs: serverMetrics?.cpuUserMs ?? null, systemMs: serverMetrics?.cpuSystemMs ?? null },
    };
    console.log('\nLOAD RESULT');
    console.log(JSON.stringify(result, null, 2));
    if (firstError || rest.errors || fanout.deliveries < totalParticipants * 8) {
      throw new Error(`Load scenario had errors or insufficient fan-out (${fanout.deliveries} deliveries)`);
    }
    return result;
  } finally {
    clearInterval(processSampler);
    for (const socket of sockets) socket.disconnect();
    child.kill('SIGTERM');
    await sleep(500);
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* process may still be closing on Windows */ }
    }
  }
}

if (require.main === module) {
  run().catch((error) => { console.error('Load benchmark failed:', error); process.exitCode = 1; });
}

module.exports = { run };
