jest.mock("#system/approvalChain/approvalChain.model");
jest.mock("#references/slaConfig/slaConfig.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn(),
  templates: {},
}));
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const ApprovalChain = require("#system/approvalChain/approvalChain.model");
const SlaConfig = require("#references/slaConfig/slaConfig.model");
const User = require("#modules/4.01-auth/user/user.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { checkOverdueApprovals } = require("./slaCheckerCron");

const TEN_DAYS_AGO = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
const TWENTY_DAYS_AGO = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

const makeStep = (overrides = {}) => ({
  status: "pending",
  roleTitle: "prorektor",
  startedAt: TWENTY_DAYS_AGO,
  deadline: TEN_DAYS_AGO,
  overdue: false,
  escalated: false,
  notifiedAt: null,
  user: null,
  ...overrides,
});

const makeChain = (step) => ({
  _id: "chain1",
  documentType: "workload",
  moduleName: "4.02",
  currentStep: 0,
  steps: [step],
  save: jest.fn().mockResolvedValue(undefined),
});

const mockSlaConfig = (config) => {
  SlaConfig.findOne = jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(config),
  });
};

const mockEscalators = (users) => {
  User.find = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(users) }),
  });
};

const runWithChain = async (chain) => {
  ApprovalChain.find = jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue([chain]),
  });
  await checkOverdueApprovals();
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("checkOverdueApprovals — eskalatsiya (N-03: role.title, role.name EMAS)", () => {
  test("role.title mos kelgan foydalanuvchi eskalatsiya bildirishnomasini OLADI", async () => {
    const step = makeStep();
    const chain = makeChain(step);
    mockSlaConfig({
      role: "prorektor",
      slaDays: 5,
      escalateToRole: "prorektor",
      escalateAfterDays: 3,
      warningDaysBefore: 1,
    });
    mockEscalators([
      { _id: "u-prorektor", role: { title: "prorektor" } },
      { _id: "u-rektor", role: { title: "rektor" } },
    ]);

    await runWithChain(chain);

    expect(step.escalated).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-prorektor",
        eventType: "sla_escalated",
      }),
    );
  });

  test("mos rol topilmasa — dispatch chaqirilmaydi (lekin escalated true bo'lib qoladi)", async () => {
    const step = makeStep();
    const chain = makeChain(step);
    mockSlaConfig({
      role: "prorektor",
      slaDays: 5,
      escalateToRole: "prorektor",
      escalateAfterDays: 3,
    });
    mockEscalators([{ _id: "u-rektor", role: { title: "rektor" } }]);

    await runWithChain(chain);

    expect(step.escalated).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("escalateToRole sozlanmagan bo'lsa — eskalatsiya umuman ishga tushmaydi", async () => {
    const step = makeStep();
    const chain = makeChain(step);
    mockSlaConfig({ role: "prorektor", slaDays: 5, escalateToRole: null });
    mockEscalators([{ _id: "u1", role: { title: "prorektor" } }]);

    await runWithChain(chain);

    expect(step.escalated).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("User.find xato bersa ham chaqiruv cron'ni yiqitmaydi (best-effort)", async () => {
    const step = makeStep();
    const chain = makeChain(step);
    mockSlaConfig({
      role: "prorektor",
      slaDays: 5,
      escalateToRole: "prorektor",
      escalateAfterDays: 3,
    });
    User.find = jest.fn().mockImplementation(() => {
      throw new Error("DB xato");
    });

    await expect(runWithChain(chain)).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
