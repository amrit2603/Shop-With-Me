const { prepared } = require("../db/statements");
const crypto = require("node:crypto");
const { getDb } = require("../db/database");
const rooms = require("./roomRepository");
const host = require("../services/shoppingHost");
function fail(message, code = "BAD_REQUEST") {
  throw Object.assign(new Error(message), { code });
}
function event(roomId, participantId, type, productId = null, payload = {}) {
  prepared(
    getDb(),
    "INSERT INTO party_events(room_id,participant_id,type,product_id,payload_json,created_at) VALUES(?,?,?,?,?,?)",
  ).run(
    roomId,
    participantId,
    type,
    productId,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}
function state(roomId) {
  const s = prepared(getDb(), "SELECT * FROM party_state WHERE room_id=?").get(
    roomId,
  );
  if (!s) return null;
  return {
    roomId: s.room_id,
    mode: s.mode,
    hostParticipantId: s.host_participant_id,
    currentProductId: s.current_product_id,
    imageIndex: s.current_image_index,
    version: s.version,
    status: s.status,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    shareId: s.share_id,
    hostMuted: !!s.host_muted,
    suggestions: prepared(
      getDb(),
      "SELECT product_id AS productId,participant_id AS participantId,note,count FROM party_suggestions WHERE room_id=?",
    ).all(roomId),
  };
}
function requireLive(roomId) {
  const s = state(roomId);
  const room = prepared(getDb(), "SELECT expires_at FROM rooms WHERE id=?").get(
    roomId,
  );
  if (
    !s ||
    !room ||
    (room.expires_at && Date.parse(room.expires_at) <= Date.now())
  )
    fail("This party is not available.", "NOT_FOUND");
  if (s.status !== "live") fail("This party has ended.", "PARTY_ENDED");
  return s;
}
function start(roomId, participantId) {
  return getDb().transaction(() => {
    const r = rooms.getRoomById(roomId);
    if (!r || !r.products.length) fail("Add at least one product first.");
    if (r.participants.length > 12)
      fail("A party supports up to 12 participants.");
    const existing = state(roomId);
    if (existing) return existing;
    prepared(
      getDb(),
      "INSERT INTO party_state(room_id,host_participant_id,current_product_id,started_at) VALUES(?,?,?,?)",
    ).run(roomId, participantId, r.products[0].id, new Date().toISOString());
    event(roomId, participantId, "explored", r.products[0].id);
    return state(roomId);
  })();
}
function bump(roomId) {
  prepared(
    getDb(),
    "UPDATE party_state SET version=version+1 WHERE room_id=?",
  ).run(roomId);
  return state(roomId);
}
function change(roomId, participantId, action, payload = {}) {
  return getDb().transaction(() => {
    const s = requireLive(roomId);
    const isHost = s.hostParticipantId === participantId;
    if (
      ["set-mode", "transfer", "end", "take-me-there", "mute"].includes(
        action,
      ) &&
      !isHost
    )
      fail("Only the host can do that.", "NOT_HOST");
    if (
      ["navigate", "take-me-there", "suggest"].includes(action) &&
      !prepared(
        getDb(),
        "SELECT 1 FROM room_products WHERE room_id=? AND product_id=?",
      ).get(roomId, payload.productId)
    )
      fail("Choose a product in this room.");
    if (action === "navigate" || action === "take-me-there") {
      if (!isHost && s.mode === "host")
        fail("Follow the host or suggest a product.", "NOT_HOST");
      const product = require("../data/products").getProductById(
        payload.productId,
      );
      const images = product.images?.length || 1;
      if ((payload.imageIndex || 0) >= images)
        fail("This image is not available.");
      event(roomId, participantId, "explored", payload.productId);
      if (!isHost && s.mode === "explore")
        return { state: s, local: true, productId: payload.productId };
      prepared(
        getDb(),
        "UPDATE party_state SET current_product_id=?,current_image_index=? WHERE room_id=?",
      ).run(payload.productId, payload.imageIndex || 0, roomId);
      prepared(
        getDb(),
        "DELETE FROM party_suggestions WHERE room_id=? AND product_id=?",
      ).run(roomId, payload.productId);
    } else if (action === "set-mode")
      prepared(getDb(), "UPDATE party_state SET mode=? WHERE room_id=?").run(
        payload.mode,
        roomId,
      );
    else if (action === "transfer") {
      if (!rooms.getParticipant(roomId, payload.toParticipantId))
        fail("Choose a participant in this room.");
      prepared(
        getDb(),
        "UPDATE party_state SET host_participant_id=? WHERE room_id=?",
      ).run(payload.toParticipantId, roomId);
    } else if (action === "suggest") {
      const db = getDb();
      const count = prepared(
        db,
        "SELECT COUNT(*) AS n FROM party_suggestions WHERE room_id=?",
      ).get(roomId).n;
      if (
        count >= 20 &&
        !s.suggestions.some((x) => x.productId === payload.productId)
      )
        fail("There are already 20 suggestions.");
      prepared(
        db,
        "INSERT INTO party_suggestions VALUES(?,?,?,?,1) ON CONFLICT(room_id,product_id) DO UPDATE SET count=count+1",
      ).run(roomId, payload.productId, participantId, payload.note || "");
    } else if (action === "mute")
      prepared(
        getDb(),
        "UPDATE party_state SET host_muted=? WHERE room_id=?",
      ).run(payload.muted ? 1 : 0, roomId);
    else if (action === "end") {
      const result = makeResult(roomId);
      const shareId = crypto.randomBytes(18).toString("base64url");
      prepared(getDb(), "INSERT INTO party_results VALUES(?,?,?,0,0)").run(
        shareId,
        roomId,
        JSON.stringify(result),
      );
      prepared(
        getDb(),
        "UPDATE party_state SET status='ended',ended_at=?,share_id=? WHERE room_id=?",
      ).run(new Date().toISOString(), shareId, roomId);
    }
    event(roomId, participantId, action, payload.productId, payload);
    return { state: bump(roomId) };
  })();
}
function makeResult(roomId) {
  const r = rooms.getRoomById(roomId);
  const db = getDb();
  const explored = prepared(
    db,
    "SELECT COUNT(DISTINCT product_id) AS n FROM party_events WHERE room_id=? AND type='explored'",
  ).get(roomId).n;
  const reactions = prepared(
    db,
    "SELECT COUNT(*) AS n FROM party_events WHERE room_id=? AND type='react'",
  ).get(roomId).n;
  const ranking = host
    .ranking(r)
    .map(({ id, name, price, currency, imageUrl, score, reactions }) => ({
      id,
      name,
      price,
      currency,
      imageUrl,
      score,
      reactions,
    }));
  const eligible = ranking.filter((p) => p.reactions > 0);
  const hasVotes = eligible.length > 0;
  const tied =
    hasVotes &&
    eligible.filter((p) => p.score === eligible[0].score).length > 1;
  const winner = hasVotes && !tied ? eligible[0] : null;
  const words = [
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
  ];
  const n = r.participants.length;
  return {
    title: r.title,
    participants: n,
    names: r.participants.map((p) => p.name.split(/\s+/)[0]),
    productsExplored: explored,
    reactionsReceived: reactions,
    winner,
    tied,
    ranking,
    headline: `${words[n] || n} ${n === 1 ? "friend" : "friends"}. ${words[explored] || explored} ${explored === 1 ? "product" : "products"}. ${winner ? "One winner." : tied ? "A tie." : "No winner yet."}`,
    summary: host.summary(r).text,
  };
}
function result(shareId) {
  const row = prepared(
    getDb(),
    "SELECT * FROM party_results WHERE share_id=? AND revoked=0",
  ).get(shareId);
  if (
    !row ||
    rooms.isRoomExpired(row.room_id) ||
    !rooms.getRoomById(row.room_id)
  )
    return null;
  const data = JSON.parse(row.result_json);
  if (row.hide_names) data.names = [];
  return { ...data, shareId };
}
module.exports = {
  state,
  start,
  change,
  event,
  bump,
  requireLive,
  result,
  makeResult,
};
