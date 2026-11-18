// shortcut: transient per-process browsing presence, share this state before multi-instance deployment.
const parties = new Map();
function room(id) {
  if (!parties.has(id))
    parties.set(id, {
      views: Object.create(null),
      following: Object.create(null),
    });
  return parties.get(id);
}
function join(roomId, participantId, view) {
  const state = room(roomId);
  state.views[participantId] ||= view;
  return state;
}
function view(roomId, participantId, value) {
  const state = room(roomId);
  state.views[participantId] = value;
  return state;
}
function follow(roomId, participantId, target) {
  const state = room(roomId);
  if (!target) {
    delete state.following[participantId];
    return state;
  }
  if (target === participantId) throw new Error("You cannot follow yourself.");
  if (!Object.hasOwn(state.views, target))
    throw new Error("That person has left the party.");
  const seen = new Set([participantId]);
  for (let id = target; id; id = state.following[id]) {
    if (seen.has(id)) throw new Error("This would create a follow loop.");
    seen.add(id);
  }
  state.following[participantId] = target;
  return state;
}
function leave(roomId, participantId) {
  const state = parties.get(roomId);
  if (!state)
    return { views: Object.create(null), following: Object.create(null) };
  delete state.views[participantId];
  delete state.following[participantId];
  for (const [id, target] of Object.entries(state.following))
    if (target === participantId) delete state.following[id];
  if (!Object.keys(state.views).length) parties.delete(roomId);
  return state;
}
function regroup(roomId) {
  const state = room(roomId);
  state.following = Object.create(null);
  return state;
}
module.exports = { join, view, follow, leave, regroup };
