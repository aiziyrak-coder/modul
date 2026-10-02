jest.mock("./practice.model");
jest.mock("#modules/4.13-practice/medicalOrganization/medicalOrganization.model");
jest.mock("#modules/4.13-practice/_shared/practiceNotify", () => ({
  notifyRoles: jest.fn(),
  notifyOrgResponsibleUsers: jest.fn(),
}));

const Contract = require("./practice.model");
const MedicalOrganization = require("#modules/4.13-practice/medicalOrganization/medicalOrganization.model");
const { ROLES } = require("#config/constants");
const service = require("./practice.service");
const {
  notifyRoles,
  notifyOrgResponsibleUsers,
} = require("#modules/4.13-practice/_shared/practiceNotify");

const mockFindChain = (mockFn, resolvedDocs) => {
  mockFn.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(resolvedDocs),
    }),
  });
};

const adminActor = { _id: "userAdmin", role: { title: ROLES.SUPER_ADMIN } };
const orgHeadActor = (id = "userRahbar") => ({
  _id: id,
  role: { title: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI },
});

const makeDoc = (overrides = {}) => ({
  _id: "doc1",
  number: "AM-0001/2026",
  status: "draft",
  organization: "org-77",
  history: [],
  rector: {},
  orgHead: {},
  rejectReason: undefined,
  rejectedBy: undefined,
  studentsCount: 0,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildFilter — rol-scope va status xavfsizligi", () => {
  test("rektor → status { $ne: 'draft' } (draft ko'rinmaydi)", () => {
    const f = service.buildFilter({ roleTitle: ROLES.REKTOR });
    expect(f.status).toEqual({ $ne: "draft" });
  });

  test("tibbiyot_birlashmasi_rahbari → status $in [rektor_approved, both_approved, rejected]", () => {
    const f = service.buildFilter({
      roleTitle: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI,
    });
    expect(f.status).toEqual({
      $in: ["rektor_approved", "both_approved", "rejected"],
    });
  });

  test("amaliyot_bolimi → status cheklovi yo'q", () => {
    const f = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI });
    expect(f.status).toBeUndefined();
  });

  test("rektor + query status='draft' → data.status='draft' QO'YILMAYDI (scope saqlanadi)", () => {
    const f = service.buildFilter({ roleTitle: ROLES.REKTOR, status: "draft" });
    expect(f.status).toEqual({ $ne: "draft" });
    expect(f.status).not.toBe("draft");
  });

  test("rektor + query status='rektor_approved' → scope ichida, status QO'LLANADI", () => {
    const f = service.buildFilter({
      roleTitle: ROLES.REKTOR,
      status: "rektor_approved",
    });
    expect(f.status).toBe("rektor_approved");
  });

  test("rahbar + query status='draft' → RAD (scope $in saqlanadi)", () => {
    const f = service.buildFilter({
      roleTitle: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI,
      status: "draft",
    });
    expect(f.status).toEqual({
      $in: ["rektor_approved", "both_approved", "rejected"],
    });
  });

  test("rahbar + query status='rejected' → scope ichida, QO'LLANADI", () => {
    const f = service.buildFilter({
      roleTitle: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI,
      status: "rejected",
    });
    expect(f.status).toBe("rejected");
  });

  test("amaliyot_bolimi + query status='draft' → scope yo'q, status QO'LLANADI", () => {
    const f = service.buildFilter({
      roleTitle: ROLES.AMALIYOT_BOLIMI,
      status: "draft",
    });
    expect(f.status).toBe("draft");
  });

  describe("status — bir nechta qiymat (massiv / vergul bilan ajratilgan)", () => {
    test("massiv (2 qiymat) → $in, cheklanmagan rolda", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.AMALIYOT_BOLIMI,
        status: ["rektor_approved", "both_approved"],
      });
      expect(f.status).toEqual({ $in: ["rektor_approved", "both_approved"] });
    });

    test("vergul bilan ajratilgan satr → $in (aynan massiv bilan bir xil natija)", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.AMALIYOT_BOLIMI,
        status: "rektor_approved,both_approved",
      });
      expect(f.status).toEqual({ $in: ["rektor_approved", "both_approved"] });
    });

    test("orqaga moslik: bitta qiymat (eskicha) → aynan tenglik, $in EMAS", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.AMALIYOT_BOLIMI,
        status: "draft",
      });
      expect(f.status).toBe("draft");
    });

    test("bitta qiymatli massiv → aynan tenglik ($in emas, eskicha xulq bilan bir xil)", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.AMALIYOT_BOLIMI,
        status: ["draft"],
      });
      expect(f.status).toBe("draft");
    });

    test("rahbar + ['draft','rektor_approved'] → faqat scope ichidagi 'rektor_approved' qoladi", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI,
        status: ["draft", "rektor_approved"],
      });
      expect(f.status).toBe("rektor_approved");
    });

    test("rektor + ['draft','rektor_approved','both_approved'] → 'draft' chetlab tashlanadi, qolgani $in", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.REKTOR,
        status: ["draft", "rektor_approved", "both_approved"],
      });
      expect(f.status).toEqual({ $in: ["rektor_approved", "both_approved"] });
    });

    test("rektor + ['draft'] (faqat taqiqlangan qiymat) → scope saqlanadi ({$ne:'draft'})", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.REKTOR,
        status: ["draft"],
      });
      expect(f.status).toEqual({ $ne: "draft" });
    });

    test("bo'sh massiv/satr → status filtri qo'yilmaydi (scope saqlanadi)", () => {
      const f1 = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI, status: [] });
      expect(f1.status).toBeUndefined();
      const f2 = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI, status: "" });
      expect(f2.status).toBeUndefined();
    });
  });

  test("search → number regex (case-insensitive)", () => {
    const f = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI, search: "AM-0007" });
    expect(f.number).toBeDefined();
    expect(f.number.$regex).toBeInstanceOf(RegExp);
    expect(f.number.$regex.flags).toContain("i");
    expect(f.number.$regex.test("am-0007/2026")).toBe(true);
  });

  test("search regex metakarakterlar escape qilinadi (ReDoS himoyasi)", () => {
    const f = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI, search: "a.b" });
    expect(f.number.$regex.test("axb")).toBe(false);
    expect(f.number.$regex.test("a.b")).toBe(true);
  });

  test("academicYear / direction / organization filtrlari qo'yiladi", () => {
    const f = service.buildFilter({
      roleTitle: ROLES.AMALIYOT_BOLIMI,
      academicYear: "ay1",
      direction: "dir1",
      organization: "org1",
    });
    expect(f.academicYear).toBe("ay1");
    expect(f.direction).toBe("dir1");
    expect(f.organization).toBe("org1");
  });

  test("active=false bo'lsa qo'yiladi (undefined emas)", () => {
    const f = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI, active: false });
    expect(f.active).toBe(false);
  });

  test("bo'sh query → bo'sh filtr (amaliyot_bolimi)", () => {
    const f = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI });
    expect(f).toEqual({});
  });

  test("course → number'ga aylantiriladi (query string'dan kelsa ham)", () => {
    const f = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI, course: "3" });
    expect(f.course).toBe(3);
  });

  test("group filtri qo'yiladi", () => {
    const f = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI, group: "301-A" });
    expect(f.group).toBe("301-A");
  });

  test("search + organizationIds → $or (raqam YOKI amaliyot bazasi)", () => {
    const f = service.buildFilter({
      roleTitle: ROLES.AMALIYOT_BOLIMI,
      search: "Farg'ona",
      organizationIds: ["org1", "org2"],
    });
    expect(f.number).toBeUndefined();
    expect(f.$or).toHaveLength(2);
    expect(f.$or[0].number.$regex).toBeInstanceOf(RegExp);
    expect(f.$or[1].organization).toEqual({ $in: ["org1", "org2"] });
  });

  test("search + bo'sh organizationIds → faqat raqam bo'yicha ($or yo'q)", () => {
    const f = service.buildFilter({
      roleTitle: ROLES.AMALIYOT_BOLIMI,
      search: "AM-0007",
      organizationIds: [],
    });
    expect(f.$or).toBeUndefined();
    expect(f.number.$regex).toBeInstanceOf(RegExp);
  });

  test("rol-scope $or bilan birga saqlanadi (rektor draft ko'rmaydi)", () => {
    const f = service.buildFilter({
      roleTitle: ROLES.REKTOR,
      search: "x",
      organizationIds: ["org1"],
    });
    expect(f.status).toEqual({ $ne: "draft" });
    expect(f.$or).toHaveLength(2);
  });

  describe("D-043 — tibbiyot_birlashmasi_rahbari organization scope", () => {
    test("userOrgIds bo'sh (biriktirilmagan) → organization {$in:[]} — hech narsa ko'rinmaydi", () => {
      const f = service.buildFilter({ roleTitle: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI });
      expect(f.organization).toEqual({ $in: [] });
    });

    test("userOrgIds berilgan → organization {$in: userOrgIds}", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI,
        userOrgIds: ["org1", "org2"],
      });
      expect(f.organization).toEqual({ $in: ["org1", "org2"] });
    });

    test("boshqa rollarda organization scope qo'yilmaydi (amaliyot_bolimi)", () => {
      const f = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI, userOrgIds: ["org1"] });
      expect(f.organization).toBeUndefined();
    });

    test("SECURITY: ?organization=<ruxsat etilgan> → aynan shu id qo'llanadi", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI,
        userOrgIds: ["org1", "org2"],
        organization: "org1",
      });
      expect(f.organization).toBe("org1");
    });

    test("SECURITY: ?organization=<begona tashkilot> → {$in:[]} (chetlab o'tish bloklandi)", () => {
      const f = service.buildFilter({
        roleTitle: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI,
        userOrgIds: ["org1"],
        organization: "org-begona",
      });
      expect(f.organization).toEqual({ $in: [] });
    });

    test("cheklanmagan rolda ?organization= to'g'ridan-to'g'ri qo'llanadi (regressiya yo'q)", () => {
      const f = service.buildFilter({ roleTitle: ROLES.AMALIYOT_BOLIMI, organization: "org9" });
      expect(f.organization).toBe("org9");
    });
  });
});

