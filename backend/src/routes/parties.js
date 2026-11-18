const router = require("express").Router();
const { z } = require("zod");
const { getDb } = require("../db/database");
const rooms = require("../store/roomRepository");
const party = require("../store/partyStore");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
// Public results and React share the same presentation source, including tokens.
const resultStyles = ["theme.css", "World.css"].map((file) =>
  readFileSync(resolve(__dirname, "../../../frontend/src", file), "utf8"),
).join("\n");
router.get("/rooms/:roomId/party", (req, res) => {
  const room = rooms.getRoomById(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found." });
  return res.json({ state: party.state(room.id) });
});
router.post("/rooms/:roomId/party", (req, res) => {
  const room = rooms.getRoomById(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found." });
  const owner = getDb()
    .prepare("SELECT creator_user_id FROM rooms WHERE id=?")
    .get(room.id);
  if (!req.user || owner.creator_user_id !== req.user.id)
    return res
      .status(403)
      .json({ error: "Only the room creator can start this party." });
  const parsed = z
    .object({
      participantId: z.string().max(100),
      participantToken: z.string().max(128),
    })
    .safeParse(req.body);
  if (
    !parsed.success ||
    !rooms.verifyParticipantToken(
      room.id,
      parsed.data.participantId,
      parsed.data.participantToken,
    )
  )
    return res.status(401).json({ error: "Join the room first." });
  const member = getDb()
    .prepare("SELECT user_id FROM participants WHERE room_id=? AND id=?")
    .get(room.id, parsed.data.participantId);
  if (member.user_id !== req.user.id)
    return res
      .status(403)
      .json({ error: "Use your own participant identity." });
  try {
    const state = party.start(room.id, parsed.data.participantId);
    require("../socket")
      .getIO()
      ?.to(room.id)
      .emit("party:started", { state, version: state.version });
    return res.status(201).json({ state });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});
router.get("/results/:shareId", (req, res) => {
  const result = party.result(req.params.shareId);
  return result
    ? res.json({ result })
    : res.status(404).json({ error: "This result is unavailable." });
});
router.patch("/results/:shareId", (req, res) => {
  const row = getDb()
    .prepare(
      "SELECT r.room_id,rooms.creator_user_id FROM party_results r JOIN rooms ON rooms.id=r.room_id WHERE share_id=?",
    )
    .get(req.params.shareId);
  if (!row) return res.status(404).json({ error: "Result not found." });
  if (!req.user || req.user.id !== row.creator_user_id)
    return res
      .status(403)
      .json({ error: "Only the creator can change result sharing." });
  const p = z
    .object({
      revoked: z.boolean().optional(),
      hideNames: z.boolean().optional(),
    })
    .strict()
    .safeParse(req.body);
  if (!p.success)
    return res.status(400).json({ error: "Check sharing settings." });
  if (p.data.revoked !== undefined)
    getDb()
      .prepare("UPDATE party_results SET revoked=? WHERE share_id=?")
      .run(Number(p.data.revoked), req.params.shareId);
  if (p.data.hideNames !== undefined)
    getDb()
      .prepare("UPDATE party_results SET hide_names=? WHERE share_id=?")
      .run(Number(p.data.hideNames), req.params.shareId);
  return res.json({ ok: true });
});
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function publicPage(req, res) {
  const result = party.result(req.params.shareId);
  if (!result)
    return res
      .status(404)
      .type("html")
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Result unavailable</title><style>${resultStyles}</style></head><body class="public-body"><div id="root"><main class="public-result"><h1>This result is unavailable.</h1></main></div></body></html>`,
      );
  const headline = escape(result.headline);
  const title = escape(result.title);
  const winner = escape(
    result.winner?.name || (result.tied ? "Tied" : "No winner"),
  );
  return res
    .type("html")
    .send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — VYUMI</title><meta property="og:title" content="${headline}"><meta property="og:description" content="${winner}"><meta name="twitter:card" content="summary"><style>${resultStyles}</style></head><body class="public-body"><div id="root"><main class="public-result"><p>VYUMI · Live Shopping Party</p><h1>${headline}</h1><h2>${title}</h2><p>${result.participants} participants · ${result.productsExplored} products explored · ${result.reactionsReceived} reactions</p><h2>${winner}</h2><p>${escape(result.summary)}</p><p>${result.names.map(escape).join(", ")}</p><ol>${result.ranking.map((p) => `<li>${escape(p.name)} — ${p.score} points</li>`).join("")}</ol><a href="/">Start your own shopping party</a></main></div></body></html>`,
    );
}
module.exports = { router, publicPage };
