const winston = require("#shared/winston.logger");
const { dispatch } = require("#system/notification/notificationDispatcher");
const Resident = require("#modules/4.05-residency/resident/resident.model");

const EVENTS = {
  DAILY_LOG_REVIEWED: "residency_daily_log_reviewed",
  ATTENDANCE_WARNING_SUPERVISOR: "residency_attendance_warning_supervisor",
  APPLICATION_REVIEWED: "residency_application_reviewed",
  EXPULSION_DRAFT_OFFICE: "residency_expulsion_draft_office",
  EXPULSION_SIGNED: "residency_expulsion_signed",
  EXPULSION_BASIS_LOST_OFFICE: "residency_expulsion_basis_lost_office",
  EXPULSION_REJECTED: "residency_expulsion_rejected",
  SAMS_DIGEST: "residency_sams_digest",
  SAMS_TENANTS_CHANGED: "residency_sams_tenants_changed",
};

const LINKS = {
  DAILY_LOG: "/residency/kundalik",
  ATTENDANCE: "/residency/davomat",
  APPLICATIONS: "/residency/arizalar",
  ATTENDANCE_OFFICE: "/residency/chetlatish-buyruqlari",
  SAMS_STATUS: "/residency/sams-holati",
};

const expulsionOrderLink = (orderId) =>
  orderId ? `${LINKS.ATTENDANCE_OFFICE}/${String(orderId)}` : LINKS.ATTENDANCE_OFFICE;

async function notifyResident(
  residentId,
  { eventType, title, body, link, metadata },
) {
  try {
    if (!residentId) return;
    const r = await Resident.findById(residentId).select("user").lean();
    if (!r?.user) return;
    await dispatch({ userId: r.user, eventType, title, body, link, metadata });
  } catch (err) {
    winston.warn(`[residentNotify] bildirishnoma xato: ${err.message}`);
  }
}

async function notifyUser(userId, { eventType, title, body, link, metadata }) {
  try {
    if (!userId) return;
    await dispatch({ userId, eventType, title, body, link, metadata });
  } catch (err) {
    winston.warn(`[residentNotify] bildirishnoma xato: ${err.message}`);
  }
}

module.exports = { notifyResident, notifyUser, EVENTS, LINKS, expulsionOrderLink };
