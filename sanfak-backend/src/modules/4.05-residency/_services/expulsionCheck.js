const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { STATUS_IN_STUDY } = Resident;
const {
  notify,
  templates,
} = require("#system/notification/notification.service");
const { dispatch } = require("#system/notification/notificationDispatcher");
const winston = require("#shared/winston.logger");
const {
  WARNING_HOURS,
  EXPULSION_HOURS,
  clearWarningIfBelowThreshold,
  revokeWarning,
  revokeWarningInBackground,
} = require("./attendanceWarning");
const {
  notifyUser,
  EVENTS: NOTIFY_EVENTS,
  LINKS: NOTIFY_LINKS,
} = require("./residentNotify");
const { shouldCancelDraft, signedBasisLost } = require("./expulsionReversal");
const {
  openDraft,
  cancelDraftBelowThreshold,
  settleDraftNotices,
  markNoticesSent,
  findUnannouncedDrafts,
  isDraftOpen,
  reconcileDrafts,
} = require("./expulsionOrderLifecycle");
const {
  fanOutToOffice,
  deliverDecision,
  deliverDecisionInBackground,
  basisLostEffects,
  announceOfficeFollowUps,
} = require("./expulsionOfficeNotices");
const { unexcusedDateFilter, sumUnexcusedHours } = require("./unexcusedWindow");
const { holdNightTransitions } = require("./warningNightHold");

const buildFullName = (resident) =>
  resident.user
    ? `${resident.user.lastName || ""} ${resident.user.firstName || ""}`.trim()
    : resident.fullName || "Rezident";

function applyWarningThreshold(ctx) {
  const { resident, hours, fullName, update, effects } = ctx;
  if (!(hours >= WARNING_HOURS) || resident.warningIssued) return;

  update.warningIssued = true;
  update.warningIssuedAt = new Date();

  effects.push({
    kind: "telegram",
    payload: {
      message: templates.expulsionWarning(fullName, hours),
      type: "telegram",
    },
  });

  if (resident.user?._id) {
    effects.push({
      kind: "inApp",
      payload: {
        userId: resident.user._id,
        eventType: "residency_attendance_warning",
        title: "⚠️ Sababsiz soatlar bo'yicha ogohlantirish",
        body: `${hours} soat sababsiz dars qoldirdingiz. Agar davom etsa, chetlatish buyrug'i shakllantiriladi.`,
        metadata: { totalUnexcusedHours: hours },
      },
    });
  }

  effects.push({
    kind: "log",
    level: "info",
    message: `Ogohlantirish: ${fullName} — ${hours} soat`,
  });

  if (resident.program === "ordinatura" && resident.supervisor) {
    effects.push({
      kind: "supervisor",
      userId: resident.supervisor,
      payload: {
        eventType: NOTIFY_EVENTS.ATTENDANCE_WARNING_SUPERVISOR,
        title: "⚠️ Rezidentda sababsiz soatlar ostonasi",
        body: `${fullName} — ${hours} soat sababsiz dars qoldirdi. Davomat jurnalini ko'rib chiqing.`,
        link: NOTIFY_LINKS.ATTENDANCE,
      },
    });
  }
}

function applyExpulsionThreshold(ctx) {
  const { resident, hours, fullName, effects } = ctx;
  if (!(hours >= EXPULSION_HOURS)) return;
  effects.push({
    kind: "openDraft",
    residentId: resident._id,
    residentName: fullName,
    hours,
    notices: buildDraftNotices(resident, hours, fullName),
  });
}

function buildDraftNotices(resident, hours, fullName) {
  const notices = [];

  if (resident.user?._id) {
    notices.push({
      kind: "inApp",
      payload: {
        userId: resident.user._id,
        eventType: "residency_expulsion",
        title: "📄 Chetlatish buyrug'i loyihasi shakllantirildi",
        body: "72 soatdan ortiq sababsiz dars qoldirganingiz sababli chetlatish buyrug'i LOYIHASI shakllantirildi. Yakuniy qaror bo'lim tomonidan qabul qilinadi — sababli deb hisoblasangiz bo'limga ariza topshiring.",
        metadata: { residentId: String(resident._id) },
      },
    });
  }

  notices.push({
    kind: "office",
    payload: {
      eventType: NOTIFY_EVENTS.EXPULSION_DRAFT_OFFICE,
      title: "📄 Chetlatish buyrug'i loyihasi — ko'rib chiqish kerak",
      body: `${fullName} — ${hours} soat sababsiz dars qoldirdi. Chetlatish buyrug'i loyihasi shakllantirildi; qaror va imzo bo'lim zimmasida.`,
      link: NOTIFY_LINKS.ATTENDANCE_OFFICE,
      metadata: { residentId: String(resident._id) },
    },
  });

  notices.push({
    kind: "log",
    level: "warn",
    message: `BUYRUQ LOYIHASI: ${fullName} — ${hours} soat`,
  });
  return notices;
}

