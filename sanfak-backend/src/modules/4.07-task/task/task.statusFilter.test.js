const { buildFilter } = require("./task.service");
const V = require("./task.validation");

const statusClause = (filter) =>
  (filter.$and || []).find((c) => c.status || (c.$or || []).some((o) => o.status));

describe("buildFilter — bitta status (xulq o'zgarmagan)", () => {
  test("terminal status → muddat cheklovisiz", () => {
    const f = buildFilter({}, { status: "completed" });
    expect(statusClause(f)).toEqual({ status: { $in: ["completed"] } });
  });

  test("non-terminal status → muddati o'tganlar chiqariladi", () => {
    const c = statusClause(buildFilter({}, { status: "new" }));
    expect(c.status).toEqual({ $in: ["new"] });
    expect(c.$or[0]).toEqual({ deadline: null });
    expect(c.$or[1].deadline.$gte).toBeInstanceOf(Date);
  });

  test("`overdue` — alohida yo'l: terminal emas + muddat o'tgan", () => {
    const f = buildFilter({}, { status: "overdue" });
    expect(f.status.$nin).toEqual(["completed", "rejected", "not_needed"]);
    expect(f.deadline.$lt).toBeInstanceOf(Date);
  });

  test("status yo'q → status bandi umuman qo'shilmaydi", () => {
    const f = buildFilter({}, {});
    expect(f.$and).toBeUndefined();
    expect(f.status).toBeUndefined();
  });
});

describe("buildFilter — ko'p status (doska ustuni)", () => {
  test("`completed,not_needed` → bitta $in, muddat cheklovisiz", () => {
    const c = statusClause(buildFilter({}, { status: "completed,not_needed" }));
    expect(c).toEqual({ status: { $in: ["completed", "not_needed"] } });
  });

  test("faqat non-terminallar → hammasiga muddat cheklovi", () => {
    const c = statusClause(buildFilter({}, { status: "new,in_progress" }));
    expect(c.status).toEqual({ $in: ["new", "in_progress"] });
    expect(c.$or).toHaveLength(2);
  });

  test("aralash (`completed,new`) → terminal shox cheklovsiz, faol shox cheklangan", () => {
    const c = statusClause(buildFilter({}, { status: "completed,new" }));
    expect(c.$or).toHaveLength(2);
    const terminal = c.$or.find((o) => o.status.$in.includes("completed"));
    const active = c.$or.find((o) => o.status.$in.includes("new"));
    expect(terminal).toEqual({ status: { $in: ["completed"] } });
    expect(active.$or).toBeDefined();
  });

  test("bo'shliqlar va bo'sh elementlar tozalanadi", () => {
    const c = statusClause(buildFilter({}, { status: " completed , , not_needed " }));
    expect(c).toEqual({ status: { $in: ["completed", "not_needed"] } });
  });

  test("qidiruv bilan birga — ikkalasi ham saqlanadi", () => {
    const f = buildFilter({}, { search: "hisobot", status: "completed,not_needed" });
    expect(f.$or.some((o) => o.title)).toBe(true);
    expect(statusClause(f)).toEqual({ status: { $in: ["completed", "not_needed"] } });
  });

  test("doira $or + qidiruv + status — uchchovi ham saqlanadi", () => {
    const scope = { $or: [{ createdBy: "u1" }, { assignee: "u1" }] };
    const f = buildFilter(scope, { search: "hisobot", status: "new" });
    expect(f.$or).toBeUndefined();
    expect(f.$and.some((c) => (c.$or || []).some((o) => o.createdBy))).toBe(true);
    expect(f.$and.some((c) => (c.$or || []).some((o) => o.title))).toBe(true);
    expect(statusClause(f)).toBeDefined();
  });
});

describe("statusFilter validatori", () => {
  const check = (status) => V.findAll.validate({ status });

  test("bitta yaroqli qiymat qabul qilinadi", () => {
    expect(check("completed").error).toBeUndefined();
    expect(check("overdue").error).toBeUndefined();
  });

  test("vergulli ro'yxat qabul qilinadi", () => {
    expect(check("completed,not_needed").error).toBeUndefined();
    expect(check(" new , in_progress ").error).toBeUndefined();
  });

  test("noma'lum status rad etiladi", () => {
    expect(check("completed,yoq_status").error).toBeDefined();
    expect(check("salom").error).toBeDefined();
  });

  test("`overdue` boshqa status bilan birlashtirilmaydi", () => {
    expect(check("new,overdue").error).toBeDefined();
    expect(check("overdue,completed").error).toBeDefined();
  });

  test("bo'sh/vergulgina rad etiladi", () => {
    expect(check(",").error).toBeDefined();
  });
});