describe("resolveUserOrgIds — D-043 scope resolver", () => {
  test("tibbiyot_birlashmasi_rahbari → biriktirilgan tashkilot _id'lari (string)", async () => {
    mockFindChain(MedicalOrganization.find, [{ _id: "org1" }, { _id: "org2" }]);
    const ids = await service.resolveUserOrgIds({
      _id: "u1",
      role: { title: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI },
    });
    expect(MedicalOrganization.find).toHaveBeenCalledWith({ responsibleUsers: "u1" });
    expect(ids).toEqual(["org1", "org2"]);
  });

  test("boshqa rol → bo'sh massiv, DB so'rovisiz", async () => {
    const ids = await service.resolveUserOrgIds({ _id: "u1", role: { title: ROLES.REKTOR } });
    expect(ids).toEqual([]);
    expect(MedicalOrganization.find).not.toHaveBeenCalled();
  });

  test("user yo'q → bo'sh massiv", async () => {
    expect(await service.resolveUserOrgIds(undefined)).toEqual([]);
  });
});

describe("assertOrgOwnership — D-043 egalik tekshiruvi", () => {
  test("admin/super_admin — DB so'rovisiz o'tadi", async () => {
    await expect(service.assertOrgOwnership(adminActor, "org1")).resolves.toBeUndefined();
    expect(MedicalOrganization.findOne).not.toHaveBeenCalled();
  });

  test("boshqa rollar (rektor, amaliyot_bolimi) — cheklanmaydi", async () => {
    await expect(
      service.assertOrgOwnership({ _id: "u1", role: { title: ROLES.REKTOR } }, "org1"),
    ).resolves.toBeUndefined();
    expect(MedicalOrganization.findOne).not.toHaveBeenCalled();
  });

  test("tashkilot_rahbari + egalik topildi → o'tadi", async () => {
    mockFindChain(MedicalOrganization.findOne, { _id: "org1" });
    await expect(
      service.assertOrgOwnership(orgHeadActor("u1"), "org1"),
    ).resolves.toBeUndefined();
    expect(MedicalOrganization.findOne).toHaveBeenCalledWith({
      _id: "org1",
      responsibleUsers: "u1",
    });
  });

  test("tashkilot_rahbari + egalik topilmadi → ErrorHandler(403)", async () => {
    mockFindChain(MedicalOrganization.findOne, null);
    await expect(service.assertOrgOwnership(orgHeadActor("u1"), "org1")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test("populate qilingan organizationRef ({_id,...}) — _id ajratib olinadi", async () => {
    mockFindChain(MedicalOrganization.findOne, { _id: "org1" });
    await service.assertOrgOwnership(orgHeadActor("u1"), { _id: "org1", title: "Klinika" });
    expect(MedicalOrganization.findOne).toHaveBeenCalledWith({
      _id: "org1",
      responsibleUsers: "u1",
    });
  });
});

describe("narrowOrganizationFilter — query param scope'ni buzmaydi", () => {
  test("organization query berilmasa — bo'sh obyekt", () => {
    expect(service.narrowOrganizationFilter({ organization: { $in: ["a"] } }, undefined)).toEqual({});
  });

  test("scope'da organization cheklovi yo'q — query erkin qo'llanadi", () => {
    expect(service.narrowOrganizationFilter({}, "x1")).toEqual({ organization: "x1" });
  });

  test("ruxsat etilgan to'plamdagi id — to'g'ridan-to'g'ri qo'llanadi", () => {
    const scope = { organization: { $in: ["a", "b"] } };
    expect(service.narrowOrganizationFilter(scope, "b")).toEqual({ organization: "b" });
  });

  test("ruxsat etilmagan id — bo'sh natija ($in: [])", () => {
    const scope = { organization: { $in: ["a", "b"] } };
    expect(service.narrowOrganizationFilter(scope, "zzz")).toEqual({
      organization: { $in: [] },
    });
  });

  test("ObjectId-like qiymatlar ham string sifatida solishtiriladi", () => {
    const idLike = { toString: () => "abc123" };
    expect(
      service.narrowOrganizationFilter({ organization: { $in: [idLike] } }, "abc123"),
    ).toEqual({ organization: "abc123" });
  });
});

describe("pick — faqat ruxsat etilgan maydonlar (mass-assignment himoyasi)", () => {
  test("ruxsat etilgan maydonlarni saqlaydi", () => {
    const body = {
      organization: "org",
      direction: "dir",
      academicYear: "ay",
      course: 3,
      group: "g1",
      students: ["s1", "s2"],
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      note: "izoh",
    };
    const out = service.pick(body);
    expect(out).toEqual(body);
  });

  test("status/number/rector/orgHead/history/createdBy strip qilinadi", () => {
    const out = service.pick({
      organization: "org",
      status: "both_approved",
      number: "AM-9999/2026",
      rector: { signed: true },
      orgHead: { signed: true },
      history: [{ action: "hack" }],
      createdBy: "attacker",
      studentsCount: 999,
    });
    expect(out).toEqual({ organization: "org" });
    expect(out.status).toBeUndefined();
    expect(out.number).toBeUndefined();
    expect(out.rector).toBeUndefined();
    expect(out.orgHead).toBeUndefined();
    expect(out.history).toBeUndefined();
    expect(out.createdBy).toBeUndefined();
    expect(out.studentsCount).toBeUndefined();
  });

  test("undefined qiymatlar tushib qoladi (faqat mavjudlari)", () => {
    const out = service.pick({ organization: "org", direction: undefined });
    expect(out).toEqual({ organization: "org" });
    expect("direction" in out).toBe(false);
  });

  test("argumentsiz chaqirilsa → bo'sh obyekt", () => {
    expect(service.pick()).toEqual({});
  });
});

describe("sendToRector — draft → in_progress", () => {
  test("draft → in_progress, history o'sadi, save chaqiriladi", async () => {
    const doc = makeDoc({ status: "draft" });
    Contract.findById.mockResolvedValue(doc);

    const res = await service.sendToRector("doc1");

    expect(res).toBe(doc);
    expect(doc.status).toBe("in_progress");
    expect(doc.history.length).toBe(1);
    expect(doc.history[0].action).toBe("Rektorga tasdiqlashga yuborildi");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test("non-draft (in_progress) → { invalid }, status o'zgarmaydi, save YO'Q", async () => {
    const doc = makeDoc({ status: "in_progress" });
    Contract.findById.mockResolvedValue(doc);

    const res = await service.sendToRector("doc1");

    expect(res).toHaveProperty("invalid");
    expect(doc.status).toBe("in_progress");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("topilmasa → null", async () => {
    Contract.findById.mockResolvedValue(null);
    expect(await service.sendToRector("nope")).toBeNull();
  });
});

describe("rectorSign — in_progress → rektor_approved", () => {
  test("in_progress → rektor_approved, rector.signed=true + certInfo eri'dan", async () => {
    const doc = makeDoc({ status: "in_progress" });
    Contract.findById.mockResolvedValue(doc);

    const eri = {
      serialNumber: "SN-123",
      signedAt: new Date("2026-02-02"),
      signature: "sig-data",
      cert: {
        subject: "CN=Rektor",
        validFrom: new Date("2025-01-01"),
        validTo: new Date("2027-01-01"),
      },
    };
    const res = await service.rectorSign("doc1", eri, "userRektor");

    expect(res).toBe(doc);
    expect(doc.status).toBe("rektor_approved");
    expect(doc.rector.signed).toBe(true);
    expect(doc.rector.signer).toBe("userRektor");
    expect(doc.rector.signedAt).toEqual(eri.signedAt);
    expect(doc.rector.signature).toBe("sig-data");
    expect(doc.rector.certInfo).toEqual({
      serialNumber: "SN-123",
      subject: "CN=Rektor",
      validFrom: eri.cert.validFrom,
      validTo: eri.cert.validTo,
    });
    expect(doc.history[doc.history.length - 1].action).toBe("Rektor ERI bilan tasdiqladi");
    expect(doc.save).toHaveBeenCalledTimes(1);

    expect(notifyOrgResponsibleUsers).toHaveBeenCalledTimes(1);
    expect(notifyOrgResponsibleUsers).toHaveBeenCalledWith(
      doc.organization,
      expect.objectContaining({ eventType: "contract_rektor_approved" }),
    );
    expect(notifyRoles).not.toHaveBeenCalled();
  });

  test("certInfo cert ichidagi serialNumber'ni ham oladi (fallback)", async () => {
    const doc = makeDoc({ status: "in_progress" });
    Contract.findById.mockResolvedValue(doc);
    const eri = { cert: { serialNumber: "FROM-CERT" } };
    await service.rectorSign("doc1", eri, "u1");
    expect(doc.rector.certInfo.serialNumber).toBe("FROM-CERT");
  });

  test("noto'g'ri holat (draft) → { invalid }, save YO'Q", async () => {
    const doc = makeDoc({ status: "draft" });
    Contract.findById.mockResolvedValue(doc);
    const res = await service.rectorSign("doc1", { serialNumber: "x" }, "u1");
    expect(res).toHaveProperty("invalid");
    expect(doc.status).toBe("draft");
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("orgSign — rektor_approved → both_approved", () => {
  test("rektor_approved → both_approved, orgHead imzolanadi (admin actor — cheklovsiz)", async () => {
    const doc = makeDoc({ status: "rektor_approved", organization: "org1" });
    Contract.findById.mockResolvedValue(doc);
    const eri = { serialNumber: "SN-9", signature: "s" };
    const res = await service.orgSign("doc1", eri, adminActor);

    expect(res).toBe(doc);
    expect(doc.status).toBe("both_approved");
    expect(doc.orgHead.signed).toBe(true);
    expect(doc.orgHead.signer).toBe("userAdmin");
    expect(doc.orgHead.certInfo.serialNumber).toBe("SN-9");
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(MedicalOrganization.findOne).not.toHaveBeenCalled();
  });

  test("noto'g'ri holat (in_progress) → { invalid }", async () => {
    const doc = makeDoc({ status: "in_progress" });
    Contract.findById.mockResolvedValue(doc);
    const res = await service.orgSign("doc1", { serialNumber: "x" }, adminActor);
    expect(res).toHaveProperty("invalid");
    expect(doc.status).toBe("in_progress");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("SECURITY: begona tashkilot rahbari o'z tashkilotiga biriktirilmagan bo'lsa → 403, save YO'Q", async () => {
    const doc = makeDoc({ status: "rektor_approved", organization: "org1" });
    Contract.findById.mockResolvedValue(doc);
    mockFindChain(MedicalOrganization.findOne, null);

    await expect(
      service.orgSign("doc1", { serialNumber: "x" }, orgHeadActor("userRahbar2")),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(MedicalOrganization.findOne).toHaveBeenCalledWith({
      _id: "org1",
      responsibleUsers: "userRahbar2",
    });
    expect(doc.status).toBe("rektor_approved");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("o'z tashkilotiga biriktirilgan rahbar → imzolay oladi (ownership topildi)", async () => {
    const doc = makeDoc({ status: "rektor_approved", organization: "org1" });
    Contract.findById.mockResolvedValue(doc);
    mockFindChain(MedicalOrganization.findOne, { _id: "org1" });

    const res = await service.orgSign("doc1", { serialNumber: "SN-9" }, orgHeadActor("userRahbar1"));

    expect(res).toBe(doc);
    expect(doc.status).toBe("both_approved");
    expect(doc.orgHead.signer).toBe("userRahbar1");
  });

  test("populate qilingan organization ({_id,...}) bilan ham to'g'ri ishlaydi", async () => {
    const doc = makeDoc({
      status: "rektor_approved",
      organization: { _id: "org1", title: "Klinika" },
    });
    Contract.findById.mockResolvedValue(doc);
    mockFindChain(MedicalOrganization.findOne, null);

    await expect(
      service.orgSign("doc1", {}, orgHeadActor("userRahbar2")),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(MedicalOrganization.findOne).toHaveBeenCalledWith({
      _id: "org1",
      responsibleUsers: "userRahbar2",
    });
  });
});

describe("reject — in_progress → rejected", () => {
  test("in_progress → rejected, rejectReason + rejectedBy o'rnatiladi", async () => {
    const doc = makeDoc({ status: "in_progress" });
    Contract.findById.mockResolvedValue(doc);
    const res = await service.reject("doc1", "Hujjat to'liq emas", "rektor");

    expect(res).toBe(doc);
    expect(doc.status).toBe("rejected");
    expect(doc.rejectReason).toBe("Hujjat to'liq emas");
    expect(doc.rejectedBy).toBe("rektor");
    const last = doc.history[doc.history.length - 1];
    expect(last.actor).toBe("Rektor");
    expect(last.reason).toBe("Hujjat to'liq emas");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test("rektor_approved → rejected ham mumkin (o'z tashkilotining rahbari rad etadi)", async () => {
    const doc = makeDoc({ status: "rektor_approved", organization: "org1" });
    Contract.findById.mockResolvedValue(doc);
    mockFindChain(MedicalOrganization.findOne, { _id: "org1" });
    const res = await service.reject("doc1", "Sabab", "org_head", orgHeadActor("userRahbar1"));
    expect(res).toBe(doc);
    expect(doc.status).toBe("rejected");
    expect(doc.history[doc.history.length - 1].actor).toBe(
      "Tibbiyot birlashmasi rahbari",
    );
  });

  test("noto'g'ri holat (draft) → { invalid }", async () => {
    const doc = makeDoc({ status: "draft" });
    Contract.findById.mockResolvedValue(doc);
    const res = await service.reject("doc1", "x", "rektor");
    expect(res).toHaveProperty("invalid");
    expect(doc.status).toBe("draft");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("SECURITY: begona tashkilot rahbari rad eta olmaydi → 403, save YO'Q", async () => {
    const doc = makeDoc({ status: "rektor_approved", organization: "org1" });
    Contract.findById.mockResolvedValue(doc);
    mockFindChain(MedicalOrganization.findOne, null);

    await expect(
      service.reject("doc1", "Sabab", "org_head", orgHeadActor("userRahbar2")),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(doc.status).toBe("rektor_approved");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("admin rejectedBy='org_head' bilan rad etsa — egalik tekshiruvi bypass (demo)", async () => {
    const doc = makeDoc({ status: "rektor_approved", organization: "org1" });
    Contract.findById.mockResolvedValue(doc);
    const res = await service.reject("doc1", "Sabab", "org_head", adminActor);
    expect(res).toBe(doc);
    expect(doc.status).toBe("rejected");
    expect(MedicalOrganization.findOne).not.toHaveBeenCalled();
  });
});

describe("update — rejected → draft reset (imzo va sabab tozalanadi)", () => {
  test("rejected doc tahrirlanса draft'ga qaytadi, rector/orgHead/rejectReason tozalanadi", async () => {
    const doc = makeDoc({
      status: "rejected",
      rector: { signed: true, signer: "u1" },
      orgHead: { signed: true, signer: "u2" },
      rejectReason: "eski sabab",
      rejectedBy: "rektor",
    });
    Contract.findById.mockResolvedValue(doc);

    const res = await service.update("doc1", { note: "yangilandi", status: "both_approved" });

    expect(res).toBe(doc);
    expect(doc.status).toBe("draft");
    expect(doc.note).toBe("yangilandi");
    expect(doc.rector).toEqual({ signed: false });
    expect(doc.orgHead).toEqual({ signed: false });
    expect(doc.rejectReason).toBeNull();
    expect(doc.rejectedBy).toBeNull();
    expect(doc.history[doc.history.length - 1].action).toBe(
      "Tahrirlanib qayta 'Yangi' holatiga keltirildi",
    );
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test("draft doc tahrirlanса draft qoladi, history o'smaydi (reset YO'Q)", async () => {
    const doc = makeDoc({ status: "draft", history: [] });
    Contract.findById.mockResolvedValue(doc);
    const res = await service.update("doc1", { note: "x" });
    expect(res).toBe(doc);
    expect(doc.status).toBe("draft");
    expect(doc.note).toBe("x");
    expect(doc.history.length).toBe(0);
  });

  test("students berilsa studentsCount yangilanadi", async () => {
    const doc = makeDoc({ status: "draft" });
    Contract.findById.mockResolvedValue(doc);
    await service.update("doc1", { students: ["a", "b", "c"] });
    expect(doc.studentsCount).toBe(3);
  });

  test("noto'g'ri holat (in_progress) → { invalid }, save YO'Q", async () => {
    const doc = makeDoc({ status: "in_progress" });
    Contract.findById.mockResolvedValue(doc);
    const res = await service.update("doc1", { note: "x" });
    expect(res).toHaveProperty("invalid");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("topilmasa → null", async () => {
    Contract.findById.mockResolvedValue(null);
    expect(await service.update("nope", {})).toBeNull();
  });
});

describe("remove — faqat draft|rejected o'chiriladi", () => {
  test("non-draft/rejected (both_approved) → { invalid }, delete YO'Q", async () => {
    const doc = makeDoc({ status: "both_approved" });
    Contract.findById.mockResolvedValue(doc);
    const res = await service.remove("doc1");
    expect(res).toHaveProperty("invalid");
    expect(Contract.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test("draft → o'chiriladi (findByIdAndDelete chaqiriladi)", async () => {
    const doc = makeDoc({ status: "draft" });
    Contract.findById.mockResolvedValue(doc);
    Contract.findByIdAndDelete.mockResolvedValue(doc);
    const res = await service.remove("doc1");
    expect(res).toBe(doc);
    expect(Contract.findByIdAndDelete).toHaveBeenCalledWith("doc1");
  });

  test("rejected → o'chiriladi", async () => {
    const doc = makeDoc({ status: "rejected" });
    Contract.findById.mockResolvedValue(doc);
    Contract.findByIdAndDelete.mockResolvedValue(doc);
    const res = await service.remove("doc1");
    expect(res).toBe(doc);
    expect(Contract.findByIdAndDelete).toHaveBeenCalledWith("doc1");
  });

  test("topilmasa → null", async () => {
    Contract.findById.mockResolvedValue(null);
    expect(await service.remove("nope")).toBeNull();
  });
});
