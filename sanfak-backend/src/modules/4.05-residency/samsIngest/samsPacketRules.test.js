"use strict";

const { assertPacket, assertWindow, assertEmittedAt } = require("./samsPacketRules");

const NOW = new Date("2026-09-27T05:00:00Z");
const at = (iso) => new Date(iso);
const dayEntry = (day) => ({ day });
const tenant = (days, records = []) => ({
  dbname: "clinicA",
  days: days.map(dayEntry),
  people: [{ jshshir: "12345678901234", records }],
});
const packet = (over = {}) => ({
  window: { from: "2026-09-26", to: "2026-09-27" },
  emittedAt: NOW,
  tenants: [tenant(["2026-09-26", "2026-09-27"], [{ date: "2026-09-27" }])],
  ...over,
});
const reasonOf = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    expect(err.statusCode).toBe(400);
    return err.meta.reason;
  }
};

describe("oyna", () => {
  const win = (from, to, now = NOW) => reasonOf(() => assertWindow({ from, to }, now));

  it("to'g'ri oyna va bir kunlik tik — o'tadi", () => {
    expect(win("2026-09-21", "2026-09-27")).toBeNull();
    expect(win("2026-09-27", "2026-09-27")).toBeNull();
  });

  it("from > to → window_invalid", () => {
    expect(win("2026-09-27", "2026-09-26")).toBe("window_invalid");
  });

  it("32 kun → window_too_long; 31 kun (bugun-30..bugun) — o'tadi", () => {
    expect(win("2026-08-27", "2026-09-27")).toBe("window_too_long");
    expect(win("2026-08-28", "2026-09-27")).toBeNull();
  });

  it("from = bugun-31 → window_too_old", () => {
    expect(win("2026-08-27", "2026-08-27")).toBe("window_too_old");
  });

  it("ertangi kun: 23:56 UZ da (+5 daqiqa) o'tadi, 23:54 da va peshinda — window_in_future", () => {
    expect(win("2026-09-28", "2026-09-28", at("2026-09-27T18:56:00Z"))).toBeNull();
    expect(win("2026-09-28", "2026-09-28", at("2026-09-27T18:54:00Z"))).toBe("window_in_future");
    expect(win("2026-09-28", "2026-09-28", at("2026-09-27T07:00:00Z"))).toBe("window_in_future");
  });
});

describe("emittedAt — [now−31 kun, now+5 daqiqa]", () => {
  const emit = (iso) => reasonOf(() => assertEmittedAt(at(iso), NOW));

  it("chegaralar ichida — o'tadi", () => {
    expect(emit("2026-09-27T05:05:00Z")).toBeNull();
    expect(emit("2026-08-27T05:00:00Z")).toBeNull();
  });

  it("now+6 daqiqa va 31 kundan eski → emitted_at_out_of_range", () => {
    expect(emit("2026-09-27T05:06:00Z")).toBe("emitted_at_out_of_range");
    expect(emit("2026-08-27T04:59:59.999Z")).toBe("emitted_at_out_of_range");
  });
});

describe("tenant kunlari va yozuv sanalari", () => {
  it("to'g'ri paket — o'tadi", () => {
    expect(reasonOf(() => assertPacket(packet(), NOW))).toBeNull();
  });

  it("tenantda bitta kun yetishmaydi → tenant_days_mismatch (tafsilot — dbname)", () => {
    let err;
    try {
      assertPacket(packet({ tenants: [tenant(["2026-09-27"])] }), NOW);
    } catch (e) {
      err = e;
    }
    expect(err.meta.reason).toBe("tenant_days_mismatch");
    expect(err.detail).toBe("clinicA");
  });

  it("oynadan tashqari kun (soni teng) → tenant_days_mismatch", () => {
    const p = packet({ tenants: [tenant(["2026-09-25", "2026-09-27"])] });
    expect(reasonOf(() => assertPacket(p, NOW))).toBe("tenant_days_mismatch");
  });

  it("kunlar tartibsiz kelishi mumkin", () => {
    const p = packet({ tenants: [tenant(["2026-09-27", "2026-09-26"])] });
    expect(reasonOf(() => assertPacket(p, NOW))).toBeNull();
  });

  it("yozuv sanasi oynadan tashqarida → record_out_of_window (jshshir tafsilotda YO'Q)", () => {
    const p = packet({ tenants: [tenant(["2026-09-26", "2026-09-27"], [{ date: "2026-09-25" }])] });
    let err;
    try {
      assertPacket(p, NOW);
    } catch (e) {
      err = e;
    }
    expect(err.meta.reason).toBe("record_out_of_window");
    expect(JSON.stringify(err)).not.toContain("12345678901234");
  });

  it("tartib: oyna xatosi tenant xatosidan OLDIN", () => {
    const p = packet({ window: { from: "2026-09-27", to: "2026-09-26" }, tenants: [tenant([])] });
    expect(reasonOf(() => assertPacket(p, NOW))).toBe("window_invalid");
  });
});
