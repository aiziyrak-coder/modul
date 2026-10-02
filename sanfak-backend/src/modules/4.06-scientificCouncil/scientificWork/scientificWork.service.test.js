jest.mock("./scientificWork.model");
jest.mock("#modules/4.06-scientificCouncil/_shared/scienceCouncilNotify");
jest.mock("#modules/4.06-scientificCouncil/workReview/workReview.model");

const ScientificWork = require("./scientificWork.model");
const WorkReview = require("#modules/4.06-scientificCouncil/workReview/workReview.model");
const {
  provisionExternalResearcherAccount,
} = require("#modules/4.06-scientificCouncil/_shared/scienceCouncilNotify");
const service = require("./scientificWork.service");

const WORK_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

const mockReviews = (types) => {
  WorkReview.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(types.map((type) => ({ type }))),
    }),
  });
};

const makeWork = (overrides = {}) => ({
  _id: WORK_ID,
  protocol: { immutable: false },
  documents: new Map(),
  auditLog: [],
  decisionHistory: [],
  status: "pending",
  authorType: "internal",
  revisionDocs: [],
  revisionDocsFixed: [],
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const mockFindById = (doc) => {
  ScientificWork.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(doc),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  provisionExternalResearcherAccount.mockResolvedValue(null);
});

describe("scientificWork.service — buildFilter (step: bosqichlar bo'linishi)", () => {
  test("step='works' — hali seminarga tavsiya etilmagan ishlar", () => {
    const filter = service.buildFilter({ step: "works" });
    expect(filter.finalDecision).toEqual({ $ne: "seminar" });
    expect(filter.seminarResult).toBeUndefined();
  });

  test("step='seminars' — seminarga tavsiya etilgan, himoyaga o'tmagan", () => {
    const filter = service.buildFilter({ step: "seminars" });
    expect(filter.finalDecision).toBe("seminar");
    expect(filter.seminarResult).toEqual({ $ne: "defended" });
    expect(filter.seminarDate).toBeUndefined();
  });

  test("step='defenses' — faqat seminarda himoyaga qo'yilganlar", () => {
    const filter = service.buildFilter({ step: "defenses" });
    expect(filter.seminarResult).toBe("defended");
    expect(filter.seminarDate).toBeUndefined();
  });

  test("bosqich shartlari o'zaro istisno qiladi (bir xil ish ikkitasiga tushmaydi)", () => {
    const works = service.buildFilter({ step: "works" });
    const seminars = service.buildFilter({ step: "seminars" });
    const defenses = service.buildFilter({ step: "defenses" });

    expect(works.finalDecision).toEqual({ $ne: "seminar" });
    expect(seminars.finalDecision).toBe("seminar");
    expect(seminars.seminarResult).toEqual({ $ne: "defended" });
    expect(defenses.seminarResult).toBe("defended");
  });

  test("step + status BIRGA ishlaydi (bosqich ichida toraytirish)", () => {
    const filter = service.buildFilter({ step: "seminars", status: "not_recommended" });
    expect(filter.status).toBe("not_recommended");
    expect(filter.finalDecision).toBe("seminar");
  });

  test("step berilmagan — bosqich shartlari umuman qo'shilmaydi", () => {
    const filter = service.buildFilter({});
    expect(filter.finalDecision).toBeUndefined();
    expect(filter.seminarResult).toBeUndefined();
    expect(filter.status).toBeUndefined();
  });

  test("noma'lum step qiymati — jimgina e'tiborsiz qoldiriladi (filtr buzilmaydi)", () => {
    const filter = service.buildFilter({ step: "nonsense" });
    expect(filter.seminarDate).toBeUndefined();
    expect(filter.seminarResult).toBeUndefined();
  });
});

describe("scientificWork.service — paginate (reviewCount)", () => {
  test("har bir ishga joriy sahifadagi WorkReview soni biriktiriladi", async () => {
    const docs = [
      { _id: "w1", toObject: jest.fn().mockReturnValue({ _id: "w1", title: "A" }) },
      { _id: "w2", toObject: jest.fn().mockReturnValue({ _id: "w2", title: "B" }) },
    ];
    ScientificWork.paginate = jest.fn().mockResolvedValue({
      docs, totalDocs: 2, page: 1, limit: 12, totalPages: 1,
    });
    WorkReview.aggregate = jest.fn().mockResolvedValue([{ _id: "w1", count: 5 }]);

    const result = await service.paginate({}, {});

    expect(result.docs[0]).toMatchObject({ _id: "w1", reviewCount: 5 });
    expect(result.docs[1]).toMatchObject({ _id: "w2", reviewCount: 0 });
    expect(WorkReview.aggregate).toHaveBeenCalledWith([
      { $match: { work: { $in: ["w1", "w2"] } } },
      { $group: { _id: "$work", count: { $sum: 1 } } },
    ]);
  });

  test("bo'sh sahifa — WorkReview.aggregate umuman chaqirilmaydi", async () => {
    ScientificWork.paginate = jest.fn().mockResolvedValue({
      docs: [], totalDocs: 0, page: 1, limit: 12, totalPages: 0,
    });
    WorkReview.aggregate = jest.fn();

    const result = await service.paginate({}, {});

    expect(result.docs).toEqual([]);
    expect(WorkReview.aggregate).not.toHaveBeenCalled();
  });
});

describe("scientificWork.service — update (D-025)", () => {
  test("imzolanmagan ish — findByIdAndUpdate chaqiriladi (qonuniy tahrir buzilmaydi)", async () => {
    mockFindById(makeWork({ protocol: { immutable: false } }));
    const updated = makeWork();
    ScientificWork.findByIdAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });

    const result = await service.update(WORK_ID, { title: "Yangi nom" });

    expect(result).toBe(updated);
    expect(ScientificWork.findByIdAndUpdate).toHaveBeenCalled();
  });

  test("imzolangan (immutable) ish — 409 throw, findByIdAndUpdate chaqirilmaydi", async () => {
    mockFindById(makeWork({ protocol: { immutable: true } }));
    ScientificWork.findByIdAndUpdate = jest.fn();

    await expect(
      service.update(WORK_ID, { title: "Boshqa nom" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(ScientificWork.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("hujjat topilmasa — null qaytadi", async () => {
    mockFindById(null);

    const result = await service.update(WORK_ID, { title: "x" });

    expect(result).toBeNull();
  });
});

describe("scientificWork.service — uploadDocument (D-025)", () => {
  test("imzolanmagan ish — hujjat yuklanadi", async () => {
    const work = makeWork({ protocol: { immutable: false } });
    mockFindById(work);

    await service.uploadDocument(WORK_ID, "cv", {
      fileName: "cv.pdf",
      filePath: "/files/cv.pdf",
      userId: "userId1",
    });

    expect(work.save).toHaveBeenCalled();
    expect(work.documents.get("cv")).toBeDefined();
  });

  test("imzolangan (immutable) ish — 409 throw, save chaqirilmaydi", async () => {
    const work = makeWork({ protocol: { immutable: true } });
    mockFindById(work);

    await expect(
      service.uploadDocument(WORK_ID, "cv", {
        fileName: "cv.pdf",
        filePath: "/files/cv.pdf",
        userId: "userId1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(work.save).not.toHaveBeenCalled();
  });
});

describe("scientificWork.service — uploadWorkFile", () => {
  test("imzolanmagan ish — fayl yuklanadi, workFile.version=1", async () => {
    const work = makeWork({ protocol: { immutable: false }, workFile: undefined });
    mockFindById(work);

    await service.uploadWorkFile(WORK_ID, {
      fileName: "ish.pdf",
      filePath: "/files/ish.pdf",
      userId: "userId1",
    });

    expect(work.save).toHaveBeenCalled();
    expect(work.workFile).toMatchObject({ fileName: "ish.pdf", version: 1 });
  });

  test("qayta yuklash — version oshadi", async () => {
    const work = makeWork({
      protocol: { immutable: false },
      workFile: { fileName: "eski.pdf", filePath: "/x", uploaded: true, version: 1 },
    });
    mockFindById(work);

    await service.uploadWorkFile(WORK_ID, {
      fileName: "yangi.pdf",
      filePath: "/files/yangi.pdf",
      userId: "userId1",
    });

    expect(work.workFile).toMatchObject({ fileName: "yangi.pdf", version: 2 });
  });

  test("imzolangan (immutable) ish — 409 throw, save chaqirilmaydi", async () => {
    const work = makeWork({ protocol: { immutable: true } });
    mockFindById(work);

    await expect(
      service.uploadWorkFile(WORK_ID, {
        fileName: "ish.pdf",
        filePath: "/files/ish.pdf",
        userId: "userId1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(work.save).not.toHaveBeenCalled();
  });

  test("ish topilmasa — null qaytadi", async () => {
    mockFindById(null);

    const result = await service.uploadWorkFile(WORK_ID, {
      fileName: "ish.pdf",
      filePath: "/files/ish.pdf",
      userId: "userId1",
    });

    expect(result).toBeNull();
  });
});

describe("scientificWork.service — acceptApplication", () => {
  test("status='new' — qabul qilinadi, status='accepted', a'zolar biriktiriladi", async () => {
    const work = makeWork({ status: "new", councilMembers: [] });
    mockFindById(work);

    await service.acceptApplication(WORK_ID, ["m1", "m2"], "userId1");

    expect(work.save).toHaveBeenCalled();
    expect(work.status).toBe("accepted");
    expect(work.councilMembers).toEqual(["m1", "m2"]);
  });

  test("status!='new' (masalan 'pending') — 409 throw, save chaqirilmaydi", async () => {
    const work = makeWork({ status: "pending" });
    mockFindById(work);

    await expect(
      service.acceptApplication(WORK_ID, ["m1"], "userId1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(work.save).not.toHaveBeenCalled();
  });

  test("ish topilmasa — null qaytadi", async () => {
    mockFindById(null);

    const result = await service.acceptApplication(WORK_ID, ["m1"], "userId1");

    expect(result).toBeNull();
  });

  test("authorType='internal' — akkaunt biriktirilmaydi, qo'shimcha audit yozuv yo'q", async () => {
    const work = makeWork({ status: "new", authorType: "internal", councilMembers: [] });
    mockFindById(work);

    await service.acceptApplication(WORK_ID, ["m1"], "userId1");

    expect(provisionExternalResearcherAccount).toHaveBeenCalledWith(work);
    expect(work.auditLog.map((a) => a.action)).toEqual(["application_accepted"]);
  });

  test("authorType='external' + akkaunt yaratildi — externalAuthor.provisionedUserId biriktiriladi + audit yozuv qo'shiladi", async () => {
    const work = makeWork({
      status: "new",
      authorType: "external",
      externalAuthor: { name: "Anvar Yusupov", pinfl: "111" },
      councilMembers: [],
    });
    mockFindById(work);
    provisionExternalResearcherAccount.mockResolvedValue("newUserId1");

    await service.acceptApplication(WORK_ID, ["m1"], "userId1");

    expect(work.externalAuthor.provisionedUserId).toBe("newUserId1");
    expect(work.auditLog.map((a) => a.action)).toEqual([
      "application_accepted",
      "external_account_provisioned",
    ]);
    expect(work.save).toHaveBeenCalled();
  });

  test("authorType='external' + akkaunt yaratilmadi (masalan PINFL yo'q) — accept baribir muvaffaqiyatli, qo'shimcha audit yo'q", async () => {
    const work = makeWork({
      status: "new",
      authorType: "external",
      externalAuthor: { name: "Anvar Yusupov", pinfl: "" },
      councilMembers: [],
    });
    mockFindById(work);
    provisionExternalResearcherAccount.mockResolvedValue(null);

    await service.acceptApplication(WORK_ID, ["m1"], "userId1");

    expect(work.status).toBe("accepted");
    expect(work.externalAuthor.provisionedUserId).toBeUndefined();
    expect(work.auditLog.map((a) => a.action)).toEqual(["application_accepted"]);
    expect(work.save).toHaveBeenCalled();
  });
});

describe("scientificWork.service — updateDocAssignments (avtomatik accepted → pending)", () => {
  const ALL_REQUIRED_KEYS = [
    "coverLetter", "passport", "cv", "biography", "dissertation", "abstract",
    "antiplagiat", "supervisorReview", "examCertificates", "form34",
    "publishedWorks", "implementationConclusions", "approbation",
    "ssvConclusion", "checkAct",
  ];
  const fullAssignments = () =>
    Object.fromEntries(ALL_REQUIRED_KEYS.map((k) => [k, ["member1"]]));

  test("status='accepted' + BARCHA majburiy hujjat biriktirilgan — avtomatik 'pending'ga o'tadi", async () => {
    const work = makeWork({ status: "accepted", docAssignments: {} });
    mockFindById(work);

    await service.updateDocAssignments(WORK_ID, fullAssignments(), "userId1");

    expect(work.status).toBe("pending");
    expect(work.save).toHaveBeenCalled();
  });

  test("status='accepted' + BIRTA majburiy hujjat yetishmasa — 'accepted'da qoladi", async () => {
    const work = makeWork({ status: "accepted", docAssignments: {} });
    mockFindById(work);
    const partial = fullAssignments();
    delete partial.checkAct;

    await service.updateDocAssignments(WORK_ID, partial, "userId1");

    expect(work.status).toBe("accepted");
  });

  test("status='accepted' + majburiy hujjat BO'SH massiv bilan (hech kim biriktirilmagan) — 'accepted'da qoladi", async () => {
    const work = makeWork({ status: "accepted", docAssignments: {} });
    mockFindById(work);
    const partial = fullAssignments();
    partial.checkAct = [];

    await service.updateDocAssignments(WORK_ID, partial, "userId1");

    expect(work.status).toBe("accepted");
  });

  test("status ALLAQACHON 'pending' — avtomatik o'tish qayta ishga tushmaydi (xato bermaydi)", async () => {
    const work = makeWork({ status: "pending", docAssignments: {} });
    mockFindById(work);

    await service.updateDocAssignments(WORK_ID, fullAssignments(), "userId1");

    expect(work.status).toBe("pending");
    expect(work.save).toHaveBeenCalled();
  });

  test("status='new' (hali qabul qilinmagan) — avtomatik o'tish ishlamaydi", async () => {
    const work = makeWork({ status: "new", docAssignments: {} });
    mockFindById(work);

    await service.updateDocAssignments(WORK_ID, fullAssignments(), "userId1");

    expect(work.status).toBe("new");
  });

  test("ish topilmasa — null qaytadi", async () => {
    mockFindById(null);

    const result = await service.updateDocAssignments(WORK_ID, fullAssignments(), "userId1");

    expect(result).toBeNull();
  });
});

describe("scientificWork.service — updateMembers (olib tashlashda 'egasiz hujjat' himoyasi)", () => {
  test("olib tashlanayotgan a'zo bir majburiy hujjatning YAGONA mas'uli — 409 throw, save chaqirilmaydi", async () => {
    const work = makeWork({
      status: "pending",
      councilMembers: ["m1", "m2"],
      docAssignments: { checkAct: ["m1"], form34: ["m1", "m2"] },
    });
    mockFindById(work);

    await expect(
      service.updateMembers(WORK_ID, ["m2"], "userId1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(work.save).not.toHaveBeenCalled();
    expect(work.councilMembers).toEqual(["m1", "m2"]);
  });

  test("olib tashlanayotgan a'zo hujjatning YAGONA mas'uli EMAS (boshqa a'zo ham bor) — ruxsat etiladi", async () => {
    const work = makeWork({
      status: "pending",
      councilMembers: ["m1", "m2"],
      docAssignments: { form34: ["m1", "m2"] },
    });
    mockFindById(work);

    await service.updateMembers(WORK_ID, ["m2"], "userId1");

    expect(work.save).toHaveBeenCalled();
    expect(work.councilMembers).toEqual(["m2"]);
  });

  test("xavfsiz olib tashlashda docAssignments'dagi eskirgan ID tozalanadi, qolganlari saqlanadi", async () => {
    const work = makeWork({
      status: "pending",
      councilMembers: ["m1", "m2"],
      docAssignments: { form34: ["m1", "m2"], checkAct: ["m2"] },
    });
    mockFindById(work);

    await service.updateMembers(WORK_ID, ["m2"], "userId1");

    expect(work.docAssignments).toEqual({ form34: ["m2"], checkAct: ["m2"] });
  });

  test("faqat qo'shish (hech kim olib tashlanmasa) — orphan tekshiruvi ishlamaydi, docAssignments tegilmaydi", async () => {
    const work = makeWork({
      status: "pending",
      councilMembers: ["m1"],
      docAssignments: { checkAct: ["m1"] },
    });
    mockFindById(work);

    await service.updateMembers(WORK_ID, ["m1", "m2"], "userId1");

    expect(work.save).toHaveBeenCalled();
    expect(work.councilMembers).toEqual(["m1", "m2"]);
    expect(work.docAssignments).toEqual({ checkAct: ["m1"] });
  });

  test("auditLog'ga olib tashlangan son bilan yozuv qo'shiladi", async () => {
    const work = makeWork({
      status: "pending",
      councilMembers: ["m1", "m2"],
      docAssignments: {},
    });
    mockFindById(work);

    await service.updateMembers(WORK_ID, ["m1"], "userId1");

    expect(work.auditLog).toHaveLength(1);
    expect(work.auditLog[0]).toMatchObject({
      action: "members_updated",
      user: "userId1",
    });
    expect(work.auditLog[0].detail).toMatch(/1 ta olib tashlandi/);
  });

  test("ish topilmasa — null qaytadi", async () => {
    mockFindById(null);

    const result = await service.updateMembers(WORK_ID, ["m1"], "userId1");

    expect(result).toBeNull();
  });
});

describe("scientificWork.service — memberDecision (a'zoning to'g'ridan-to'g'ri qarori)", () => {
  test("status!='pending' — 409 throw, save chaqirilmaydi", async () => {
    const work = makeWork({ status: "new", councilMembers: ["m1"] });
    mockFindById(work);

    await expect(
      service.memberDecision(WORK_ID, { type: "rejected", rejectionReason: "sabab", userId: "m1" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(work.save).not.toHaveBeenCalled();
  });

  test("chaqiruvchi councilMembers'da yo'q — 403 throw, save chaqirilmaydi", async () => {
    const work = makeWork({ status: "pending", councilMembers: ["m1", "m2"] });
    mockFindById(work);

    await expect(
      service.memberDecision(WORK_ID, { type: "rejected", rejectionReason: "sabab", userId: "notAMember" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(work.save).not.toHaveBeenCalled();
  });

  test("biriktirilgan a'zo, type='rejected' — status darhol 'rejected'ga o'zgaradi", async () => {
    const work = makeWork({ status: "pending", councilMembers: ["m1", "m2"] });
    mockFindById(work);

    await service.memberDecision(WORK_ID, {
      type: "rejected",
      rejectionReason: "Hujjatlar to'liq emas",
      userId: "m1",
    });

    expect(work.status).toBe("rejected");
    expect(work.rejectionReason).toBe("Hujjatlar to'liq emas");
    expect(work.finalDecision).toBe("rejected");
    expect(work.save).toHaveBeenCalled();
  });

  test("biriktirilgan a'zo, type='revision' — status darhol 'revision'ga o'zgaradi", async () => {
    const work = makeWork({ status: "pending", councilMembers: ["m1"] });
    mockFindById(work);

    await service.memberDecision(WORK_ID, {
      type: "revision",
      comment: "Antiplagiat qayta yuklansin",
      revisionDocs: ["antiplagiat"],
      userId: "m1",
    });

    expect(work.status).toBe("revision");
    expect(work.revisionComment).toBe("Antiplagiat qayta yuklansin");
    expect(work.revisionDocs).toEqual(["antiplagiat"]);
    expect(work.save).toHaveBeenCalled();
  });

  test("ish topilmasa — null qaytadi", async () => {
    mockFindById(null);

    const result = await service.memberDecision(WORK_ID, { type: "rejected", userId: "m1" });

    expect(result).toBeNull();
  });
});

describe("scientificWork.service — makeDecision (type: seminar)", () => {
  test("status 'not_evaluated'ga o'tadi — seminarDate/finalDecision/decisionHistory bilan birga", async () => {
    const work = makeWork({ status: "pending" });
    mockFindById(work);

    await service.makeDecision(WORK_ID, {
      type: "seminar",
      comment: "Kengash qarori",
      seminarDate: "2026-10-01",
      userId: "kotib1",
    });

    expect(work.status).toBe("not_evaluated");
    expect(work.seminarDate).toBe("2026-10-01");
    expect(work.finalDecision).toBe("seminar");
    expect(work.decisionHistory[0]).toMatchObject({ decision: "seminar", by: "kotib1" });
  });
});

const PAST = new Date("2020-01-15");

describe("scientificWork.service — updateSeminarResult (jarayon yakunlanishi)", () => {
  test("'not_defended' + status 'not_evaluated' — status 'not_recommended'ga o'tadi", async () => {
    const work = makeWork({ status: "not_evaluated", seminarDate: PAST });
    mockFindById(work);

    await service.updateSeminarResult(WORK_ID, "not_defended", undefined, "kotib1");

    expect(work.status).toBe("not_recommended");
    expect(work.seminarResult).toBe("not_defended");
    expect(work.defenseDate).toBeNull();
  });

  test("'defended' + status 'not_evaluated' — status O'ZGARMAYDI (jarayon davom etadi)", async () => {
    const work = makeWork({ status: "not_evaluated", seminarDate: PAST });
    mockFindById(work);

    await service.updateSeminarResult(WORK_ID, "defended", "2026-09-10", "kotib1");

    expect(work.status).toBe("not_evaluated");
    expect(work.defenseDate).toBe("2026-09-10");
  });

  test("natija tozalanadi (null) + status avval 'not_recommended' bo'lgan — 'not_evaluated'ga qaytadi (undo)", async () => {
    const work = makeWork({ status: "not_recommended" });
    mockFindById(work);

    await service.updateSeminarResult(WORK_ID, null, undefined, "kotib1");

    expect(work.status).toBe("not_evaluated");
  });

  test("status boshqa qiymat (masalan 'rejected') bo'lsa — bu yerdan tegilmaydi", async () => {
    const work = makeWork({ status: "rejected", seminarDate: PAST });
    mockFindById(work);

    await service.updateSeminarResult(WORK_ID, "not_defended", undefined, "kotib1");

    expect(work.status).toBe("rejected");
  });
});

describe("scientificWork.service — updateSeminarResult (natijani belgilash SHARTLARI)", () => {
  test("seminar sanasi YO'Q — natijani belgilab bo'lmaydi", async () => {
    const work = makeWork({ status: "not_evaluated" });
    mockFindById(work);

    await expect(
      service.updateSeminarResult(WORK_ID, "not_defended", undefined, "kotib1"),
    ).rejects.toThrow(/seminar sanasini belgilang/i);
    expect(work.save).not.toHaveBeenCalled();
  });

  test("seminar sanasi KELAJAKDA — natijani belgilab bo'lmaydi", async () => {
    const work = makeWork({ status: "not_evaluated", seminarDate: new Date("2099-01-01") });
    mockFindById(work);

    await expect(
      service.updateSeminarResult(WORK_ID, "not_defended", undefined, "kotib1"),
    ).rejects.toThrow(/yetib kelmagan/i);
    expect(work.save).not.toHaveBeenCalled();
  });

  test("'defended' — himoya sanasi SO'RALMAYDI (u 'Himoyalar' sahifasida qo'yiladi)", async () => {
    const work = makeWork({ status: "not_evaluated", seminarDate: PAST });
    mockFindById(work);

    await service.updateSeminarResult(WORK_ID, "defended", undefined, "kotib1");

    expect(work.seminarResult).toBe("defended");
    expect(work.save).toHaveBeenCalled();
  });

  test("natijani TOZALASH (null) — shartlarsiz, sanasiz ishda ham mumkin (undo)", async () => {
    const work = makeWork({ status: "not_recommended" });
    mockFindById(work);

    await service.updateSeminarResult(WORK_ID, null, undefined, "kotib1");

    expect(work.seminarResult).toBeNull();
    expect(work.status).toBe("not_evaluated");
  });
});

describe("scientificWork.service — isDatePassed", () => {
  const NOW = new Date("2026-08-23T09:00:00");

  test("BUGUNGA belgilangan sana o'tgan hisoblanadi (vaqt qismi e'tiborsiz)", () => {
    expect(service.isDatePassed(new Date("2026-08-23T00:00:00"), NOW)).toBe(true);
  });

  test("kechagi sana — o'tgan", () => {
    expect(service.isDatePassed(new Date("2026-08-22"), NOW)).toBe(true);
  });

  test("ertangi sana — hali o'tmagan", () => {
    expect(service.isDatePassed(new Date("2026-08-24"), NOW)).toBe(false);
  });

  test("sana yo'q yoki buzuq — o'tmagan hisoblanadi", () => {
    expect(service.isDatePassed(null, NOW)).toBe(false);
    expect(service.isDatePassed(undefined, NOW)).toBe(false);
    expect(service.isDatePassed("salom", NOW)).toBe(false);
  });
});

describe("scientificWork.service — updateSeminarDate", () => {
  test("sana belgilanadi va audit yoziladi", async () => {
    const work = makeWork({ status: "not_evaluated" });
    mockFindById(work);

    await service.updateSeminarDate(WORK_ID, "2026-09-15", "kotib1");

    expect(work.seminarDate).toBe("2026-09-15");
    expect(work.auditLog).toHaveLength(1);
    expect(work.auditLog[0].action).toBe("seminar_date_set");
  });

  test("`null` — sana tozalanadi", async () => {
    const work = makeWork({ status: "not_evaluated", seminarDate: PAST });
    mockFindById(work);

    await service.updateSeminarDate(WORK_ID, null, "kotib1");

    expect(work.seminarDate).toBeNull();
    expect(work.auditLog[0].action).toBe("seminar_date_cleared");
  });

  test("natijasi belgilangan seminarning sanasini o'zgartirib bo'lmaydi", async () => {
    const work = makeWork({
      status: "not_evaluated",
      seminarDate: PAST,
      seminarResult: "defended",
    });
    mockFindById(work);

    await expect(
      service.updateSeminarDate(WORK_ID, "2026-09-15", "kotib1"),
    ).rejects.toThrow(/o'zgartirib bo'lmaydi/);
    expect(work.save).not.toHaveBeenCalled();
  });

  test("ish topilmasa — null", async () => {
    mockFindById(null);
    expect(await service.updateSeminarDate(WORK_ID, "2026-09-15", "kotib1")).toBeNull();
  });
});

describe("scientificWork.service — updateDefenseDate", () => {
  test("sana belgilanadi va audit yoziladi", async () => {
    const work = makeWork({ status: "not_evaluated", seminarResult: "defended" });
    mockFindById(work);

    await service.updateDefenseDate(WORK_ID, "2026-10-15", "kotib1");

    expect(work.defenseDate).toBe("2026-10-15");
    expect(work.auditLog[0].action).toBe("defense_date_set");
  });

  test("`null` — sana tozalanadi", async () => {
    const work = makeWork({ seminarResult: "defended", defenseDate: new Date("2026-10-15") });
    mockFindById(work);

    await service.updateDefenseDate(WORK_ID, null, "kotib1");

    expect(work.defenseDate).toBeNull();
    expect(work.auditLog[0].action).toBe("defense_date_cleared");
  });

  test("natijasi belgilangan himoyaning sanasini o'zgartirib bo'lmaydi", async () => {
    const work = makeWork({ seminarResult: "defended", defenseResult: "defended" });
    mockFindById(work);

    await expect(
      service.updateDefenseDate(WORK_ID, "2026-10-15", "kotib1"),
    ).rejects.toThrow(/o'zgartirib bo'lmaydi/);
    expect(work.save).not.toHaveBeenCalled();
  });

  test("ish topilmasa — null", async () => {
    mockFindById(null);
    expect(await service.updateDefenseDate(WORK_ID, "2026-10-15", "kotib1")).toBeNull();
  });
});

describe("scientificWork.service — buildFilter (ixtisoslik/shifr filtri)", () => {
  test("`specialty` berilsa filtrga qo'shiladi", () => {
    expect(service.buildFilter({ specialty: "sp1" }).specialty).toBe("sp1");
  });

  test("berilmasa — filtrda umuman yo'q (butun ro'yxat)", () => {
    expect(service.buildFilter({}).specialty).toBeUndefined();
  });

  test("bosqich bilan BIRGA ishlaydi (uchala ro'yxatda ham filtrlash mumkin)", () => {
    const f = service.buildFilter({ step: "defenses", specialty: "sp1" });
    expect(f.specialty).toBe("sp1");
    expect(f.seminarResult).toBe("defended");
  });
});

describe("scientificWork.service — buildFilter (kengash raqami filtri)", () => {
  test("faqat raqam berilsa — uning shifrlari bo'yicha `$in`", () => {
    expect(service.buildFilter({ specialtyIds: ["a", "b"] }).specialty).toEqual({
      $in: ["a", "b"],
    });
  });

  test("raqam + shifr birga — KESISHMA (shifr raqamga tegishli bo'lsa)", () => {
    expect(
      service.buildFilter({ specialty: "a", specialtyIds: ["a", "b"] }).specialty,
    ).toBe("a");
  });

  test("shifr raqamga tegishli EMAS — bo'sh natija (butun ro'yxat EMAS)", () => {
    expect(
      service.buildFilter({ specialty: "z", specialtyIds: ["a", "b"] }).specialty,
    ).toEqual({ $in: [] });
  });

  test("hech biri berilmasa — ixtisoslik sharti umuman yo'q", () => {
    expect(service.buildFilter({}).specialty).toBeUndefined();
  });
});

describe("scientificWork.service — updateDefenseResult (jarayon yakunlanishi)", () => {
  test("'defended' + status 'not_evaluated' — status 'not_recommended'ga o'tadi", async () => {
    const work = makeWork({ status: "not_evaluated" });
    mockFindById(work);

    await service.updateDefenseResult(WORK_ID, "defended", "kotib1");

    expect(work.status).toBe("not_recommended");
    expect(work.defenseResult).toBe("defended");
  });

  test("'not_defended' + status 'not_evaluated' — status ham 'not_recommended'ga o'tadi (natija qanday bo'lishidan qat'iy nazar, jarayon yakunlangan)", async () => {
    const work = makeWork({ status: "not_evaluated" });
    mockFindById(work);

    await service.updateDefenseResult(WORK_ID, "not_defended", "kotib1");

    expect(work.status).toBe("not_recommended");
  });

  test("natija tozalanadi (null) + status avval 'not_recommended' bo'lgan — 'not_evaluated'ga qaytadi (undo)", async () => {
    const work = makeWork({ status: "not_recommended" });
    mockFindById(work);

    await service.updateDefenseResult(WORK_ID, null, "kotib1");

    expect(work.status).toBe("not_evaluated");
  });
});

describe("scientificWork.service — markReviewedIfComplete / revertToPendingIfIncomplete (barcha xulosa berilgach avto-o'tish)", () => {
  const ALL_REQUIRED_KEYS = [
    "coverLetter", "passport", "cv", "biography", "dissertation", "abstract",
    "antiplagiat", "supervisorReview", "examCertificates", "form34",
    "publishedWorks", "implementationConclusions", "approbation",
    "ssvConclusion", "checkAct",
  ];
  const fullAssignments = () =>
    Object.fromEntries(ALL_REQUIRED_KEYS.map((k) => [k, ["member1"]]));
  const fullReviews = () =>
    ALL_REQUIRED_KEYS.map((docKey) => ({ member: "member1", docKey }));

  const mockMemberDocReviews = (reviews) => {
    WorkReview.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(reviews),
      }),
    });
  };

  describe("markReviewedIfComplete", () => {
    test("status='pending' + BARCHA majburiy hujjat+a'zo juftligiga xulosa bor — 'reviewed'ga o'tadi", async () => {
      const work = makeWork({ status: "pending", docAssignments: fullAssignments() });
      mockFindById(work);
      mockMemberDocReviews(fullReviews());

      await service.markReviewedIfComplete(WORK_ID, "member1");

      expect(work.status).toBe("reviewed");
      expect(work.save).toHaveBeenCalled();
    });

    test("BITTA hujjat+a'zo juftligiga xulosa yetishmasa — 'pending'da qoladi, save chaqirilmaydi", async () => {
      const work = makeWork({ status: "pending", docAssignments: fullAssignments() });
      mockFindById(work);
      mockMemberDocReviews(fullReviews().filter((r) => r.docKey !== "checkAct"));

      const result = await service.markReviewedIfComplete(WORK_ID, "member1");

      expect(result).toBeNull();
      expect(work.status).toBe("pending");
      expect(work.save).not.toHaveBeenCalled();
    });

    test("status 'pending' EMAS (masalan 'accepted') — WorkReview umuman so'ralmaydi, tegilmaydi", async () => {
      const work = makeWork({ status: "accepted", docAssignments: fullAssignments() });
      mockFindById(work);
      mockMemberDocReviews(fullReviews());

      const result = await service.markReviewedIfComplete(WORK_ID, "member1");

      expect(result).toBeNull();
      expect(work.status).toBe("accepted");
      expect(WorkReview.find).not.toHaveBeenCalled();
    });

    test("ish topilmasa — null qaytadi", async () => {
      mockFindById(null);

      const result = await service.markReviewedIfComplete(WORK_ID, "member1");

      expect(result).toBeNull();
    });
  });

  describe("revertToPendingIfIncomplete", () => {
    test("status='reviewed' + xulosa o'chirilib MAJBURIY juftlik endi to'liq emas — 'pending'ga qaytadi", async () => {
      const work = makeWork({ status: "reviewed", docAssignments: fullAssignments() });
      mockFindById(work);
      mockMemberDocReviews(fullReviews().filter((r) => r.docKey !== "checkAct"));

      await service.revertToPendingIfIncomplete(WORK_ID, "kotib1");

      expect(work.status).toBe("pending");
      expect(work.save).toHaveBeenCalled();
    });

    test("status='reviewed' + o'chirilgan xulosa MAJBURIY bo'lmagan hujjat uchun edi — 'reviewed'da qoladi", async () => {
      const work = makeWork({ status: "reviewed", docAssignments: fullAssignments() });
      mockFindById(work);
      mockMemberDocReviews(fullReviews());

      const result = await service.revertToPendingIfIncomplete(WORK_ID, "kotib1");

      expect(result).toBeNull();
      expect(work.status).toBe("reviewed");
      expect(work.save).not.toHaveBeenCalled();
    });

    test("status 'reviewed' EMAS (masalan 'not_evaluated') — bu yerdan tegilmaydi", async () => {
      const work = makeWork({ status: "not_evaluated", docAssignments: fullAssignments() });
      mockFindById(work);

      const result = await service.revertToPendingIfIncomplete(WORK_ID, "kotib1");

      expect(result).toBeNull();
      expect(work.status).toBe("not_evaluated");
      expect(WorkReview.find).not.toHaveBeenCalled();
    });

    test("ish topilmasa — null qaytadi", async () => {
      mockFindById(null);

      const result = await service.revertToPendingIfIncomplete(WORK_ID, "kotib1");

      expect(result).toBeNull();
    });
  });
});

describe("scientificWork.service — generateProtocol (D-025 + avtomatik seminar qarori)", () => {
  test("imzolanmagan ish — dalolatnoma qayta yaratiladi", async () => {
    const work = makeWork({ protocol: { immutable: false } });
    mockFindById(work);
    mockReviews(["positive"]);

    await service.generateProtocol(WORK_ID, "Yakuniy xulosa", "userId1");

    expect(work.save).toHaveBeenCalled();
    expect(work.protocol.finalConclusion).toBe("Yakuniy xulosa");
  });

  test("imzolangan (immutable) dalolatnoma — 409 throw, `immutable` true qoladi, WorkReview so'ralmaydi", async () => {
    const work = makeWork({
      protocol: { immutable: true, finalConclusion: "Eski xulosa" },
    });
    mockFindById(work);

    await expect(
      service.generateProtocol(WORK_ID, "Soxta xulosa", "userId1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(work.save).not.toHaveBeenCalled();
    expect(work.protocol.immutable).toBe(true);
    expect(work.protocol.finalConclusion).toBe("Eski xulosa");
    expect(WorkReview.find).not.toHaveBeenCalled();
  });

  test("barcha xulosa ijobiy/neytral — status 'not_evaluated'ga o'tadi, finalDecision belgilanadi", async () => {
    const work = makeWork({ status: "pending" });
    mockFindById(work);
    mockReviews(["positive", "positive", "neutral"]);

    await service.generateProtocol(WORK_ID, "Yakuniy xulosa", "userId1");

    expect(work.status).toBe("not_evaluated");
    expect(work.seminarDate).toBeUndefined();
    expect(work.finalDecision).toBe("seminar");
    expect(work.decisionHistory).toHaveLength(1);
    expect(work.decisionHistory[0]).toMatchObject({ decision: "seminar", by: "userId1" });
  });

  test("hech qanday xulosa yo'q (bo'sh) — salbiy yo'q hisoblanib, status baribir 'not_evaluated'ga o'tadi", async () => {
    const work = makeWork({ status: "pending" });
    mockFindById(work);
    mockReviews([]);

    await service.generateProtocol(WORK_ID, "Yakuniy xulosa", "userId1");

    expect(work.status).toBe("not_evaluated");
    expect(work.seminarDate).toBeUndefined();
  });

  test("BITTA salbiy xulosa bo'lsa ham — status 'not_recommended'ga o'tadi, finalDecision belgilanmaydi", async () => {
    const work = makeWork({ status: "pending" });
    mockFindById(work);
    mockReviews(["positive", "negative", "neutral"]);

    await service.generateProtocol(WORK_ID, "Yakuniy xulosa", "userId1", "2026-09-01");

    expect(work.status).toBe("not_recommended");
    expect(work.seminarDate).toBeUndefined();
    expect(work.finalDecision).toBeUndefined();
    expect(work.decisionHistory).toHaveLength(0);
    expect(work.save).toHaveBeenCalled();
  });

  test("auditLog'ga xulosa sonlari yoziladi (ijobiy/neytral/salbiy)", async () => {
    const work = makeWork({ status: "pending" });
    mockFindById(work);
    mockReviews(["positive", "positive", "negative"]);

    await service.generateProtocol(WORK_ID, "Yakuniy xulosa", "userId1");

    expect(work.auditLog[0].detail).toMatch(/2 ijobiy, 0 neytral, 1 salbiy/);
    expect(work.auditLog[0].detail).toMatch(/tavsiya etilmadi/);
  });
});
