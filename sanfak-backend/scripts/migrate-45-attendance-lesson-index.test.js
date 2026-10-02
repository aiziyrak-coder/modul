"use strict";

const { Types } = require("mongoose");
const {
  LESSON_MARKER_PREFIX,
  STATUS_RANK,
  rankRow,
  pickKeeper,
  diffFields,
  planDedupe,
  indexMatches,
  parseArgs,
} = require("./migrate-45-attendance-lesson-index");

const T0 = new Date("2026-09-10T06:00:00Z");
const later = (min) => new Date(T0.getTime() + min * 60e3);
const idAt = (date) => Types.ObjectId.createFromTime(Math.floor(date.getTime() / 1000));
const r = (fields) => ({ _id: new Types.ObjectId(), active: true, status: "absent", createdAt: T0, ...fields });
const keeperOf = (rows) => pickKeeper(rows).keeper;

describe("pickKeeper — ustuvorlik", () => {
  test("excused > present > absent", () => {
    const rows = [r({ status: "absent" }), r({ status: "present" }), r({ status: "excused" })];
    expect(keeperOf(rows).status).toBe("excused");
    expect(STATUS_RANK).toEqual({ excused: 0, present: 1, absent: 2 });
  });

  test("active:true absent > active:false excused (nofaol qator hech bir hisobotda yo'q)", () => {
    const live = r({ status: "absent" });
    expect(keeperOf([r({ status: "excused", active: false }), live])).toBe(live);
  });

  test("sessiya qatori HECH QACHON yutqazmaydi (hatto excused'ga ham)", () => {
    const session = r({ status: "absent", session: new Types.ObjectId() });
    expect(keeperOf([r({ status: "excused" }), session])).toBe(session);
  });

  test("bir xil holat — eng eski createdAt", () => {
    const old = r({ createdAt: T0 });
    expect(keeperOf([r({ createdAt: later(5) }), old])).toBe(old);
  });

  test("createdAt yo'q — ObjectId vaqti", () => {
    const old = { _id: idAt(T0), status: "absent", active: true };
    const young = { _id: idAt(later(60)), status: "absent", active: true };
    expect(keeperOf([young, old])).toBe(old);
    expect(rankRow(old)[3]).toBe(T0.getTime());
  });

  test("to'liq tenglik — eng kichik _id; kirish massivi o'zgarmaydi", () => {
    const a = r({ _id: new Types.ObjectId("6a0000000000000000000001") });
    const b = r({ _id: new Types.ObjectId("6a0000000000000000000002") });
    const rows = [b, a];
    const { keeper, losers } = pickKeeper(rows);
    expect(keeper).toBe(a);
    expect(losers).toEqual([b]);
    expect(rows).toEqual([b, a]);
  });

  test("noma'lum holat eng oxirida", () => {
    expect(keeperOf([r({ status: "late" }), r({ status: "absent" })]).status).toBe("absent");
  });
});

describe("diffFields", () => {
  const app = new Types.ObjectId();
  test("ObjectId ≡ uning satri; null ≡ yo'q", () => {
    expect(diffFields({ application: app, score: null, status: "absent", checkInTime: undefined },
      { application: String(app), status: "absent" })).toEqual([]);
  });
  test("farq qilgan status/hours/score ko'rsatiladi", () => {
    expect(diffFields({ status: "present", hours: 2, score: 8 }, { status: "absent", hours: 4, score: null }))
      .toEqual(["status", "hours", "score"]);
  });
});

const group = (date, rows) => ({ _id: { resident: rows[0].resident, date, science: null, lessonType: null }, rows });

describe("planDedupe", () => {
  const res = new Types.ObjectId();
  const row = (f) => r({ resident: res, ...f });

  test("marker = duplicate_lesson:<keeperId>; soat faqat absent+active losers, hours||2", () => {
    const keeper = row({ status: "excused" });
    const plan = planDedupe([
      group(T0, [keeper, row({ hours: 0 }), row({ hours: null }), row({ hours: 4 }),
        row({ hours: 8, active: false }), row({ status: "present", hours: 8 })]),
    ]);
    expect(plan.groups[0].keeperId).toBe(keeper._id);
    for (const l of plan.groups[0].losers) expect(l.reason).toBe(`${LESSON_MARKER_PREFIX}${keeper._id}`);
    expect(plan.extraRows).toBe(5);
    expect(plan.affected.get(String(res))).toBe(8);
  });

  test("ziddiyatli guruhlar soni; bir xil qatorlar ziddiyat emas", () => {
    const plan = planDedupe([
      group(T0, [row({}), row({})]),
      group(later(1), [row({ status: "present", score: 9 }), row({})]),
    ]);
    expect(plan.conflictGroups).toBe(1);
    expect(plan.groups[1].losers[0].conflicts).toEqual(["status", "score"]);
  });

  test("o'quv yili oynasidan tashqari yutqazgan soat hisobiga kirmaydi", () => {
    const window = { $gte: later(10), $lte: later(20) };
    const plan = planDedupe([group(T0, [row({}), row({})]), group(later(15), [row({}), row({})])], { window });
    expect(plan.affected.get(String(res))).toBe(2);
  });

  test("2+ sessiya qatori — blocked, rejaga kirmaydi", () => {
    const s = () => row({ session: new Types.ObjectId() });
    const plan = planDedupe([group(T0, [s(), s(), row({})])]);
    expect(plan.groups).toEqual([]);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.extraRows).toBe(0);
  });
});

describe("indexMatches", () => {
  const good = () => ({
    name: "resident_lesson_unique",
    key: { resident: 1, date: 1, science: 1, lessonType: 1 },
    unique: true,
    partialFilterExpression: { deletedAt: null },
  });
  test("aniq spetsifikatsiya — true; yo'q indeks — false", () => {
    expect(indexMatches(good())).toBe(true);
    expect(indexMatches(null)).toBe(false);
  });
  test("kalit tartibi boshqa / unique emas / partial filtrda active — false", () => {
    expect(indexMatches({ ...good(), key: { resident: 1, science: 1, date: 1, lessonType: 1 } })).toBe(false);
    expect(indexMatches({ ...good(), unique: false })).toBe(false);
    expect(indexMatches({ ...good(), partialFilterExpression: { deletedAt: null, active: true } })).toBe(false);
    expect(indexMatches({ ...good(), partialFilterExpression: undefined })).toBe(false);
  });
});

describe("parseArgs", () => {
  const argv = (...a) => ["node", "script", ...a];
  test("bayroqsiz — dry-run; --db / --revert qiymatlari", () => {
    expect(parseArgs(argv())).toMatchObject({ apply: false, dbName: null, revertFile: null });
    expect(parseArgs(argv("--apply", "--db=demo"))).toMatchObject({ apply: true, dbName: "demo" });
    expect(parseArgs(argv("--revert=a.json")).revertFile).toBe("a.json");
  });
  test("ziddiyatli bayroqlar rad etiladi", () => {
    expect(() => parseArgs(argv("--dry", "--apply"))).toThrow(/--dry/);
    expect(() => parseArgs(argv("--apply", "--revert=a.json"))).toThrow(/birga emas/);
  });
});
