"use strict";

jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model", () => ({ find: jest.fn(), bulkWrite: jest.fn() }));
jest.mock("#modules/4.01-auth/auditLog/auditLog.model", () => ({ find: jest.fn() }));
jest.mock("#modules/4.01-auth/user/user.model", () => ({ find: jest.fn() }));
jest.mock("#modules/4.01-auth/role/role.model", () => ({}));

const fs = require("fs");
const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const AuditLog = require("#modules/4.01-auth/auditLog/auditLog.model");
const User = require("#modules/4.01-auth/user/user.model");
const { ROLES } = require("#config/constants");
const { pickOwner, recover, revert } = require("./fix-syllabus-orphan-author");

const DOC_A = "64c0000000000000000000a1";
const DOC_B = "64c0000000000000000000b2";
const DOC_C = "64c0000000000000000000c3";
const DOC_D = "64c0000000000000000000d4";
const TEACHER_1 = "64d000000000000000000001";
const TEACHER_2 = "64d000000000000000000002";
const SUPER = "64d0000000000000000000ff";
const GONE = "64d0000000000000000000ee";

const put = (docId, user) => ({ user, path: `/api/syllabi/${docId}`, targetId: docId });

const chain = (docs) => ({ select: () => ({ lean: () => Promise.resolve(docs) }) });
const userChain = (docs) => ({
  select: () => ({ populate: () => ({ lean: () => Promise.resolve(docs) }) }),
});

beforeEach(() => jest.clearAllMocks());

describe("pickOwner — egani aniqlash", () => {
  test("yagona muallif — ok (bir necha PUT bitta foydalanuvchidan)", () => {
    const r = pickOwner([put(DOC_A, TEACHER_1), put(DOC_A, TEACHER_1)], DOC_A, new Set());
    expect(r).toEqual({ status: "ok", userId: TEACHER_1, candidates: [TEACHER_1] });
  });

  test("super_admin yozuvi hisobga olinmaydi", () => {
    const r = pickOwner([put(DOC_A, SUPER), put(DOC_A, TEACHER_1)], DOC_A, new Set([SUPER]));
    expect(r.status).toBe("ok");
    expect(r.userId).toBe(TEACHER_1);
  });

  test("ikki turli nomzod — noaniq, egasi tanlanmaydi", () => {
    const r = pickOwner([put(DOC_A, TEACHER_1), put(DOC_A, TEACHER_2)], DOC_A, new Set());
    expect(r.status).toBe("ambiguous");
    expect(r.userId).toBeNull();
    expect(r.candidates.sort()).toEqual([TEACHER_1, TEACHER_2].sort());
  });

  test("boshqa yo'l (zanjir amali) va aktorsiz yozuv — isbot emas", () => {
    const r = pickOwner(
      [
        { user: TEACHER_2, path: `/api/syllabi/approve/${DOC_A}` },
        { user: null, path: `/api/syllabi/${DOC_A}` },
      ],
      DOC_A,
      new Set(),
    );
    expect(r.status).toBe("none");
  });

  test("query string va katta harf — yo'l baribir mos keladi", () => {
    const r = pickOwner(
      [{ user: TEACHER_1, path: `/api/syllabi/${DOC_A.toUpperCase()}?x=1` }],
      DOC_A,
      new Set(),
    );
    expect(r.status).toBe("ok");
  });
});

describe("recover — dry-run va --apply", () => {
  const setup = () => {
    Syllabus.find.mockReturnValue(
      chain([
        { _id: DOC_A, status: "draft" },
        { _id: DOC_B, status: "new" },
        { _id: DOC_C, status: "draft" },
        { _id: DOC_D, status: "draft" },
      ]),
    );
    AuditLog.find.mockReturnValue(
      chain([
        put(DOC_A, TEACHER_1),
        put(DOC_A, SUPER),
        put(DOC_B, TEACHER_1),
        put(DOC_B, TEACHER_2),
        put(DOC_D, GONE),
      ]),
    );
    User.find.mockReturnValue(
      userChain([
        { _id: TEACHER_1, firstName: "Dilnoza", lastName: "Karimova", role: { title: ROLES.OQITUVCHI } },
        { _id: TEACHER_2, firstName: "Aziz", lastName: "Umirzakov", role: { title: ROLES.OQITUVCHI } },
        { _id: SUPER, firstName: "Super", lastName: "Admin", role: { title: ROLES.SUPER_ADMIN } },
      ]),
    );
    Syllabus.bulkWrite.mockResolvedValue({ modifiedCount: 1 });
  };

  test("dry-run: toifalarga ajratiladi, bazaga HECH NARSA yozilmaydi", async () => {
    setup();
    const r = await recover({ apply: false });
    expect(r.orphans).toBe(4);
    expect(r.toFix).toEqual([{ id: DOC_A, status: "draft", userId: TEACHER_1, name: "Karimova Dilnoza" }]);
    expect(r.ambiguous.map((d) => d.id)).toEqual([DOC_B]);
    expect(r.noSource.map((d) => d.id)).toEqual([DOC_C]);
    expect(r.userMissing.map((d) => d.id)).toEqual([DOC_D]);
    expect(Syllabus.bulkWrite).not.toHaveBeenCalled();
    const [filter] = AuditLog.find.mock.calls[0];
    expect(filter).toEqual({ targetId: { $in: [DOC_A, DOC_B, DOC_C, DOC_D] }, method: "PUT", statusCode: 200 });
  });

  test("--apply: faqat aniq egasi bor hujjat, `author.teacher: null` qo'riqchisi bilan", async () => {
    setup();
    const r = await recover({ apply: true, backup: false });
    expect(Syllabus.bulkWrite).toHaveBeenCalledTimes(1);
    expect(Syllabus.bulkWrite.mock.calls[0][0]).toEqual([
      {
        updateOne: {
          filter: { _id: DOC_A, "author.teacher": null },
          update: { $set: { "author.teacher": TEACHER_1 } },
        },
      },
    ]);
    expect(r.changed).toBe(1);
  });

  test("egasiz hujjat yo'q — jurnal ham so'ralmaydi, yozuv yo'q", async () => {
    Syllabus.find.mockReturnValue(chain([]));
    const r = await recover({ apply: true, backup: false });
    expect(r.orphans).toBe(0);
    expect(AuditLog.find).not.toHaveBeenCalled();
    expect(Syllabus.bulkWrite).not.toHaveBeenCalled();
  });
});

describe("revert — faqat hali aynan tiklangan egasi turgan hujjatlar", () => {
  test("zaxiradagi juftliklar, yaroqsiz yozuv tashlanadi", async () => {
    jest.spyOn(fs, "readFileSync").mockReturnValueOnce(
      JSON.stringify({ items: [{ id: DOC_A, userId: TEACHER_1 }, { id: "yaroqsiz", userId: TEACHER_2 }] }),
    );
    Syllabus.bulkWrite.mockResolvedValue({ modifiedCount: 1 });
    const r = await revert({ file: "zaxira.json" });
    expect(Syllabus.bulkWrite.mock.calls[0][0]).toEqual([
      {
        updateOne: {
          filter: { _id: DOC_A, "author.teacher": TEACHER_1 },
          update: { $set: { "author.teacher": null } },
        },
      },
    ]);
    expect(r).toEqual({ items: 1, changed: 1 });
  });
});
