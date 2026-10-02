const Notification = require("#system/notification/notification.model");
const NotificationPreference = require("#system/notification/notificationPreference.model");
const winston = require("#shared/winston.logger");

const DEFAULT_PREFS = {
  eri_expiring:        { inApp: true, telegram: true,  email: true,  sms: false },
  eri_expired:         { inApp: true, telegram: true,  email: true,  sms: false },

  workload_assigned:   { inApp: true, telegram: true,  email: false, sms: false },
  workload_rejected:   { inApp: true, telegram: true,  email: true,  sms: false },
  workload_approved:   { inApp: true, telegram: false, email: false, sms: false },
  recalc_required:     { inApp: true, telegram: false, email: true,  sms: false },

  syllabus_approved:   { inApp: true, telegram: false, email: true,  sms: false },
  syllabus_rejected:   { inApp: true, telegram: true,  email: true,  sms: false },
  scienceProgram_approved: { inApp: true, telegram: false, email: true, sms: false },
  scienceProgram_rejected: { inApp: true, telegram: true, email: true, sms: false },

  vacancy_created:     { inApp: true, telegram: true,  email: false, sms: false },
  vacancy_reassigned:  { inApp: true, telegram: true,  email: false, sms: false },

  sla_warning:         { inApp: true, telegram: false, email: true,  sms: false },
  sla_overdue:         { inApp: true, telegram: true,  email: true,  sms: false },
  sla_escalated:       { inApp: true, telegram: true,  email: true,  sms: false },

  residency_attendance_warning:  { inApp: true, telegram: true,  email: false, sms: false },
  residency_expulsion:           { inApp: true, telegram: false, email: false, sms: false },
  residency_expulsion_draft_office: { inApp: true, telegram: true, email: false, sms: false },

  task_assigned:       { inApp: true, telegram: true,  email: false, sms: false },
  task_completed:      { inApp: true, telegram: false, email: false, sms: false },

  announcement_new:    { inApp: true, telegram: false, email: false, sms: false },

  science_work_submitted:      { inApp: true, telegram: true,  email: false, sms: false },
  science_work_status_changed: { inApp: true, telegram: true,  email: false, sms: false },
  science_decision_made:       { inApp: true, telegram: true,  email: false, sms: false },
  science_seminar_result_set:  { inApp: true, telegram: false, email: false, sms: false },
  science_review_added:        { inApp: true, telegram: false, email: false, sms: false },
  science_member_added:        { inApp: true, telegram: true,  email: false, sms: false },
  science_member_removed:      { inApp: true, telegram: false, email: false, sms: false },
  science_application_accepted: { inApp: true, telegram: false, email: true, sms: false },
  science_application_rejected: { inApp: true, telegram: false, email: true, sms: false },

  eq_submission_created:  { inApp: true, telegram: false, email: false, sms: false },
  eq_submission_reviewed: { inApp: true, telegram: true,  email: false, sms: false },

  residency_plan_reviewed:          { inApp: true, telegram: false, email: false, sms: false },
  residency_announcement_published: { inApp: true, telegram: false, email: false, sms: false },

  task_submitted:            { inApp: true, telegram: false, email: false, sms: false },
  task_rejected_by_executor: { inApp: true, telegram: false, email: false, sms: false },
  task_not_needed:           { inApp: true, telegram: false, email: false, sms: false },
  task_reopened:             { inApp: true, telegram: false, email: false, sms: false },
  task_deadline_changed:     { inApp: true, telegram: false, email: false, sms: false },

  council_task_overdue:    { inApp: true, telegram: false, email: false, sms: false },
  council_rank_accepted:   { inApp: true, telegram: false, email: false, sms: false },
  council_rank_returned:   { inApp: true, telegram: false, email: false, sms: false },
  council_voting_started:  { inApp: true, telegram: false, email: false, sms: false },
  council_voting_finished: { inApp: true, telegram: false, email: false, sms: false },

  qualifying_applicant: { inApp: true, telegram: false, email: false, sms: false },
  scientific_post:      { inApp: true, telegram: false, email: false, sms: false },

  contract_sent_to_rector:  { inApp: true, telegram: false, email: false, sms: false },
  contract_rektor_approved: { inApp: true, telegram: false, email: false, sms: false },
  contract_both_approved:   { inApp: true, telegram: false, email: false, sms: false },
  contract_rejected:        { inApp: true, telegram: false, email: false, sms: false },

  personalWorkPlan_submitted:   { inApp: true, telegram: false, email: false, sms: false },
  personalWorkPlan_stepPending: { inApp: true, telegram: false, email: false, sms: false },
  personalWorkPlan_approved:    { inApp: true, telegram: false, email: false, sms: false },
  personalWorkPlan_rejected:    { inApp: true, telegram: true,  email: true,  sms: false },
  personalReport_submitted:     { inApp: true, telegram: false, email: false, sms: false },
  personalReport_approved:      { inApp: true, telegram: false, email: true,  sms: false },
  personalReport_rejected:      { inApp: true, telegram: true,  email: true,  sms: false },
  teacherProfile_approved:      { inApp: true, telegram: false, email: false, sms: false },
  teacherProfile_rejected:      { inApp: true, telegram: true,  email: true,  sms: false },
  teacherLeave_submitted:       { inApp: true, telegram: false, email: false, sms: false },
  teacherLeave_approved:        { inApp: true, telegram: false, email: false, sms: false },
  teacherLeave_rejected:        { inApp: true, telegram: true,  email: true,  sms: false },

  _default:            { inApp: true, telegram: false, email: false, sms: false },
};