function evaluateResident(resident, totalUnexcusedHours) {
  const fullName = buildFullName(resident);
  const update = { totalUnexcusedHours };
  const effects = [];

  if (
    clearWarningIfBelowThreshold(resident, totalUnexcusedHours, update) &&
    resident.user?._id
  ) {
    effects.push({ kind: "revokeWarning", userId: resident.user._id });
  }

  if (shouldCancelDraft(resident, totalUnexcusedHours)) {
    effects.push({ kind: "cancelDraft", hours: totalUnexcusedHours });
  }
  if (signedBasisLost(resident, totalUnexcusedHours)) effects.push({ kind: "basisLost" });

  const canAccrue =
    resident.status === undefined ||
    resident.status === null ||
    resident.status === STATUS_IN_STUDY;

  if (canAccrue) {
    const ctx = {
      resident,
      hours: totalUnexcusedHours,
      fullName,
      update,
      effects,
    };
    applyWarningThreshold(ctx);
    applyExpulsionThreshold(ctx);
  }

  return { update, effects, fullName };
}

const notifyInBackground = (payload) => {
  Promise.resolve()
    .then(() => notify(payload))
    .catch((err) =>
      winston.error(
        `[4.5 expulsionCheck] Xabarnoma yuborilmadi: ${err.message}`,
      ),
    );
};

const dispatchInAppInBackground = (payload) => {
  Promise.resolve()
    .then(() => dispatch({ ...payload, overrideChannels: { inApp: true } }))
    .catch((err) =>
      winston.error(
        `[4.5 expulsionCheck] In-app bildirishnoma yuborilmadi: ${err.message}`,
      ),
    );
};

function deliverInBackground(effects) {
  for (const effect of effects) {
    if (effect.kind === "revokeWarning") {
      revokeWarningInBackground(effect.userId);
    } else if (effect.kind === "telegram") {
      notifyInBackground(effect.payload);
    } else if (effect.kind === "inApp") {
      dispatchInAppInBackground(effect.payload);
    } else if (effect.kind === "supervisor") {
      notifyUser(effect.userId, effect.payload).catch((err) =>
        winston.error(
          `[4.5 expulsionCheck] Ustoz bildirishnomasi yuborilmadi: ${err.message}`,
        ),
      );
    } else if (effect.kind === "office") {
      fanOutToOffice(effect.payload).catch((err) =>
        winston.error(
          `[4.5 expulsionCheck] Bo'lim bildirishnomasi yuborilmadi: ${err.message}`,
        ),
      );
    } else if (effect.kind === "draftNotices") {
      deliverDraftNotices(effect, { withLog: false }).catch((err) =>
        winston.error(
          `[4.5 expulsionCheck] Loyiha xabarlari yuborilmadi: ${err.message}`,
        ),
      );
    } else if (effect.kind === "basisLostNotice") {
      deliverDecisionInBackground(effect.order, "basisLost");
    }
  }
}

async function deliverGuarded(label, fn) {
  try {
    await fn();
  } catch (notifErr) {
    winston.warn(`[ExpulsionCron] ${label} xato: ${notifErr.message}`);
  }
}

const AWAITED_DELIVERY = {
  revokeWarning: (e) =>
    deliverGuarded("ogohlantirish bekori", () => revokeWarning(e.userId)),
  log: (e) => winston[e.level](`[ExpulsionCron] ${e.message}`),
  telegram: (e) => notify(e.payload),
  inApp: (e) =>
    deliverGuarded("in-app dispatch", () =>
      dispatch({ ...e.payload, overrideChannels: { inApp: true } }),
    ),
  supervisor: (e) =>
    deliverGuarded("ustoz bildirishnomasi", () =>
      notifyUser(e.userId, e.payload),
    ),
  office: (e) =>
    deliverGuarded("bo'lim bildirishnomasi", () => fanOutToOffice(e.payload)),
  draftNotices: (e) => deliverDraftNotices(e, { withLog: true }),
  basisLostNotice: (e) =>
    deliverGuarded("bo'lim xabari", () => deliverDecision(e.order, "basisLost")),
};

async function deliverDraftNotices(effect, { withLog }) {
  for (const n of effect.notices) {
    if (n.kind === "inApp") {
      await deliverGuarded("in-app dispatch", () =>
        dispatch({ ...n.payload, overrideChannels: { inApp: true } }),
      );
    } else if (n.kind === "office") {
      await deliverGuarded("bo'lim bildirishnomasi", () => fanOutToOffice(n.payload));
    } else if (n.kind === "log" && withLog) {
      winston[n.level](`[ExpulsionCron] ${n.message}`);
    }
  }
  await deliverGuarded("loyiha xabarlarini yakunlash", () =>
    settleDraftNotices(effect.residentId, effect.orderId),
  );
  await deliverGuarded("e'lon belgisi", () => markNoticesSent(effect.orderId));
}

