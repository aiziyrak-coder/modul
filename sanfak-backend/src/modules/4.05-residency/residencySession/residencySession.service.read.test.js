"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/residentScope", () => ({ residentIdsFor: jest.fn() }));

const Session = require("./residencySession.model");
const Roster = require("./residencySessionRoster.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { residentIdsFor } = require("#modules/4.05-residency/_services/residentScope");
const { studyCutFilter } = require("#modules/4.05-residency/_services/sessionRoster");
const S = require("./residencySession.service");

const NOW = new Date("2026-09-27T10:00:00Z");
const OFFICE = { _id: "u-office", role: { title: "magistratura_bolim" } };
const TEACHER = { _id: "u-teacher", role: { title: "klinik_ustoz" } };
const q = (value) => {
  const chain = { select: () => chain, populate: () => chain, sort: () => chain, lean: jest.fn().mockResolvedValue(value) };
  return chain;
};
const doc = (extra = {}) => ({
  _id: "s1", day: "2026-09-28", group: { _id: "g1", title: "G-1" }, groupTitle: "G-1", science: { _id: "sc1", title: "T" },
  scienceTitle: "T", lessonType: "amaliy", hours: 2, announcedBy: { _id: "u-teacher", firstName: "A" }, rosterScope: "supervised",
  status: "announced", fannedOutAt: NOW, framedCount: 2, cancelledAt: null, cancelledBy: null, cancelReason: null,
  createdAt: NOW, updatedAt: NOW, secretInternal: "x", ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  residentIdsFor.mockResolvedValue(null);
  jest.spyOn(Roster, "distinct").mockResolvedValue(["s1", "s2"]);
  jest.spyOn(Roster, "exists").mockResolvedValue(null);
  jest.spyOn(Roster, "find").mockReturnValue(q([]));
  jest.spyOn(Session, "findById").mockReturnValue(q(doc()));
  jest.spyOn(Session, "paginate").mockResolvedValue({ docs: [doc()], totalDocs: 1, page: 1 });
  jest.spyOn(Resident, "paginate").mockResolvedValue({ docs: [] });
});
afterEach(() => jest.restoreAllMocks());

describe("ko'rish doirasi", () => {
  test("cheklovsiz rol — bo'sh filtr, distinct yo'q", async () => {
    await expect(S.sessionScope(OFFICE)).resolves.toEqual({ filter: {}, residentIds: null });
    expect(Roster.distinct).not.toHaveBeenCalled();
  });

  test("cheklangan — o'zi e'lon qilgan YOKI rezidenti freymlangan", async () => {
    residentIdsFor.mockResolvedValue(["r1"]);
    const scope = await S.sessionScope(TEACHER);
    expect(Roster.distinct).toHaveBeenCalledWith("session", { resident: { $in: ["r1"] } });
    expect(scope.filter).toEqual({ $or: [{ announcedBy: "u-teacher" }, { _id: { $in: ["s1", "s2"] } }] });
  });

  test("buildListFilter — oraliq va tenglik, `$or` yo'q", () => {
    expect(S.buildListFilter({ from: "2026-09-01", to: "", group: "g1", status: "cancelled", announcedBy: null, page: 2 })).toEqual({
      day: { $gte: "2026-09-01" },
      group: "g1",
      status: "cancelled",
    });
    expect(S.buildListFilter({ to: "2026-09-30", lessonType: "maruza", science: "sc" })).toEqual({
      day: { $lte: "2026-09-30" },
      lessonType: "maruza",
      science: "sc",
    });
  });

  test("paginate — doira + filtr, saralash, DTO", async () => {
    residentIdsFor.mockResolvedValue(["r1"]);
    const out = await S.paginate({ page: 1, limit: 20, group: "g1" }, TEACHER, { now: NOW });
    const [filter, opts] = Session.paginate.mock.calls[0];
    expect(filter).toEqual({ $or: expect.any(Array), group: "g1" });
    expect(opts).toMatchObject({ page: 1, limit: 20, sort: { day: -1, createdAt: -1, _id: -1 }, lean: true });
    expect(opts.populate.map((p) => p.path)).toEqual(["group", "science", "announcedBy", "cancelledBy"]);
    expect(out.docs[0]).not.toHaveProperty("secretInternal");
    expect(out.totalDocs).toBe(1);
  });
});

describe("findOne — doira va roster filtri", () => {
  test("yo'q — 404", async () => {
    Session.findById.mockReturnValue(q(null));
    await expect(S.findOne("s1", OFFICE, { now: NOW })).rejects.toMatchObject({ statusCode: 404, meta: { reason: "session_not_found" } });
  });

  test("doiradan tashqari — 404 (mavjudlik oshkor qilinmaydi)", async () => {
    residentIdsFor.mockResolvedValue(["r9"]);
    const other = { _id: "u-x", role: { title: "klinik_ustoz" } };
    await expect(S.findOne("s1", other, { now: NOW })).rejects.toMatchObject({ statusCode: 404 });
    expect(Roster.exists).toHaveBeenCalledWith({ session: "s1", resident: { $in: ["r9"] } });
    expect(Roster.find).not.toHaveBeenCalled();
  });

  test("rezident o'z freymi bilan — roster doira bilan, bekor/void chiqmaydi", async () => {
    residentIdsFor.mockResolvedValue(["r1"]);
    Roster.exists.mockResolvedValue({ _id: "f1" });
    await S.findOne("s1", { _id: "u-r", role: { title: "rezident" } }, { now: NOW });
    expect(Roster.find).toHaveBeenCalledWith({
      session: "s1",
      cancelledAt: null,
      outcome: { $ne: "void" },
      resident: { $in: ["r1"] },
    });
  });

  test("e'lonchi — o'z sessiyasini ko'radi; bo'lim — hammasini", async () => {
    residentIdsFor.mockResolvedValue([]);
    await expect(S.findOne("s1", TEACHER, { now: NOW })).resolves.toHaveProperty("session._id", "s1");
    residentIdsFor.mockResolvedValue(null);
    await S.findOne("s1", OFFICE, { now: NOW });
    expect(Roster.find).toHaveBeenLastCalledWith({ session: "s1", cancelledAt: null, outcome: { $ne: "void" } });
  });

  test("RosterDTO — oq ro'yxat, state = outcome, rezident null bo'lishi mumkin", async () => {
    Session.findById.mockReturnValue(q(doc({ lessonType: "maruza" })));
    Roster.find.mockReturnValue(
      q([
        { _id: "f1", resident: { _id: "r1", fullName: "Ali", groupTitle: "G", courseNumber: 1, specialtyTitle: "T", jshshir: "x" },
          outcome: "pending", outcomeReason: null, attendance: null, resolvedAt: null, session: "s1", day: "2026-09-28" },
        { _id: "f2", resident: null, outcome: "unmeasured", outcomeReason: "no_packet" },
      ]),
    );
    const { roster } = await S.findOne("s1", OFFICE, { now: NOW });
    expect(roster[0]).toEqual({
      _id: "f1", outcomeReason: null, attendance: null, resolvedAt: null, state: "pending",
      resident: { _id: "r1", fullName: "Ali", groupTitle: "G", courseNumber: 1, specialtyTitle: "T" },
      score: null, checkInTime: null, checkOutTime: null, scoreBlockedReason: "not_confirmed",
    });
    expect(roster[1]).toMatchObject({ resident: null, state: "unmeasured", outcomeReason: "no_packet" });
  });
});

describe("findOne — RosterDTO dars turini oladi", () => {
  test("amaliy sessiya — har qatorda scoreBlockedReason: lesson_type_not_graded (TZ 4.5.6, L3-Q8)", async () => {
    Roster.find.mockReturnValue(
      q([
        { _id: "f1", resident: null, outcome: "present", attendance: null },
        { _id: "f2", resident: null, outcome: "absent", attendance: null },
      ]),
    );
    const { roster } = await S.findOne("s1", OFFICE, { now: NOW });
    expect(roster.map((r) => r.scoreBlockedReason)).toEqual(["lesson_type_not_graded", "lesson_type_not_graded"]);
  });
});

describe("SessionDTO — oq ro'yxat va canCancel", () => {
  test("faqat ro'yxatdagi maydonlar", () => {
    const dto = S.toDTO(doc(), OFFICE, NOW);
    expect(Object.keys(dto).sort()).toEqual([...S.SESSION_FIELDS, "canCancel"].sort());
  });

  test.each([
    ["bo'lim, ochiq kun", doc(), OFFICE, true],
    ["ustoz, o'ziniki", doc(), TEACHER, true],
    ["ustoz, begona", doc(), { _id: "u-x", role: { title: "klinik_ustoz" } }, false],
    ["super_admin", doc(), { _id: "u-s", role: { title: "super_admin" } }, false],
    ["bekor qilingan", doc({ status: "cancelled" }), OFFICE, false],
    ["kun yopilgan", doc({ day: "2026-09-26" }), OFFICE, false],
    ["bugun (ochiq)", doc({ day: "2026-09-27" }), OFFICE, true],
  ])("%s → %p", (_label, d, user, expected) => {
    expect(S.toDTO(d, user, NOW).canCancel).toBe(expected);
  });
});

describe("ustozsiz rezidentlar (Q5=B)", () => {
  test("kesim + supervisor:null + guruh; cheklangan rol — o'z doirasi", async () => {
    residentIdsFor.mockResolvedValue(["r1"]);
    await S.unsupervisedResidents({ group: "g1", page: 2, limit: 10 }, TEACHER);
    const [filter, opts] = Resident.paginate.mock.calls[0];
    expect(filter).toEqual({ ...studyCutFilter(), supervisor: null, group: "g1", _id: { $in: ["r1"] } });
    expect(opts).toMatchObject({ page: 2, limit: 10, sort: { groupTitle: 1, fullName: 1, _id: 1 }, lean: true });
    expect(opts.select.split(" ")).toEqual(["fullName", "group", "groupTitle", "courseNumber", "specialtyTitle", "departmentTitle"]);
  });

  test("bo'lim — guruhsiz filtr, doira cheklovsiz", async () => {
    await S.unsupervisedResidents({ page: 1, limit: 20 }, OFFICE);
    expect(Resident.paginate.mock.calls[0][0]).toEqual({ ...studyCutFilter(), supervisor: null });
  });
});