let _notifyFn = null;
let _socketHelpers = null;
let _UserModel = null;

const getNotify = () => {
  if (!_notifyFn) {
    const svc = require("./notification.service");
    _notifyFn = svc.notify;
  }
  return _notifyFn;
};

const getSocketHelpers = () => {
  if (!_socketHelpers) {
    _socketHelpers = require("#system/_shared/socketHandler");
  }
  return _socketHelpers;
};

const getUserModel = () => {
  if (!_UserModel) {
    _UserModel = require("#modules/4.01-auth/user/user.model");
  }
  return _UserModel;
};

const DEFAULT_CHANNEL_TIMEOUT_MS = 3000;

const getChannelTimeoutMs = () => {
  const raw = Number(process.env.NOTIFY_CHANNEL_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CHANNEL_TIMEOUT_MS;
};

const withTimeout = (promise, ms, label) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timeout (${ms} ms)`)),
      ms,
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );

const isSafeLink = (value) => {
  if (typeof value !== "string" || !value) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

async function dispatch({
  userId,
  eventType,
  title,
  body,
  link,
  metadata,
  user,
  overrideChannels,
}) {
  if (!userId || !eventType || !title) {
    throw new Error("dispatch: userId, eventType, title majburiy");
  }

  let channels = overrideChannels;
  if (!channels) {
    const pref = await NotificationPreference.findOne({ user: userId }).lean();

    if (pref?.paused) {
      const isPaused =
        !pref.pausedUntil || new Date() < new Date(pref.pausedUntil);
      if (isPaused) {
        channels = { inApp: true };
      }
    }

    if (!channels) {
      const userPref = pref?.preferences?.get?.(eventType);
      channels =
        userPref ||
        DEFAULT_PREFS[eventType] ||
        DEFAULT_PREFS._default;
    }
  }

  let userDoc = user;
  if (!userDoc && (channels.telegram || channels.email || channels.sms)) {
    const User = getUserModel();
    userDoc = await User.findById(userId)
      .select("firstName lastName email phone telegramChatId")
      .lean();
  }

  const channelsList = [];
  const deliveryStatus = {};

  if (channels.inApp) {
    try {
      const sockets = getSocketHelpers();
      const delivered = Boolean(
        await sockets.emitToUser(userId, "notification", {
          eventType,
          title,
          body,
          link,
          createdAt: new Date(),
        }),
      );
      deliveryStatus.inApp = { delivered };
      channelsList.push("inApp");
    } catch (err) {
      deliveryStatus.inApp = { delivered: false, error: err.message };
    }
  }

  const timeoutMs = getChannelTimeoutMs();
  const sendExternal = async (channel, send) => {
    try {
      await withTimeout(send(), timeoutMs, channel);
      deliveryStatus[channel] = { delivered: true };
    } catch (err) {
      deliveryStatus[channel] = { delivered: false, error: err.message };
      winston.warn(`[Dispatcher] ${channel} fail: ${err.message}`);
    }
  };
  const external = [];

  if (channels.telegram) {
    if (!userDoc?.telegramChatId) {
      deliveryStatus.telegram = {
        delivered: false,
        error: "telegramChatId yo'q",
      };
    } else {
      const notify = getNotify();
      const tgMessage = body
        ? `${escapeHtml(title)}\n\n${escapeHtml(body)}`
        : escapeHtml(title);
      external.push(
        sendExternal("telegram", () =>
          notify({
            type: "telegram",
            message: tgMessage,
            chatId: userDoc.telegramChatId,
          }),
        ),
      );
    }
  }

  if (channels.email && userDoc?.email) {
    const notify = getNotify();
    const safeTitle = escapeHtml(title);
    const safeBody = body ? escapeHtml(body) : "";
    const safeLink = isSafeLink(link) ? escapeHtml(link) : null;
    const html = `<h3>${safeTitle}</h3>${safeBody ? `<p>${safeBody}</p>` : ""}${
      safeLink ? `<p><a href="${safeLink}">Batafsil</a></p>` : ""
    }`;
    external.push(
      sendExternal("email", () =>
        notify({
          type: "email",
          subject: title,
          message: html,
          email: userDoc.email,
        }),
      ),
    );
  }

  if (channels.sms && userDoc?.phone) {
    const notify = getNotify();
    const smsText = body ? `${title}: ${body}` : title;
    external.push(
      sendExternal("sms", () =>
        notify({
          type: "sms",
          message: smsText.slice(0, 160),
          phone: userDoc.phone,
        }),
      ),
    );
  }

  await Promise.all(external);
  for (const channel of ["telegram", "email", "sms"]) {
    if (deliveryStatus[channel]?.delivered) channelsList.push(channel);
  }

  let notification = null;
  if (channels.inApp) {
    try {
      notification = await Notification.create({
        user: userId,
        eventType,
        title,
        body: body || null,
        link: link || null,
        metadata: metadata || null,
        channels: channelsList,
        deliveryStatus,
      });
    } catch (err) {
      winston.error(`[Dispatcher] DB save fail: ${err.message}`);
    }
  }

  return { notification, channels: channelsList };
}

async function dispatchMany({ userIds, eventType, title, body, link, metadata }) {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      dispatch({ userId, eventType, title, body, link, metadata }),
    ),
  );
  const success = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - success;
  return { total: results.length, success, failed };
}

module.exports = { dispatch, dispatchMany, DEFAULT_PREFS };
