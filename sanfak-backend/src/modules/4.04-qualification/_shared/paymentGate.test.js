const { addWorkingDays, endOfDay, REQUIRED_SHARE, WORKING_DAYS } = require("./paymentGate");

describe("paymentGate — ish kunlari hisobi", () => {
  it("shartlar TZ bo'yicha: 10 ish kuni, 50%", () => {
    expect(WORKING_DAYS).toBe(10);
    expect(REQUIRED_SHARE).toBe(0.5);
  });

  it("dam olish kunlari o'tkazib yuboriladi", () => {
    const due = addWorkingDays(new Date("2026-08-19T10:00:00"), 10);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth() + 1).toBe(9);
    expect(due.getDate()).toBe(2);
  });

  it("juma + 1 ish kuni = dushanba (shanba/yakshanba sanalmaydi)", () => {
    const friday = new Date("2026-08-21T10:00:00");
    expect(friday.getDay()).toBe(5);
    const next = addWorkingDays(friday, 1);
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(24);
  });

  it("shanbadan boshlansa ham keyingi ish kuniga suriladi", () => {
    const saturday = new Date("2026-08-22T10:00:00");
    expect(saturday.getDay()).toBe(6);
    const next = addWorkingDays(saturday, 1);
    expect(next.getDay()).toBe(1);
  });

  it("natija hech qachon dam olish kuniga tushmaydi", () => {
    for (let start = 17; start <= 23; start += 1) {
      const due = addWorkingDays(new Date(`2026-08-${start}T10:00:00`), 10);
      expect([0, 6]).not.toContain(due.getDay());
    }
  });

  it("muddat kunning OXIRIgacha hisoblanadi", () => {
    const d = endOfDay(new Date("2026-09-02T00:00:01"));
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(new Date("2026-09-02T22:00:00") > d).toBe(false);
    expect(new Date("2026-09-03T00:00:01") > d).toBe(true);
  });
});
