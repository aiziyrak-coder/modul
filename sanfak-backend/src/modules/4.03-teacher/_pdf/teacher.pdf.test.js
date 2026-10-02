jest.mock("#modules/4.03-teacher/teacher/teacher.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => {
  const actual = jest.requireActual("#shared/pdfGenerators/pdfHelpers");
  return { ...actual, drawInfoCard: jest.fn(actual.drawInfoCard) };
});

const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const { drawInfoCard } = require("#shared/pdfGenerators/pdfHelpers");
const { buildTeacherPdf } = require("./teacher.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const OWNER_USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const mockProfile = {
  user: { _id: OWNER_USER_ID, firstName: "Ali", lastName: "Valiyev", middleName: "Aliyevich" },
  department: { title: "Ichki kasalliklar" },
  faculty: { title: "Davolash ishi" },
  position: { title: "Dotsent" },
  hrApprovalStatus: "approved",
  hrApprovedBy: null,
  jshshir: "12345678901234",
  passportSeries: "AA",
  passportNumber: "1234567",
  passportIssuedBy: "IIB",
  passportIssuedAt: new Date("2010-01-01"),
  birthDate: new Date("1990-01-01"),
  address: { region: "Farg'ona", district: "Marg'ilon", street: "Bog'bon" },
  gender: "male",
};

const personalCardRows = () => drawInfoCard.mock.calls[0][1];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildTeacherPdf — scope (begona profilni yuklab olmaslik, F-1)", () => {
  test("scope filtri `findOne`ga uzatiladi", async () => {
    TeacherProfile.findOne = jest.fn().mockReturnValue(chainablePopulate(mockProfile));

    await buildTeacherPdf("profileId123", { department: "depId" }, {
      user: { _id: OWNER_USER_ID, role: { title: "oqituvchi" } },
    });

    expect(TeacherProfile.findOne).toHaveBeenCalledWith({
      _id: "profileId123",
      department: "depId",
    });
  });

  test("profil topilmasa (yoki scope tashqarisida) 404 tashlaydi", async () => {
    TeacherProfile.findOne = jest.fn().mockReturnValue(chainablePopulate(null));

    await expect(
      buildTeacherPdf("profileId123", { department: "boshqaDep" }, {
        user: { _id: "somebody", role: { title: "oqituvchi" } },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

const renderBytes = (doc) =>
  new Promise((resolve) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
const countPages = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) || []).length;

describe("buildTeacherPdf — F-52/F-53 layout", () => {
  test("kichik profil BITTA sahifa (bo'sh footer sahifalari yo'q)", async () => {
    TeacherProfile.findOne = jest.fn().mockReturnValue(chainablePopulate(mockProfile));
    const doc = await buildTeacherPdf("profileId123", {}, {
      user: { _id: OWNER_USER_ID, role: { title: "oqituvchi" } },
    });
    const buf = await renderBytes(doc);
    expect(countPages(buf)).toBe(1);
  });

  test("«Kafedra» qatori ish ma'lumotlarida chiqadi (F-53 `titlee`)", async () => {
    TeacherProfile.findOne = jest.fn().mockReturnValue(chainablePopulate(mockProfile));
    const doc = await buildTeacherPdf("profileId123", {}, {
      user: { _id: OWNER_USER_ID, role: { title: "oqituvchi" } },
    });
    doc.end();
    const workRows = drawInfoCard.mock.calls[1][1];
    expect(workRows).toEqual(expect.arrayContaining([["Kafedra", "Ichki kasalliklar"]]));
  });
});

describe("buildTeacherPdf — shaxsiy blok TZ 4.3.10 (F-1)", () => {
  test("profil egasi o'zi so'rasa — shaxsiy maydonlar chiziladi", async () => {
    TeacherProfile.findOne = jest.fn().mockReturnValue(chainablePopulate(mockProfile));

    const doc = await buildTeacherPdf("profileId123", {}, {
      user: { _id: OWNER_USER_ID, role: { title: "oqituvchi" } },
    });
    doc.end();

    const labels = personalCardRows().map(([label]) => label);
    expect(labels).toContain("JSHSHIR");
    expect(labels).toContain("Pasport");
    expect(labels).toContain("Manzil");
  });

  test("begona (boshqa) rol ko'rsa — shaxsiy maydonlar YO'Q", async () => {
    TeacherProfile.findOne = jest.fn().mockReturnValue(chainablePopulate(mockProfile));

    const doc = await buildTeacherPdf("profileId123", {}, {
      user: { _id: "boshqa-user-id", role: { title: "kafedra_mudiri" } },
    });
    doc.end();

    const labels = personalCardRows().map(([label]) => label);
    expect(labels).not.toContain("JSHSHIR");
    expect(labels).not.toContain("Pasport");
    expect(labels).not.toContain("Manzil");
    expect(labels).toContain("F.I.Sh.");
  });

  test("kadrlar bo'limi ko'rsa — shaxsiy maydonlar chiziladi (PRIVILEGED_ROLES)", async () => {
    TeacherProfile.findOne = jest.fn().mockReturnValue(chainablePopulate(mockProfile));

    const doc = await buildTeacherPdf("profileId123", {}, {
      user: { _id: "hr-user-id", role: { title: "kadrlar" } },
    });
    doc.end();

    const labels = personalCardRows().map(([label]) => label);
    expect(labels).toContain("JSHSHIR");
  });
});
