"use strict";

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { rowStatuses, rosterEvidence } = require("./residencySessionRosterView");

afterEach(() => jest.restoreAllMocks());

describe("rosterEvidence", () => {
  test.each([
    ["present + present qator — baho mumkin", ["present", "present"], ["present", null]],
    ["present, qator yo'q (qo'lda dars bor)", ["present", undefined], ["present", "row_missing"]],
    ["absent + absent qator", ["absent", "absent"], ["absent", "not_confirmed"]],
    ["absent + excused qator — excused", ["absent", "excused"], ["excused", "not_confirmed"]],
    ["unmeasured", ["unmeasured", undefined], ["unmeasured", "not_confirmed"]],
    ["pending", ["pending", undefined], ["pending", "not_confirmed"]],
  ])("%s", (_label, [outcome, rowStatus], [state, blocked]) => {
    expect(rosterEvidence({ outcome }, rowStatus)).toMatchObject({ state, scoreBlockedReason: blocked });
  });

  test.each(["absent", "unmeasured", "pending"])("natija %s — freymda eski baho bo'lsa ham score null", (outcome) => {
    expect(rosterEvidence({ outcome, score: 8, samsFirstIn: "09:05" }, outcome === "absent" ? "absent" : undefined)).toMatchObject({
      state: outcome, score: null, checkInTime: "09:05", scoreBlockedReason: "not_confirmed",
    });
  });

  test.each([
    ["present + present qator", ["present", "present"]],
    ["present, qator yo'q", ["present", undefined]],
    ["absent + excused qator", ["absent", "excused"]],
    ["unmeasured", ["unmeasured", undefined]],
    ["pending", ["pending", undefined]],
  ])("amaliy sessiya, %s — lesson_type_not_graded", (_label, [outcome, rowStatus]) => {
    expect(rosterEvidence({ outcome }, rowStatus, "amaliy")).toMatchObject({ scoreBlockedReason: "lesson_type_not_graded" });
  });

  test.each(["maruza", "test", "oraliq_nazorat", "yakuniy_nazorat"])("%s sessiyasi — avvalgidek (present + present qator → null)", (lessonType) => {
    expect(rosterEvidence({ outcome: "present" }, "present", lessonType).scoreBlockedReason).toBeNull();
    expect(rosterEvidence({ outcome: "absent" }, "absent", lessonType).scoreBlockedReason).toBe("not_confirmed");
  });

  test("baho va xom SAMS vaqtlari", () => {
    expect(rosterEvidence({ outcome: "present", score: 9, samsFirstIn: "09:05", samsLastOut: null }, "present")).toEqual({
      state: "present", score: 9, checkInTime: "09:05", checkOutTime: null, scoreBlockedReason: null,
    });
  });
});

describe("rowStatuses", () => {
  test("havolasiz freymlar — so'rov yo'q", async () => {
    const find = jest.spyOn(Attendance, "find");
    expect((await rowStatuses([{ attendance: null }])).size).toBe(0);
    expect(find).not.toHaveBeenCalled();
  });

  test("bitta so'rov, id → status", async () => {
    const lean = jest.fn().mockResolvedValue([{ _id: "a1", status: "excused" }]);
    const find = jest.spyOn(Attendance, "find").mockReturnValue({ select: () => ({ lean }) });
    const map = await rowStatuses([{ attendance: "a1" }, { attendance: null }, { attendance: "a2" }]);
    expect(find).toHaveBeenCalledWith({ _id: { $in: ["a1", "a2"] } });
    expect(map.get("a1")).toBe("excused");
    expect(map.get("a2")).toBeUndefined();
  });
});

test("dars turi qoidasi qayta eksport — aynan o'sha havolalar", () => {
  const view = require("./residencySessionRosterView");
  const source = require("#modules/4.05-residency/_services/lessonTypeGrading");
  expect(view.UNGRADED_LESSON_TYPES).toBe(source.UNGRADED_LESSON_TYPES);
  expect(view.LESSON_TYPE_NOT_GRADED).toBe(source.LESSON_TYPE_NOT_GRADED);
  expect(view.isGradedLessonType).toBe(source.isGradedLessonType);
});
