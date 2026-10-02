const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const { ROLES } = require("#config/constants");
const {
  dispatchMany,
} = require("#system/notification/notificationDispatcher");
const MedicalOrganization = require("#modules/4.13-practice/medicalOrganization/medicalOrganization.model");

const usersByRole = async (roleTitle) => {
  const Role = mongoose.model("role");
  const User = mongoose.model("user");
  const role = await Role.findOne({ title: roleTitle }).select("_id").lean();
  if (!role) return [];
  const users = await User.find({ role: role._id, active: true }).select("_id").lean();
  if (roleTitle === ROLES.REKTOR && users.length > 1) {
    winston.warn(
      `[practiceNotify] "${roleTitle}" rolida ${users.length} ta aktiv akkaunt topildi — barchasiga bildirishnoma boradi (kutilgan=1)`,
    );
  }
  return users;
};

const notifyRoles = async (roleTitles, { eventType, title, body, link, metadata }) => {
  try {
    const titles = Array.isArray(roleTitles) ? roleTitles : [roleTitles];
    const lists = await Promise.all(titles.map(usersByRole));
    const users = lists.flat();
    if (!users.length) return;
    await dispatchMany({
      userIds: users.map((u) => u._id),
      eventType,
      title,
      body,
      link,
      metadata,
    });
  } catch (err) {
    winston.error(`[practiceNotify] bildirishnoma xato: ${err.message}`);
  }
};

const notifyOrgResponsibleUsers = async (
  organizationId,
  { eventType, title, body, link, metadata },
) => {
  try {
    if (!organizationId) return;
    const org = await MedicalOrganization.findById(organizationId)
      .select("responsibleUsers")
      .lean();
    const userIds = org?.responsibleUsers || [];
    if (!userIds.length) {
      winston.warn(
        `[practiceNotify] tashkilotda mas'ul rahbar yo'q — bildirishnoma yuborilmadi (org=${organizationId}, event=${eventType})`,
      );
      return;
    }
    const User = mongoose.model("user");
    const activeUsers = await User.find({ _id: { $in: userIds }, active: true })
      .select("_id")
      .lean();
    if (!activeUsers.length) {
      winston.warn(
        `[practiceNotify] tashkilot mas'ullari orasida aktiv user yo'q (org=${organizationId}, event=${eventType})`,
      );
      return;
    }
    await dispatchMany({
      userIds: activeUsers.map((u) => u._id),
      eventType,
      title,
      body,
      link,
      metadata,
    });
  } catch (err) {
    winston.error(`[practiceNotify] notifyOrgResponsibleUsers xato: ${err.message}`);
  }
};

module.exports = { notifyRoles, notifyOrgResponsibleUsers };
