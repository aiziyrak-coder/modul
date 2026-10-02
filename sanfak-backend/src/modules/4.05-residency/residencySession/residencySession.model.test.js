"use strict";

const mongoose = require("mongoose");
const Session = require("./residencySession.model");
const Roster = require("./residencySessionRoster.model");
const {
  RESIDENCY_LESSON_TYPES,
  ATTENDANCE_STATUSES,
} = require("#modules/4.05-residency/attendance/attendance.model");

const oid = () => new mongoose.Types.ObjectId();
const indexNamed = (Model, name) => Model.schema.indexes().find(([, opts]) => opts.name === name);
const sessionBase = () => ({
  day: "2026-09-28",
  group: oid(),
  science: oid(),
  lessonType: "amaliy",
  hours: 2,
  announcedBy: oid(),
  rosterScope: "supervised",
  status: "announced",
});
const frameBase = () => ({
  session: oid(),
  resident: oid(),
  day: "2026-09-28",
  science: oid(),
  lessonType: "amaliy",
  hours: 2,
  outcome: "pending",
});

describe("sessiya indekslari", () => {
  test("`session_announced_unique` — kalit, unique, partial {status:'announced'}", () => {
    const [keys, opts] = indexNamed(Session, Session.ANNOUNCED_INDEX_NAME);
    expect(Session.ANNOUNCED_INDEX_NAME).toBe("session_announced_unique");
    expect(keys).toEqual({ announcedBy: 1, group: 1, day: 1, science: 1, lessonType: 1 });
    expect(Object.keys(keys)).toEqual(["announcedBy", "group", "day", "science", "lessonType"]);
    expect(opts).toMatchObject({ unique: true, partialFilterExpression: { status: "announced" } });
  });

  test("ro'yxat indekslari va jami soni (≤5)", () => {
    const names = Session.schema.indexes().map(([, o]) => o.name);
    expect(names).toEqual(["session_announced_unique", "day_desc", "group_day", "announcedBy_day"]);
  });
});

describe("freym indekslari (P9 kalitining jonli ko'zgusi)", () => {
  test("`session_resident_unique` — unique, partial {cancelledAt:null}", () => {
    const [keys, opts] = indexNamed(Roster, Roster.SESSION_RESIDENT_INDEX);
    expect(keys).toEqual({ session: 1, resident: 1 });
    expect(opts).toMatchObject({ unique: true, partialFilterExpression: { cancelledAt: null } });
  });

  test("`resident_lesson_live_unique` — kalit tartibi P9 bilan bir xil", () => {
    const [keys, opts] = indexNamed(Roster, Roster.LIVE_KEY_INDEX);
    expect(Object.keys(keys)).toEqual(["resident", "day", "science", "lessonType"]);
    expect(Object.values(keys)).toEqual([1, 1, 1, 1]);
    expect(opts).toMatchObject({ unique: true, partialFilterExpression: { cancelledAt: null } });
  });

  test("uchta nom; LIVE_FRAME — partial filtr bilan bir xil", () => {
    expect(Roster.schema.indexes().map(([, o]) => o.name)).toEqual([
      "session_resident_unique",
      "resident_lesson_live_unique",
      "resident_day",
    ]);
    expect(Roster.LIVE_FRAME).toEqual({ cancelledAt: null });
    expect(Object.isFrozen(Roster.LIVE_FRAME)).toBe(true);
  });
});

describe("enum'lar — yagona manba", () => {
  test("lessonType — attendance RESIDENCY_LESSON_TYPES (nusxa emas)", () => {
    expect(Session.schema.path("lessonType").enumValues).toEqual(RESIDENCY_LESSON_TYPES);
    expect(Roster.schema.path("lessonType").enumValues).toEqual(RESIDENCY_LESSON_TYPES);
  });

  test("ATTENDANCE_STATUSES tegilmagan — «o'lchanmagan» freymda", () => {
    expect(ATTENDANCE_STATUSES).toEqual(["present", "absent", "excused"]);
  });

  test("konstantalar", () => {
    expect(Session.SESSION_STATUSES).toEqual(["announced", "cancelled"]);
    expect([Session.SESSION_ANNOUNCED, Session.SESSION_CANCELLED]).toEqual(["announced", "cancelled"]);
    expect(Session.ROSTER_SCOPES).toEqual(["group", "supervised"]);
    expect([Session.SESSION_HOURS_MIN, Session.SESSION_HOURS_MAX]).toEqual([1, 8]);
    expect(Roster.FRAME_OUTCOMES).toEqual(["pending", "present", "absent", "unmeasured", "void"]);
    expect(Roster.schema.path("outcome").enumValues).toEqual(Roster.FRAME_OUTCOMES);
  });
});

describe("holat/natija — default YO'Q, har yozuvchi aniq beradi", () => {
  test("sessiya `status` siz — required xatosi", () => {
    const { status, ...rest } = sessionBase();
    expect(status).toBe("announced");
    expect(new Session(rest).validateSync().errors.status.kind).toBe("required");
    expect(new Session(sessionBase()).validateSync()).toBeUndefined();
  });

  test("freym `outcome` siz — required; `outcomeReason` erkin satr", () => {
    const { outcome, ...rest } = frameBase();
    expect(outcome).toBe("pending");
    expect(new Roster(rest).validateSync().errors.outcome.kind).toBe("required");
    expect(new Roster({ ...frameBase(), outcomeReason: "no_packet_x" }).validateSync()).toBeUndefined();
    expect(new Roster(frameBase()).toObject()).toMatchObject({ outcomeReason: null, attendance: null, resolvedAt: null, cancelledAt: null });
  });
});

describe("soat — butun son 1..8 (Q6=A)", () => {
  test.each([0, 9, 2.5])("%p — rad", (hours) => {
    expect(new Session({ ...sessionBase(), hours }).validateSync().errors.hours).toBeDefined();
    expect(new Roster({ ...frameBase(), hours }).validateSync()?.errors.hours).toBeDefined();
  });

  test.each([1, 8])("%p — ok", (hours) => {
    expect(new Session({ ...sessionBase(), hours }).validateSync()).toBeUndefined();
  });

  test("kun — satr shakli", () => {
    expect(new Session({ ...sessionBase(), day: "28.09.2026" }).validateSync().errors.day).toBeDefined();
  });
});

describe("o'zgarmaslik va soft-delete yo'qligi", () => {
  test("kalit maydonlari immutable", () => {
    for (const p of ["day", "group", "science", "lessonType", "hours", "announcedBy", "rosterScope"]) {
      expect(Session.schema.path(p).$immutable).toBe(true);
    }
    for (const p of ["session", "resident", "day", "science", "lessonType", "hours"]) {
      expect(Roster.schema.path(p).$immutable).toBe(true);
    }
    expect(Session.schema.path("status").$immutable).toBeFalsy();
    expect(Roster.schema.path("outcome").$immutable).toBeFalsy();
  });

  test("`deletedAt` yo'q (dalil hujjati, partial indeks band bo'lmasin)", () => {
    expect(Session.schema.path("deletedAt")).toBeUndefined();
    expect(Roster.schema.path("deletedAt")).toBeUndefined();
  });
});
