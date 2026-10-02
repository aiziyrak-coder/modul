jest.mock("./teacherLeave.model");
jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_verify/documentVerify.service", () => ({
  issueToken: jest.fn(),
}));
jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));

const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");
const TeacherLeave = require("./teacherLeave.model");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { issueToken } = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const QRCode = require("qrcode");
const Controller = require("./teacherLeave.controller");

const LEAVE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const PUBLIC_BASE_URL_BACKUP = process.env.PUBLIC_BASE_URL;
beforeAll(() => {
  process.env.PUBLIC_BASE_URL = "https://verify.test";
});
afterAll(() => {
  process.env.PUBLIC_BASE_URL = PUBLIC_BASE_URL_BACKUP;
});

beforeEach(() => {
  jest.clearAllMocks();
  UserModel.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
  });
  WorkloadDistribution.find = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue([]),
  });
});

const makeLeave = () => {
  const order = [];
  const leave = {
    _id: LEAVE_ID,
    teacher: TEACHER_ID,
    type: "leave",
    status: "pending",
    distribution: null,
    teacherEntryId: null,
    save: jest.fn(async () => order.push("save")),
  };
  return { leave, order };
};
const req = { params: { id: LEAVE_ID }, body: {}, scope: {}, user: { _id: "head-1" } };

const approvalDate = new Date("2026-09-20T12:00:00Z");
const approvedLeave = (verify) => ({
  _id: LEAVE_ID,
  status: "approved",
  type: "leave",
  reason: "Oilaviy sabab",
  fromDate: new Date("2026-10-01T12:00:00Z"),
  toDate: new Date("2026-11-15T12:00:00Z"),
  approvalDate,
  teacher: { firstName: "Odiljon", lastName: "Umirzakov", position: { title: "Assistent" } },
  approvedBy: {
    firstName: "Botir",
    middleName: "Karimovich",
    lastName: "Yusupov",
    position: { title: "Normal anatomiya kafedrasi mudiri" },
  },
  distribution: null,
  verify,
});

const mockQuery = (doc) => {
  const q = { populate: jest.fn(() => q), then: (ok, fail) => Promise.resolve(doc).then(ok, fail) };
  TeacherLeave.findOne = jest.fn(() => q);
};

async function render(doc) {
  mockQuery(doc);
  const textSpy = jest.spyOn(PDFDocument.prototype, "text");
  const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
  try {
    const res = new PassThrough();
    res.setHeader = jest.fn();
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    const done = new Promise((r) => res.on("end", r));
    const next = jest.fn();
    await Controller.generateBayonnoma({ params: { id: LEAVE_ID }, scope: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    await done;
    return {
      bytes: Buffer.concat(chunks),
      texts: textSpy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string"),
      images: imageSpy.mock.calls.map((c) => c[0]),
    };
  } finally {
    textSpy.mockRestore();
    imageSpy.mockRestore();
  }
}

describe("approveTeacherLeave — QR token (best-effort)", () => {
  test("tasdiqda issueToken(leave, userId) save'dan OLDIN, status approved bilan", async () => {
    const { leave, order } = makeLeave();
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    issueToken.mockImplementation(async (doc) => {
      order.push(`issue:${doc.status}`);
      return "t";
    });
    const res = createRes();
    await Controller.approveTeacherLeave(req, res, jest.fn());

    expect(issueToken).toHaveBeenCalledWith(leave, "head-1");
    expect(order).toEqual(["issue:approved", "save"]);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("issueToken throw qilsa ham ariza tasdiqlanadi (200, save bor)", async () => {
    const { leave } = makeLeave();
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    issueToken.mockRejectedValue(new Error("token xato"));
    const res = createRes();
    const next = jest.fn();
    await Controller.approveTeacherLeave(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(leave.save).toHaveBeenCalledTimes(1);
    expect(leave.status).toBe("approved");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("rad etishda token chiqarilmaydi", async () => {
    const { leave } = makeLeave();
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    const res = createRes();
    await Controller.rejectTeacherLeave(
      { ...req, body: { comment: "Yo'q" } },
      res,
      jest.fn(),
    );
    expect(issueToken).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("generateBayonnoma — PDF smoke", () => {
  test("Muddat + lavozim + sana + ism; token bor ⇒ QR slotda", async () => {
    const out = await render(
      approvedLeave({
        token: "c".repeat(32),
        revokedAt: null,
        snapshot: [{ step: "kafedra", label: "Kafedra mudiri", shortName: "B.Yusupov", date: approvalDate }],
      }),
    );
    expect(out.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(out.texts).toContain("Muddat:");
    expect(out.texts).toContain("01.10.2026 – 15.11.2026");
    expect(out.texts).toContain("Normal anatomiya kafedrasi mudiri:");
    expect(out.texts).toContain("B.Yusupov");
    expect(out.texts).toContain("20.09.2026");
    expect(QRCode.toBuffer).toHaveBeenCalledWith(
      `https://verify.test/verify/doc/${"c".repeat(32)}`,
      expect.any(Object),
    );
    expect(out.images.some((img) => Buffer.isBuffer(img) && img.toString() === "fake-qr")).toBe(true);
  });

  test("token yo'q (eski ariza) — QR yo'q, blok chain'dan (A.A.Familiya)", async () => {
    const out = await render(approvedLeave(undefined));
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
    expect(out.texts).toContain("B.K.Yusupov");
    expect(out.texts).toContain("Normal anatomiya kafedrasi mudiri:");
  });

  test("bekor qilingan token — QR chizilmaydi", async () => {
    await render(approvedLeave({ token: "c".repeat(32), revokedAt: new Date(), snapshot: [] }));
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });
});
