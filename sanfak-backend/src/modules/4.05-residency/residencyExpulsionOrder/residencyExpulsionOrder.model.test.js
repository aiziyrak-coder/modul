"use strict";

const mongoose = require("mongoose");
const Order = require("./residencyExpulsionOrder.model");

const base = {
  resident: new mongoose.Types.ObjectId(),
  origin: "tizim",
  status: "loyiha",
  countingYear: "2026/2027",
  draftedAt: new Date("2026-10-01T08:00:00Z"),
};

describe("enum'lar — faqat qo'shimcha", () => {
  test("holatlar va konstantalar", () => {
    expect(Order.EXPULSION_ORDER_STATUSES).toEqual([
      "loyiha",
      "imzolangan",
      "bekor_qilingan",
      "rad_etilgan",
    ]);
    expect([Order.ORDER_OPEN, Order.ORDER_SIGNED, Order.ORDER_REJECTED]).toEqual([
      "loyiha",
      "imzolangan",
      "rad_etilgan",
    ]);
  });

  test("P6a-1 qiymatlari saqlangan, P6a-2 qiymatlari qo'shilgan", () => {
    expect(Order.CLOSE_REASONS).toEqual(
      expect.arrayContaining(["soat_72_dan_past", "rezident_ochirildi", "imzolangan_buyruq_bor"]),
    );
    expect(Order.HISTORY_ACTIONS).toEqual(
      expect.arrayContaining(["yaratildi", "bekor_qilindi", "skan_yuklandi", "imzolandi", "rad_etildi", "asos_72_dan_past"]),
    );
  });

  test("buyruq tarixi manbalari — AYNAN shu ro'yxat (FE yorliqlari bilan bog'liq)", () => {
    expect(Order.HISTORY_SOURCES).toEqual([
      "attendance", "cron", "application", "resident_delete", "migration", "office", "runbook", "sams",
    ]);
  });
});

describe("yangi maydonlar", () => {
  test("hammasi `null` (deliveries — uchta `null`)", () => {
    const doc = new Order(base).toObject();
    for (const key of [
      "paperOrderNumber", "paperOrderDate", "scan", "signedAt", "signedBy", "signedByName",
      "hoursAtSign", "eriSerialNumber", "eriSubject", "eriSignedAt", "closeNote",
      "residentAppliedAt", "basisLostAt", "hoursAtBasisLost", "draftPdf", "remindedStage",
    ]) {
      expect(doc[key]).toBeNull();
    }
    expect(doc.deliveries).toEqual({ signed: null, rejected: null, basisLost: null });
  });

  test("qog'oz sanasi SATR bo'lib qoladi", () => {
    const doc = new Order({ ...base, paperOrderDate: "2026-10-02" });
    expect(doc.paperOrderDate).toBe("2026-10-02");
    expect(Order.schema.path("paperOrderDate").instance).toBe("String");
  });

  test("skan: `storageKey`, tur, hajm, sha256 MAJBURIY", () => {
    const doc = new Order({ ...base, scan: { fileName: "a.pdf" } });
    const err = doc.validateSync();
    expect(Object.keys(err.errors)).toEqual(
      expect.arrayContaining(["scan.storageKey", "scan.mimeType", "scan.size", "scan.sha256", "scan.uploadedAt"]),
    );
  });
});

describe("loyiha PDF'i (P6a-3)", () => {
  test("metama'lumot MAJBURIY, muallif ixtiyoriy", () => {
    const err = new Order({ ...base, draftPdf: { generatedBy: null } }).validateSync();
    expect(Object.keys(err.errors).sort()).toEqual(
      [
        "draftPdf.fileName", "draftPdf.generatedAt", "draftPdf.hours", "draftPdf.sha256",
        "draftPdf.size", "draftPdf.storageKey", "draftPdf.templateVersion",
      ].sort(),
    );
  });

  test("tarix yozuvi `pdf_yaratildi` — oxirida qo'shilgan", () => {
    expect(Order.HISTORY_ACTIONS.at(-1)).toBe("pdf_yaratildi");
    expect(Order.HISTORY_ACTIONS).toHaveLength(8);
  });
});

test("bo'lim ro'yxati uchun paginate plagini va indeks", () => {
  expect(typeof Order.paginate).toBe("function");
  const names = Order.schema.indexes().map(([, o]) => o.name);
  expect(names).toEqual(expect.arrayContaining(["resident_open_unique", "status_draftedAt"]));
});
