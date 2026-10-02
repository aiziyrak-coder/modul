const cron = require("node-cron");
const ApprovalChain = require("#system/approvalChain/approvalChain.model");
const SlaConfig = require("#references/slaConfig/slaConfig.model");
const User = require("#modules/4.01-auth/user/user.model");
const winston = require("#shared/winston.logger");
const { notify, templates } = require("#system/notification/notification.service");
const getDispatcher = () => require("#system/notification/notificationDispatcher");

const DEFAULT_SLA_DAYS = {
  rektor: 3,
  prorektor: 5,
  dekan: 5,
  kafedra_mudiri: 5,
  oquv_uslubiy_boshqarma: 5,
  reja_moliya: 5,
  arm: 7,
  oquv_metodik: 7,
  external: 10,
  default: 5,
};

const businessDaysFromNow = (days) => {
  const result = new Date();
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
};

const computeDeadline = (startedAt, slaDays) => {
  const result = new Date(startedAt);
  let added = 0;
  while (added < slaDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
};

async function getSlaConfigForStep(step, documentType) {
  let config = null;
  if (documentType) {
    config = await SlaConfig.findOne({
      role: step.roleTitle,
      documentType,
      active: true,
    }).lean();
  }
  if (!config) {
    config = await SlaConfig.findOne({
      role: step.roleTitle,
      documentType: null,
      active: true,
    }).lean();
  }
  return (
    config || {
      role: step.roleTitle,
      slaDays: DEFAULT_SLA_DAYS[step.roleTitle] || DEFAULT_SLA_DAYS.default,
      escalateToRole: null,
      escalateAfterDays: 3,
      warningDaysBefore: 1,
    }
  );
}

async function checkOverdueApprovals() {
  const now = new Date();

  const chains = await ApprovalChain.find({
    active: true,
    status: "pending",
  }).populate("steps.user", "firstName lastName telegramChatId email");

  let markedCount = 0;
  let notifiedCount = 0;

  let escalatedCount = 0;
  const { dispatch } = getDispatcher();

  for (const chain of chains) {
    const step = chain.steps[chain.currentStep];
    if (!step || step.status !== "pending") continue;

    const slaConfig = await getSlaConfigForStep(step, chain.documentType);

    if (!step.startedAt) {
      step.startedAt = chain.currentStepStartedAt || chain.updatedAt || chain.createdAt;
    }
    if (!step.deadline) {
      const slaDays = step.slaDays || slaConfig.slaDays;
      step.deadline = computeDeadline(step.startedAt, slaDays);
      chain.currentStepDeadline = step.deadline;
    }

    if (now > step.deadline && !step.overdue) {
      step.overdue = true;
      markedCount++;
    }

    const today = now.toISOString().slice(0, 10);
    const lastNotifiedDay = step.notifiedAt
      ? step.notifiedAt.toISOString().slice(0, 10)
      : null;

    const daysOverdue = step.deadline
      ? Math.floor((now - step.deadline) / (1000 * 60 * 60 * 24))
      : 0;

    if (step.overdue && lastNotifiedDay !== today) {
      step.notifiedAt = now;
      notifiedCount++;

      const userName = step.user
        ? `${step.user.firstName || ""} ${step.user.lastName || ""}`.trim()
        : step.roleTitle;

      const title = "⚠️ SLA bo'yicha kechikish";
      const body =
        `Hujjat: ${chain.documentType} (${chain.moduleName})\n` +
        `Bosqich: ${step.roleTitle}\n` +
        `Mas'ul: ${userName}\n` +
        `Muddati o'tdi: ${daysOverdue} kun`;

      if (step.user?._id) {
        try {
          await dispatch({
            userId: step.user._id,
            user: step.user,
            eventType: "sla_overdue",
            title,
            body,
            metadata: { chainId: chain._id, daysOverdue },
          });
        } catch (err) {
          winston.warn(`[SLA] dispatch failed: ${err.message}`);
        }
      }
    }

    if (
      step.overdue &&
      !step.escalated &&
      slaConfig.escalateToRole &&
      daysOverdue >= (slaConfig.escalateAfterDays || 3)
    ) {
      step.escalated = true;
      step.escalatedAt = now;
      step.escalatedTo = slaConfig.escalateToRole;
      escalatedCount++;

      try {
        const escalators = await User.find({
        })
          .populate("role")
          .lean();

        const targetUsers = escalators.filter(
          (u) => u.role?.title === slaConfig.escalateToRole,
        );

        for (const u of targetUsers) {
          await dispatch({
            userId: u._id,
            user: u,
            eventType: "sla_escalated",
            title: "🚨 SLA ESKALATSIYA",
            body:
              `Tasdiqlash bosqichi kechikmoqda — sizga eskalatsiya qilindi\n` +
              `Hujjat: ${chain.documentType}\n` +
              `Bosqich: ${step.roleTitle}\n` +
              `Kechikish: ${daysOverdue} kun`,
            metadata: { chainId: chain._id, originalRole: step.roleTitle },
          });
        }
      } catch (err) {
        winston.warn(`[SLA] escalation failed: ${err.message}`);
      }
    }

    await chain.save();
  }

  if (escalatedCount > 0) {
    winston.info(`[SLA Checker] Eskalatsiya qilingan bosqichlar: ${escalatedCount}`);
  }

  if (markedCount > 0 || notifiedCount > 0) {
    winston.info(
      `[SLA Checker] Marked overdue: ${markedCount}, Notified: ${notifiedCount}`,
    );
  }
}

function initializeStepDeadline(chain, stepIndex) {
  const step = chain.steps[stepIndex];
  if (!step) return;

  const now = new Date();
  const slaDays = step.slaDays || DEFAULT_SLA_DAYS[step.roleTitle] || DEFAULT_SLA_DAYS.default;

  step.startedAt = now;
  step.deadline = computeDeadline(now, slaDays);
  step.overdue = false;
  step.notifiedAt = null;

  chain.currentStepStartedAt = now;
  chain.currentStepDeadline = step.deadline;
}

function startSlaCheckerCron() {
  cron.schedule("0 9 * * *", async () => {
    try {
      await checkOverdueApprovals();
    } catch (err) {
      winston.error(`[SLA Cron] ${err.message}`);
    }
  });
  winston.info("[SLA Checker] Cron yoqildi (har kuni 09:00)");
}

module.exports = {
  startSlaCheckerCron,
  checkOverdueApprovals,
  initializeStepDeadline,
  DEFAULT_SLA_DAYS,
  businessDaysFromNow,
  computeDeadline,
};
