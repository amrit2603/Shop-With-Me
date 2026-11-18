const caches = new WeakMap();
// Cache statements, never rows; each database connection owns its prepared SQL.
function prepared(db, sql) {
  let cache = caches.get(db);
  if (!cache) {
    cache = new Map();
    caches.set(db, cache);
  }
  let statement = cache.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    cache.set(sql, statement);
  }
  return statement;
}
module.exports = { prepared };
