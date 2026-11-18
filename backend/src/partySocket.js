const { prepared } = require("./db/statements");
const { z } = require("zod");
const store = require("./store/partyStore");
const rooms = require("./store/roomRepository");
const { getDb } = require("./db/database");
const host = require("./services/shoppingHost");
const following = require("./services/partyFollowing");
const { containsProfanity } = require("./services/profanityFilter");
const id = z.string().min(1).max(100);
const schemas = {
  view: z.object({ productId: id, imageIndex: z.number().int().min(0).max(50) }),
  follow: z.object({ toParticipantId: id.nullable() }),
  navigate: z.object({
    productId: id,
    imageIndex: z.number().int().min(0).max(50).optional(),
  }),
  "take-me-there": z.object({ productId: id }),
  "set-mode": z.object({ mode: z.enum(["host", "explore"]) }),
  transfer: z.object({ toParticipantId: id }),
  suggest: z.object({
    productId: id,
    note: z.string().trim().max(180).optional(),
  }),
  end: z.object({}),
  mute: z.object({ muted: z.boolean() }),
  react: z.object({
    productId: id,
    vote: z.enum(["Love", "Like", "No", "Need more info"]),
  }),
  host: z.object({
    action: z.enum(["summary", "compare", "question", "suggest"]),
    a: id.optional(),
    b: id.optional(),
    query: z.string().trim().max(300).optional(),
    productId: id.optional(),
  }),
};
const attempts = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  if (a.length >= max) return true;
  a.push(now);
  attempts.delete(key);
  attempts.set(key, a);
  if (attempts.size > 10000) attempts.delete(attempts.keys().next().value);
  return false;
}
const channel = (id) => "party:" + id;
function install(io, socket) {
  socket.on("party:join", (raw, ack = () => {}) => {
    ack=typeof ack==="function"?ack:()=>{};
    try {
      const p = z
        .object({
          roomId: id,
          participantId: id,
          participantToken: z.string().min(32).max(128),
          lastVersion: z.number().int().optional(),
        })
        .parse(raw);
      if (
        !rooms.getRoomById(p.roomId) ||
        !rooms.verifyParticipantToken(
          p.roomId,
          p.participantId,
          p.participantToken,
        )
      )
        throw new Error("Join this room with a valid identity.");
      const s = store.state(p.roomId);
      if (!s) throw new Error("No party has started in this room.");
      if (socket.data.party && (socket.data.party.roomId !== p.roomId || socket.data.party.participantId !== p.participantId)) leaveFollowing();
      socket.data.party = p;
      scheduleHandoff(io, p.roomId, s.hostParticipantId);
      socket.join(channel(p.roomId));
      const peers = following.join(p.roomId, p.participantId, { productId: s.currentProductId, imageIndex: s.imageIndex });
      io.to(channel(p.roomId)).emit('party:peers', peers);
      store.event(p.roomId, p.participantId, "joined");
      socket.emit("party:state", { state: s, version: s.version });
      const note = prepared(
        getDb(),
        "SELECT payload_json FROM party_events WHERE room_id=? AND type='host-note' ORDER BY id DESC LIMIT 1",
      ).get(p.roomId);
      if (note) socket.emit("party:host", JSON.parse(note.payload_json));
      ack({ ok: true, state: s });
    } catch (e) {
      ack({ ok: false, code: "INVALID_PARTICIPANT", error: e.message });
    }
  });
  for (const [action, schema] of Object.entries(schemas))
    socket.on("party:" + action, (raw, ack = () => {}) => {
      ack=typeof ack==="function"?ack:()=>{};
      try {
        const p = socket.data.party;
        if (
          !p ||
          !socket.rooms.has(channel(p.roomId)) ||
          !rooms.verifyParticipantToken(
            p.roomId,
            p.participantId,
            p.participantToken,
          )
        )
          throw new Error("Rejoin the party to continue.");
        const payload = schema.parse(raw || {});
        const s = store.requireLive(p.roomId);
        if (limited(p.roomId + ":" + p.participantId + ":all", 120, 10000))
          throw new Error("Please slow down.");
        if (action === 'view' || action === 'follow') {
          if (action === 'view') {
            const product = rooms.getRoomById(p.roomId).products.find(x => x.id === payload.productId);
            if (!product || payload.imageIndex >= (product.images?.length || 1)) throw new Error('Choose a product image in this room.');
          }
          const peers = action === 'view' ? following.view(p.roomId, p.participantId, payload) : following.follow(p.roomId, p.participantId, payload.toParticipantId);
          io.to(channel(p.roomId)).emit('party:peers', peers);
          return ack({ ok: true });
        }
        if (
          action === "suggest" &&
          (containsProfanity(payload.note || "") ||
            limited(p.roomId + ":" + p.participantId + ":suggest", 5, 60000))
        )
          throw new Error("Please wait or edit your suggestion.");
        if (action === "react") {
          if (limited(p.roomId + ":" + p.participantId + ":react", 10, 10000))
            throw new Error("Please wait before reacting again.");
          if (
            !prepared(
              getDb(),
              "SELECT 1 FROM room_products WHERE room_id=? AND product_id=?",
            ).get(p.roomId, payload.productId)
          )
            throw new Error("Choose a product in this room.");
          const result = getDb().transaction(() => {
            const old = rooms.getProductVotes(
              p.roomId,
              payload.productId,
              p.participantId,
            ).userVote;
            let vote = payload.vote;
            if (old === vote) {
              prepared(
                getDb(),
                "DELETE FROM votes WHERE room_id=? AND product_id=? AND participant_id=?",
              ).run(p.roomId, payload.productId, p.participantId);
              vote = null;
            } else {
              const saved = rooms.recordVote(
                p.roomId,
                payload.productId,
                p.participantId,
                vote,
              );
              if (!saved.success) throw new Error(saved.error);
            }
            store.event(p.roomId, p.participantId, "react", payload.productId, {
              vote,
            });
            const state = store.bump(p.roomId);
            return {
              vote,
              state,
              ...rooms.getProductVotes(p.roomId, payload.productId),
            };
          })();
          require("./socket").broadcastRoomUpdate(p.roomId, "vote:updated", {
            productId: payload.productId,
            participantId: p.participantId,
            vote: result.vote,
            totals: result.totals,
          });
          if (result.vote && !limited(p.roomId + ":burst", 2, 100))
            io.to(channel(p.roomId)).emit("party:burst", {
              vote: result.vote,
              id: Date.now() + ":" + socket.id,
            });
          const note = host.disagreement(
            { votes: { [payload.productId]: result.votes } },
            payload.productId,
          );
          if (
            note &&
            !s.hostMuted &&
            !limited(p.roomId + ":host-proactive", 1, 45000)
          ) {
            store.event(
              p.roomId,
              p.participantId,
              "host-note",
              payload.productId,
              note,
            );
            io.to(channel(p.roomId)).emit("party:host", note);
          }
          return ack({ ok: true, ...result });
        }
        if (action === "host") {
          if (limited(p.roomId + ":" + p.participantId + ":host", 8, 60000))
            throw new Error("Please wait before asking again.");
          const room = rooms.getRoomById(p.roomId);
          const productId = payload.productId || s.currentProductId;
          if (!room.products.some(product => product.id === productId))
            throw new Error("Choose a product in this room.");
          let reply;
          if (payload.action === "compare") {
            const a = room.products.find((x) => x.id === payload.a),
              b = room.products.find((x) => x.id === payload.b);
            if (!a || !b) throw new Error("Choose two products in this room.");
            reply = host.compare(a, b);
          } else if (payload.action === "question")
            reply = host.answer(room, productId, payload.query || "");
          else if (payload.action === "suggest")
            reply = host.suggest(room, productId);
          else reply = host.summary(room);
          store.event(
            p.roomId,
            p.participantId,
            "host-note",
            productId,
            reply,
          );
          io.to(channel(p.roomId)).emit("party:host", reply);
          return ack({ ok: true, reply });
        }
        const changed = store.change(
          p.roomId,
          p.participantId,
          action,
          payload,
        );
        if (action === "take-me-there" || action === "transfer" || (action === "set-mode" && payload.mode === "host"))
          io.to(channel(p.roomId)).emit("party:peers", following.regroup(p.roomId));
        if (!changed.local)
          io.to(channel(p.roomId)).emit("party:state", {
            state: changed.state,
            version: changed.state.version,
            force: action === "take-me-there" || (action === "navigate" && changed.state.mode === "host"),
          });
        if (action === "transfer") scheduleHandoff(io,p.roomId,payload.toParticipantId);
        if (action === "transfer")
          io.to(channel(p.roomId)).emit("party:host-changed", {
            participantId: payload.toParticipantId,
          });
        if (action === "end") {
          io.to(channel(p.roomId)).emit(
            "party:host",
            host.summary(rooms.getRoomById(p.roomId)),
          );
          io.to(channel(p.roomId)).emit("party:ended", {
            resultId: changed.state.shareId,
          });
        }
        ack({ ok: true, ...changed });
      } catch (e) {
        ack({
          ok: false,
          code: e.code || "BAD_REQUEST",
          error:
            e.name === "ZodError"
              ? "Check the party action and try again."
              : e.message,
        });
      }
    });
  const leaveFollowing = () => {
    const p = socket.data.party;
    if (!p) return;
    socket.leave(channel(p.roomId));
    const others = [...(io.sockets.adapter.rooms.get(channel(p.roomId)) || [])].some(id => io.sockets.sockets.get(id)?.data.party?.participantId === p.participantId);
    if (!others) io.to(channel(p.roomId)).emit('party:peers', following.leave(p.roomId, p.participantId));
    socket.data.party = null;
    scheduleHandoff(io, p.roomId, p.participantId);
  };
  socket.on('room:leave', payload => {
    const roomId = typeof payload === 'string' ? payload : payload?.roomId;
    if (roomId === socket.data.party?.roomId) leaveFollowing();
  });
  socket.on("disconnect", leaveFollowing);
}
function scheduleHandoff(io, roomId, hostId) {
  const timer = setTimeout(
    () => handoffIfAbsent(io, roomId, hostId).catch(() => {}),
    30000,
  );
  timer.unref();
}
async function handoffIfAbsent(io, roomId, hostId) {
  const s = store.state(roomId);
  if (!s || s.status !== "live" || s.hostParticipantId !== hostId) return;
  const clients = await io.in(channel(roomId)).fetchSockets();
  const online = new Set(clients.map((x) => x.data.party?.participantId));
  if (online.has(hostId)) return;
  const next = rooms
    .getRoomById(roomId)
    ?.participants.find((p) => online.has(p.id));
  if (!next) return;
  const changed = store.change(roomId, hostId, "transfer", {
    toParticipantId: next.id,
  });
  io.to(channel(roomId)).emit("party:state", {
    state: changed.state,
    version: changed.state.version,
  });
  io.to(channel(roomId)).emit("party:host-changed", {
    participantId: next.id,
    automatic: true,
  });
  return next.id;
}

module.exports = { install, handoffIfAbsent, scheduleHandoff };
