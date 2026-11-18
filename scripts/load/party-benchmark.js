const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const net = require("node:net");
const root = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const option = (name, fallback) =>
  Number(args[args.indexOf(name) + 1]) || fallback;
const count = option("--parties", 100),
  seconds = option("--duration", 120),
  people = 6;
const file = path.join(os.tmpdir(), `vyumi-party-load-${process.pid}.sqlite`);
process.env.DATABASE_PATH = file;
process.env.LOG_LEVEL = "silent";
const rooms = require("../../backend/src/store/roomRepository");
const party = require("../../backend/src/store/partyStore");
const { closeDb } = require("../../backend/src/db/database");
const catalog = require("../../backend/src/data/products").products;
const { io } = require("../../backend/node_modules/socket.io-client");
const fixtures = Array.from({ length: count }, (_, i) => {
  const room = rooms.saveRoom({
    id: crypto.randomUUID(),
    title: `Load party ${i}`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    products: [],
  });
  for (const product of catalog.slice(0, 3)) {
    const saved = rooms.addProductToRoom(room.id, product);
    if (!saved.success) throw new Error(saved.error);
  }
  const members = Array.from({ length: people }, (_, j) =>
    rooms.addOrUpdateParticipant(room.id, { name: `Friend ${j}` }),
  );
  party.start(room.id, members[0].participant.id);
  return { room, members, clients: [], pending: null };
});
closeDb();
const sockets = [];
let errors = 0,
  operations = 0;
const navigation = [],
  rest = [];
function emit(socket, event, payload) {
  return new Promise((resolve, reject) =>
    socket.timeout(10000).emit(event, payload, (e, r) => {
      if (e) return reject(new Error(event + ": " + e.message));
      if (!r?.ok) return reject(new Error(event + ": " + r?.error));
      operations++;
      resolve(r);
    }),
  );
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = (a) => {
  const b = [...a].sort((x, y) => x - y);
  const at = (f) =>
    b.length
      ? +b[Math.min(b.length - 1, Math.floor(b.length * f))].toFixed(2)
      : null;
  return {
    samples: b.length,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: at(1),
  };
};
async function main() {
  const available = net.createServer();
  available.listen(0, "127.0.0.1");
  await once(available, "listening");
  const port = available.address().port;
  await new Promise((r) => available.close(r));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: path.join(root, "backend"),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      LOAD_TEST_MODE: "true",
      DATABASE_PATH: file,
      FRONTEND_URL: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(logs);
      try {
        if ((await fetch(base + "/api/health/live")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await wait(100);
    }
    if (!ready) throw new Error("Server startup timed out: " + logs);
    for (const f of fixtures) {
      f.clients = await Promise.all(
        f.members.map(async (member, index) => {
          const socket = io(base, {
            transports: ["websocket"],
            forceNew: true,
            timeout: 10000,
          });
          sockets.push(socket);
          await new Promise((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
          });
          await new Promise((resolve, reject) => {
            socket.once("room:joined", resolve);
            socket.once("room:error", reject);
            socket.emit("room:join", {
              roomId: f.room.id,
              participantId: member.participant.id,
              participantToken: member.participantToken,
            });
          });
          await emit(socket, "party:join", {
            roomId: f.room.id,
            participantId: member.participant.id,
            participantToken: member.participantToken,
          });
          if (index > 0)
            socket.on("party:state", (p) => {
              const pending = f.pending;
              if (
                pending &&
                p.state.currentProductId === pending.productId &&
                !pending.seen.has(index)
              ) {
                navigation.push(performance.now() - pending.started);
                pending.seen.add(index);
              }
            });
          return socket;
        }),
      );
    }
    await fetch(base + "/__load/reset", { method: "POST" });
    const started = Date.now();
    const end = started + seconds * 1000;
    await Promise.all(
      fixtures.map(async (f, index) => {
        await wait(index * 7);
        let round = 0;
        while (Date.now() < end) {
          const productId = catalog[round % 3].id;
          f.pending = {
            productId,
            started: performance.now(),
            seen: new Set(),
          };
          try {
            await emit(f.clients[0], "party:navigate", { productId });
            await Promise.all(
              f.clients.map(async (socket, j) => {
                await emit(socket, "party:react", {
                  productId,
                  vote: (round + j) % 2 ? "Like" : "Love",
                });
                if (round % 2 === 0)
                  await emit(socket, "chat:send", {
                    text: "A load-test opinion",
                  });
              }),
            );
            const t = performance.now();
            const response = await fetch(`${base}/api/rooms/${f.room.id}`);
            await response.arrayBuffer();
            rest.push(performance.now() - t);
            operations++;
            if (!response.ok) errors++;
          } catch (e) {
            errors++;
            if (errors < 5) console.error(e.message);
          }
          round++;
          await wait(2000);
        }
      }),
    );
    const metrics = await (await fetch(base + "/__load/metrics")).json();
    const report = {
      parties: count,
      participants: count * people,
      requestedDurationSeconds: seconds,
      durationSeconds: +((Date.now() - started) / 1000).toFixed(2),
      operations,
      errors,
      navigationMs: stats(navigation),
      restMs: stats(rest),
      server: metrics,
      measuredAt: new Date().toISOString(),
      limits:
        "Single localhost Node/SQLite process; seeded identities; not an internet or multi-instance benchmark.",
    };
    const output = path.join(root, "docs/party-load.json");
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (
      errors ||
      !navigation.length ||
      report.navigationMs.p95 >= 300 ||
      report.restMs.p95 >= 200
    )
      process.exitCode = 1;
  } finally {
    for (const s of sockets) s.disconnect();
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    for (const suffix of ["", "-wal", "-shm"])
      fs.rmSync(file + suffix, { force: true });
  }
}
main().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
