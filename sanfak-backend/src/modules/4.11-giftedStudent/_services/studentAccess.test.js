const mockFindById = jest.fn();
const mockFind = jest.fn();
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findById: (...a) => mockFindById(...a),
  find: (...a) => mockFind(...a),
}));
const mockWarn = jest.fn();
jest.mock("#shared/winston.logger", () => ({ warn: (...a) => mockWarn(...a) }));

const {
  canAccessStudent,
  denyStudentAccess,
  resolveOwnedGiftedStudentIds,
} = require("./studentAccess");

const ADVISOR_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ADVISOR_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const STUDENT_USER = "cccccccccccccccccccccccc";
const GS_ID = "dddddddddddddddddddddddd";

const stub = (doc) =>
  mockFindById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(doc) }) });

const perm = (section, ...actionKeys) => ({ section, actionKeys });

const user = (_id, permissions, title = "istalgan_nom") => ({
  _id,
  role: { title, permissions },
});

const REGISTRY_OWNER = [
  perm("giftedStudent", "create", "read", "readAll", "update", "delete"),
  perm("studentAchievement", "create", "approve"),
  perm("chat", "create"),
];
const OBSERVER = [perm("giftedStudent", "read", "readAll")];
const JUDGE = [perm("scholarshipApplication", "readAll", "score"), perm("giftedStudent", "read")];
const ADVISOR = [perm("giftedStudent", "read", "readAll"), perm("chat", "create")];
const STUDENT = [perm("giftedStudent", "read"), perm("studentAchievement", "create", "read")];

beforeEach(() => jest.clearAllMocks());

describe("canAccessStudent — cheklovsiz profillar", () => {
  test("ro'yxat egasi har qanday talabani ko'radi (DB'ga bormaydi ham)", async () => {
    await expect(
      canAccessStudent(user("x", REGISTRY_OWNER, "iqtidorli_iqtidorli_bolim"), GS_ID),
    ).resolves.toBe(true);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  test("kuzatuvchi rahbariyat va hakam — ha", async () => {
    await expect(canAccessStudent(user("x", OBSERVER, "rahbar"), GS_ID)).resolves.toBe(true);
    await expect(canAccessStudent(user("x", JUDGE, "iqtidorli_hakam"), GS_ID)).resolves.toBe(true);
  });
});

describe("canAccessStudent — egalik tekshiriladigan profillar", () => {
  test("maslahatchi O'Z talabasini ko'radi", async () => {
    stub({ advisorId: ADVISOR_A, user: STUDENT_USER });
    await expect(
      canAccessStudent(user(ADVISOR_A, ADVISOR, "iqtidorli_oqituvchi_(maslahatchi)"), GS_ID),
    ).resolves.toBe(true);
  });

  test("maslahatchi BOSHQA maslahatchining talabasini KO'RA OLMAYDI", async () => {
    stub({ advisorId: ADVISOR_A, user: STUDENT_USER });
    await expect(
      canAccessStudent(user(ADVISOR_B, ADVISOR, "iqtidorli_oqituvchi_(maslahatchi)"), GS_ID),
    ).resolves.toBe(false);
  });

  test("talaba faqat O'Z yozuvini ko'radi", async () => {
    stub({ advisorId: ADVISOR_A, user: STUDENT_USER });
    await expect(
      canAccessStudent(user(STUDENT_USER, STUDENT, "iqtidorli_talaba"), GS_ID),
    ).resolves.toBe(true);
    await expect(canAccessStudent(user("zzz", STUDENT, "iqtidorli_talaba"), GS_ID)).resolves.toBe(
      false,
    );
  });

  test("advisorId biriktirilmagan talaba — maslahatchiga ko'rinmaydi", async () => {
    stub({ advisorId: null, user: null });
    await expect(canAccessStudent(user(ADVISOR_A, ADVISOR), GS_ID)).resolves.toBe(false);
  });

  test("yozuv topilmasa — false", async () => {
    stub(null);
    await expect(canAccessStudent(user(ADVISOR_A, ADVISOR), GS_ID)).resolves.toBe(false);
  });
});

describe("canAccessStudent — noma'lum profil", () => {
  test("hech bir profilga tushmagan rol RAD etiladi va logga yoziladi", async () => {
    const auditor = user("x", [perm("giftedStudent", "read")], "auditor");
    await expect(canAccessStudent(auditor, GS_ID)).resolves.toBe(false);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][0]).toContain("auditor");
  });

  test("roli yo'q foydalanuvchi — false", async () => {
    await expect(canAccessStudent({ _id: "x" }, GS_ID)).resolves.toBe(false);
  });
});

