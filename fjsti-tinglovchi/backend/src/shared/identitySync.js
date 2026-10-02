const logger = require("./logger");
const { callMain } = require("./mainApi");
const { Listener } = require("./models/listener");

const PATH = "/qualification-listener-sync/listeners";

function upsertOp(l) {
  return {
    updateOne: {
      filter: { passport: l.passport },
      update: {
        $set: {
          fullName: l.fullName ?? null,
          userId: l.userId ?? null,
          listenerId: l.listenerId ?? null,
          active: l.active !== false,
          firstName: l.firstName ?? null,
          lastName: l.lastName ?? null,
          middleName: l.middleName ?? null,
          passportSeria: l.passportSeria ?? null,
          passportNumber: l.passportNumber ?? null,
          email: l.email ?? null,
          phone: l.phone ?? null,
          syncedAt: new Date(),
        },
      },
      upsert: true,
    },
  };
}

async function syncListeners() {
  const data = await callMain(PATH);
  const list = (data && data.listeners) || [];
  if (!list.length) return { synced: 0, deactivated: 0 };

  const Model = Listener();
  await Model.bulkWrite(list.map(upsertOp));

  return { synced: list.length };
}

let timer = null;
function startIdentitySync(intervalMs = 10 * 60 * 1000) {
  const run = () =>
    syncListeners()
      .then((r) => logger.info(`[identity] sync: ${r.synced} tinglovchi yangilandi`))
      .catch((err) => logger.warn(`[identity] sync xatosi: ${err.message}`));

  run();
  if (timer) return;
  timer = setInterval(run, intervalMs);
  if (timer.unref) timer.unref();
}

module.exports = { syncListeners, startIdentitySync };
