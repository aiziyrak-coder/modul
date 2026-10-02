jest.mock("#modules/4.03-teacher/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getRecipients: jest.fn().mockResolvedValue([]),
  getRecipientsForSteps: jest.fn().mockResolvedValue([]),
  describeOwner: jest.fn().mockResolvedValue(""),
}));
jest.mock("./personalReport.model");

const PersonalReportModel = require("./personalReport.model");
const service = require("./personalReport.service");
const { ROLES } = require("#config/constants");

const REPORT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "cccccccccccccccccccccccc";
const SCOPE = { teacher: { $in: [TEACHER_ID] } };

const userWithRole = (title, id = "userid") => ({ _id: id, role: { title } });

const buildApprovals = (overrides = {}) =>
  [
    { step: "dekan", label: "Fakultet dekani" },
    { step: "kotib", label: "Fakultet ilmiy kengash kotibi" },
  ].map(({ step, label }) => ({
    step,
    label,
    status: overrides[step] || "pending",
    approvedBy: null,
    date: null,
    comment: null,
    eriSignature: null,
    eriSerial: null,
    eriSignedAt: null,
  }));

const reportDoc = ({ status = "submitted", approvals } = {}) => ({
  _id: REPORT_ID,
  teacher: TEACHER_ID,
  status,
  semester: 1,
  text: "Hisobot matni",
  approvals: approvals || buildApprovals(),
  save: jest.fn().mockResolvedValue(undefined),
});

const mockFound = (doc) => {
  PersonalReportModel.findOne = jest.fn().mockResolvedValue(doc);
};

const entryOf = (doc, step) => doc.approvals.find((s) => s.step === step);

beforeEach(() => jest.clearAllMocks());

describe("personalReport.service.approve — tasdiqlash izohi (F-21)", () => {
  test("`comment` berilsa — `approvals[i].comment` saqlanadi va DB'ga yoziladi", async () => {
    const doc = reportDoc();
    mockFound(doc);

    await service.approve(REPORT_ID, userWithRole(ROLES.DEKAN, "dekan-1"), SCOPE, {
      comment: "Hisobot to'liq, tasdiqlandi",
    });

    expect(entryOf(doc, "dekan").comment).toBe("Hisobot to'liq, tasdiqlandi");
    expect(entryOf(doc, "dekan").status).toBe("approved");
    expect(doc.save).toHaveBeenCalled();
  });

  test("`comment` BERILMASA — `null` qoladi (regressiya)", async () => {
    const doc = reportDoc();
    mockFound(doc);

    await service.approve(REPORT_ID, userWithRole(ROLES.DEKAN, "dekan-1"), SCOPE, {});

    expect(entryOf(doc, "dekan").comment).toBeNull();
    expect(entryOf(doc, "dekan").status).toBe("approved");
  });

  test("bo'sh satr `\"\"` → `null` (timeline bo'sh izoh bloki chizmasin)", async () => {
    const doc = reportDoc();
    mockFound(doc);

    await service.approve(REPORT_ID, userWithRole(ROLES.DEKAN, "dekan-1"), SCOPE, {
      comment: "",
    });

    expect(entryOf(doc, "dekan").comment).toBeNull();
  });

  test("ikkinchi bosqich (kotib) — izoh o'z bosqichiga yoziladi, dekan izohi tegilmaydi", async () => {
    const doc = reportDoc({ approvals: buildApprovals({ dekan: "approved" }) });
    entryOf(doc, "dekan").comment = "dekan izohi";
    mockFound(doc);

    await service.approve(
      REPORT_ID,
      userWithRole(ROLES.FAKULTET_KENGASH_KOTIBI, "kotib-1"),
      SCOPE,
      { comment: "kengash qarori ilova qilingan" },
    );

    expect(entryOf(doc, "kotib").comment).toBe("kengash qarori ilova qilingan");
    expect(entryOf(doc, "dekan").comment).toBe("dekan izohi");
    expect(doc.status).toBe("approved");
  });
});
