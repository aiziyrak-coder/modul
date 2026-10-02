"use strict";

const CHUNK_SIZE = 1000;
const MAX_ROUNDS = 2;
const DUPLICATE_KEY = 11000;

const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row[k]]));
const omit = (row, keys) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));

const toOp = (row, keyFields) => ({
  updateOne: {
    filter: { ...pick(row, keyFields), packetAt: { $lte: row.packetAt } },
    update: { $set: omit(row, keyFields) },
    upsert: true,
  },
});

const codeOf = (we) => we.code ?? we.err?.code;
const indexOf = (we) => we.index ?? we.err?.index;
const hasCastFailures = (err) => (err.mongoose?.validationErrors?.length ?? 0) > 0;

function duplicateKeyPositions(err) {
  const writeErrors = [].concat(err?.writeErrors ?? []);
  const onlyDuplicates =
    err?.name === "MongoBulkWriteError" &&
    writeErrors.length > 0 &&
    !hasCastFailures(err) &&
    writeErrors.every((we) => codeOf(we) === DUPLICATE_KEY);
  const positions = onlyDuplicates ? writeErrors.map(indexOf) : [];
  if (!onlyDuplicates || !positions.every(Number.isInteger)) throw err;
  return positions;
}

async function runChunk(Model, chunkOps) {
  try {
    await Model.bulkWrite(chunkOps, { ordered: false, throwOnValidationError: true });
    return [];
  } catch (err) {
    return duplicateKeyPositions(err);
  }
}

async function runChunks(Model, ops, indexes) {
  const failed = [];
  for (let start = 0; start < indexes.length; start += CHUNK_SIZE) {
    const slice = indexes.slice(start, start + CHUNK_SIZE);
    const positions = await runChunk(Model, slice.map((i) => ops[i]));
    for (const pos of positions) failed.push(slice[pos]);
  }
  return failed;
}

async function upsertNewer(Model, rows, keyFields) {
  const ops = rows.map((row) => toOp(row, keyFields));
  let pending = ops.map((_op, i) => i);
  for (let round = 0; round < MAX_ROUNDS && pending.length > 0; round += 1) {
    pending = await runChunks(Model, ops, pending);
  }
  return { rows: rows.length, stale: pending.length };
}

function makeEnsureIndexes(models) {
  let ready = null;
  return function ensureIndexesOnce() {
    if (!ready) {
      ready = Promise.all(models.map((M) => M.createIndexes())).catch((err) => {
        ready = null;
        throw err;
      });
    }
    return ready;
  };
}

module.exports = { upsertNewer, makeEnsureIndexes, toOp, CHUNK_SIZE };