async function announcePendingDrafts(startedAt) {
  for (const order of await findUnannouncedDrafts(startedAt)) {
    if (await markNoticesSent(order._id)) continue;
    const resident = await Resident.findById(order.resident).populate(
      "user",
      "firstName lastName",
    );
    if (resident && (await isDraftOpen(order._id))) {
      const fullName = buildFullName(resident);
      await deliverDraftNotices(
        {
          residentId: resident._id,
          orderId: order._id,
          notices: buildDraftNotices(resident, order.hoursAtDraft, fullName).map((n) =>
            withOrderId(n, order._id),
          ),
        },
        { withLog: true },
      );
    }
  }
}

async function deliverAwaited(effects) {
  for (const effect of effects) {
    const deliver = AWAITED_DELIVERY[effect.kind];
    if (deliver) await deliver(effect);
  }
}

async function countUnexcusedHours(residentId) {
  const absences = await Attendance.find({
    resident: residentId,
    status: "absent",
    active: true,

    date: unexcusedDateFilter(),
  });
  return sumUnexcusedHours(absences);
}

async function loadAndEvaluate(residentDoc, residentId) {
  return evaluateResident(residentDoc, await countUnexcusedHours(residentId));
}

const withOrderId = (notice, orderId) =>
  notice.payload?.metadata
    ? {
        ...notice,
        payload: {
          ...notice.payload,
          metadata: { ...notice.payload.metadata, orderId: String(orderId) },
        },
      }
    : notice;

async function runOpenDraft(effect, source) {
  try {
    const result = await openDraft({
      residentId: effect.residentId,
      residentName: effect.residentName,
      source,
      countHours: countUnexcusedHours,
    });
    if (!result.opened) return [];
    return [
      {
        kind: "draftNotices",
        residentId: effect.residentId,
        orderId: result.orderId,
        notices: effect.notices.map((n) => withOrderId(n, result.orderId)),
      },
    ];
  } catch (err) {
    winston.error(
      `[4.5 expulsionCheck] buyruq loyihasi ochilmadi resident=${effect.residentId}: ${err.message}`,
    );
    return [];
  }
}

async function applyStateEffects(effects, resident, source, { awaitRevoke = false } = {}) {
  const deliverable = [];
  for (const effect of effects) {
    if (effect.kind === "openDraft") {
      deliverable.push(...(await runOpenDraft(effect, source)));
    } else if (effect.kind === "cancelDraft") {
      await cancelDraftBelowThreshold(resident, {
        hours: effect.hours,
        source,
        awaitRevoke,
      });
    } else if (effect.kind === "basisLost") {
      const countHours = countUnexcusedHours;
      deliverable.push(...(await basisLostEffects({ residentId: resident._id, source, countHours })));
    } else {
      deliverable.push(effect);
    }
  }
  return deliverable;
}

async function runExpulsionCheck(residentId, { source = "attendance", now = new Date() } = {}) {
  const resident = await Resident.findById(residentId).populate(
    "user",
    "firstName lastName",
  );
  if (!resident) return;

  const evaluated = await loadAndEvaluate(resident, residentId);
  const { update, effects } = holdNightTransitions(evaluated, { source, now, resident });
  deliverInBackground(await applyStateEffects(effects, resident, source));
  await Resident.findByIdAndUpdate(residentId, update);
}

async function runExpulsionSweep() {
  winston.info("[ExpulsionCron] Tekshiruv boshlandi...");

  try {
    const startedAt = await reconcileDrafts();

    const residents = await Resident.find({ active: true }).populate(
      "user",
      "firstName lastName",
    );

    for (const resident of residents) {
      const { update, effects } = await loadAndEvaluate(resident, resident._id);
      const deliverable = await applyStateEffects(effects, resident, "cron", {
        awaitRevoke: true,
      });
      await deliverAwaited(deliverable);
      await Resident.findByIdAndUpdate(resident._id, update);
    }

    await announcePendingDrafts(startedAt);

    winston.info(
      `[ExpulsionCron] Tekshiruv yakunlandi. ${residents.length} ta rezident tekshirildi.`,
    );
    return await announceDecisions(true);
  } catch (err) {
    winston.error(`[ExpulsionCron] Xato: ${err.message}`);
    return announceDecisions(false);
  }
}

const announceDecisions = (ok) =>
  announceOfficeFollowUps(ok).then(
    () => ok,
    (err) => {
      winston.error(`[ExpulsionCron] Bo'lim yakuniy xabarlari (qaror/eslatma) yuborilmadi: ${err.message}`);
      return false;
    },
  );

module.exports = {
  evaluateResident,
  sumUnexcusedHours,
  countUnexcusedHours,
  buildFullName,
  runExpulsionCheck,
  runExpulsionSweep,
  _notifyInBackground: notifyInBackground,
  _dispatchInAppInBackground: dispatchInAppInBackground,
};
