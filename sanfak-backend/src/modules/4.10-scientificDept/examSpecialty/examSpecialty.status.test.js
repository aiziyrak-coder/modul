const { isRegistrationOpen, effectiveStatus, endOfDay } = require("./examSpecialty.status");

const NOW = new Date("2026-08-24T10:00:00Z");
const spec = (o) => ({ status: "open", active: true, regStart: null, regEnd: null, ...o });

describe("examSpecialty.status — isRegistrationOpen", () => {
  it("ochiq + oynasiz → qabul qilinadi", () => {
    expect(isRegistrationOpen(spec(), NOW)).toBe(true);
  });

  it("qo'lda yopilgan → qabul qilinmaydi", () => {
    expect(isRegistrationOpen(spec({ status: "closed" }), NOW)).toBe(false);
  });

  it("o'chirilgan (active:false) → qabul qilinmaydi", () => {
    expect(isRegistrationOpen(spec({ active: false }), NOW)).toBe(false);
  });

  it("regEnd o'tib ketgan → qabul qilinmaydi (asosiy holat)", () => {
    expect(isRegistrationOpen(spec({ regStart: "2026-07-01", regEnd: "2026-07-20" }), NOW)).toBe(false);
  });

  it("regEnd bugun → oxirgi kun ichida qabul qilinadi", () => {
    expect(isRegistrationOpen(spec({ regEnd: "2026-08-24" }), NOW)).toBe(true);
  });

  it("regStart hali kelmagan → qabul qilinmaydi", () => {
    expect(isRegistrationOpen(spec({ regStart: "2026-09-01", regEnd: "2026-09-30" }), NOW)).toBe(false);
  });

  it("spec yo'q → false (yiqilmaydi)", () => {
    expect(isRegistrationOpen(null, NOW)).toBe(false);
  });
});

describe("examSpecialty.status — effectiveStatus", () => {
  it("ochiq + oyna ichida → open", () => {
    expect(effectiveStatus(spec({ regStart: "2026-08-01", regEnd: "2026-08-31" }), NOW)).toBe("open");
  });

  it("regEnd o'tgan → expired (status open bo'lsa ham)", () => {
    expect(effectiveStatus(spec({ regStart: "2026-07-01", regEnd: "2026-07-20" }), NOW)).toBe("expired");
  });

  it("regStart kelmagan → upcoming", () => {
    expect(effectiveStatus(spec({ regStart: "2026-09-01", regEnd: "2026-09-30" }), NOW)).toBe("upcoming");
  });

  it("qo'lda yopilgan → closed", () => {
    expect(effectiveStatus(spec({ status: "closed" }), NOW)).toBe("closed");
  });

  it("o'chirilgan → closed", () => {
    expect(effectiveStatus(spec({ active: false }), NOW)).toBe("closed");
  });
});

describe("examSpecialty.status — endOfDay", () => {
  it("kun oxiriga surади (23:59:59.999 UTC)", () => {
    const e = endOfDay("2026-07-20");
    expect(e.getUTCHours()).toBe(23);
    expect(e.getUTCMinutes()).toBe(59);
  });
});