describe("denyStudentAccess", () => {
  test("ruxsat bo'lsa javob yozmaydi", async () => {
    const res = { status: jest.fn(), json: jest.fn() };
    const req = { user: user("x", REGISTRY_OWNER) };
    await expect(denyStudentAccess(req, res, GS_ID)).resolves.toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("ruxsat bo'lmasa 404 yozadi (403 emas — ID mavjudligi oshkor bo'lmasin)", async () => {
    stub({ advisorId: ADVISOR_A, user: STUDENT_USER });
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const req = { user: user(ADVISOR_B, ADVISOR) };
    await expect(denyStudentAccess(req, res, GS_ID)).resolves.toBe(true);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("resolveOwnedGiftedStudentIds", () => {
  const stubFind = (rows) =>
    mockFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(rows) }) });

  test("maslahatchi — o'z advisee'larining giftedStudent id'lari ($in filtri uchun)", async () => {
    stubFind([{ _id: GS_ID }]);
    const ids = await resolveOwnedGiftedStudentIds(
      user(ADVISOR_A, ADVISOR, "iqtidorli_oqituvchi_(maslahatchi)"),
    );

    expect(ids).toEqual([GS_ID]);
    expect(mockFind).toHaveBeenCalledWith({ advisorId: ADVISOR_A });
  });

  test("begona advisor — o'zining bo'sh natijasi (boshqa advisor advisee'lari qaytmaydi)", async () => {
    stubFind([]);
    const ids = await resolveOwnedGiftedStudentIds(user(ADVISOR_B, ADVISOR));

    expect(ids).toEqual([]);
  });

  test("talaba — o'zining giftedStudent id'lari", async () => {
    stubFind([{ _id: GS_ID }]);
    const ids = await resolveOwnedGiftedStudentIds(user(STUDENT_USER, STUDENT, "iqtidorli_talaba"));

    expect(ids).toEqual([GS_ID]);
    expect(mockFind).toHaveBeenCalledWith({ user: STUDENT_USER });
  });

  test("registry-owner / kuzatuvchi rahbariyat / hakam — null (cheklanmaydi), DB'ga bormaydi", async () => {
    await expect(
      resolveOwnedGiftedStudentIds(user("x", REGISTRY_OWNER, "iqtidorli_iqtidorli_bolim")),
    ).resolves.toBeNull();
    await expect(resolveOwnedGiftedStudentIds(user("x", OBSERVER, "rektor"))).resolves.toBeNull();
    await expect(resolveOwnedGiftedStudentIds(user("x", JUDGE, "iqtidorli_hakam"))).resolves.toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  test("super_admin — null (god-mode NOM-bypass), DB'ga bormaydi", async () => {
    await expect(resolveOwnedGiftedStudentIds(user("x", [], "super_admin"))).resolves.toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  test("noma'lum profil / rolsiz — [] (deny-by-default), DB'ga bormaydi", async () => {
    await expect(
      resolveOwnedGiftedStudentIds(user("x", [perm("giftedStudent", "read")], "auditor")),
    ).resolves.toEqual([]);
    await expect(resolveOwnedGiftedStudentIds({ _id: "x" })).resolves.toEqual([]);
    expect(mockFind).not.toHaveBeenCalled();
  });
});
