// index.js disables Mongoose command buffering and models are compiled before
// the connection opens, so Mongoose's automatic Model.init() can run against a
// missing connection, fail, and cache that failure for the life of the
// process. Code that depends on a unique index (the room-night ledger, task
// dedupe keys) calls this instead: it builds the model's indexes once the
// database is reachable and retries after a failure.
const pending = new Map();

function ensureModelIndexes(Model) {
  if (!pending.has(Model.modelName)) {
    const ready = Model.ensureIndexes().catch(err => {
      pending.delete(Model.modelName);
      throw err;
    });
    pending.set(Model.modelName, ready);
  }
  return pending.get(Model.modelName);
}

module.exports = { ensureModelIndexes };
