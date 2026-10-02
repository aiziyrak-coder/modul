"use strict";

const ID = "6a5a0acbd34b3c21a575d5c8";

jest.mock("#references/academicYear/academicYear.model", () => ({
  find: jest.fn(() => ({
    select: () => ({
      lean: async () => [{ _id: ID, title: "2025/2026" }],
    }),
  })),
  findById: jest.fn((id) => ({
    select: () => ({
      lean: async () => (String(id) === ID ? { _id: ID, title: "2025/2026" } : null),
    }),
  })),
}));

const plugin = require("./academicYearRefPlugin");

beforeEach(() => plugin.clearCache());

describe("normalizeInput", () => {
  it("TIRE bilan kelgan titulni ma'lumotnoma imlosiga keltiradi", async () => {
    await expect(plugin.normalizeInput("2025-2026")).resolves.toEqual({
      title: "2025/2026",
      ref: ID,
    });
  });

  it("kanonik titul o'zgarishsiz qoladi", async () => {
    await expect(plugin.normalizeInput("2025/2026")).resolves.toEqual({
      title: "2025/2026",
      ref: ID,
    });
  });

  it("`_id` kelsa titul ma'lumotnomadan olinadi", async () => {
    await expect(plugin.normalizeInput(ID)).resolves.toEqual({
      title: "2025/2026",
      ref: ID,
    });
  });

  it("ma'lumotnomada yo'q titul TEGILMAYDI (ref bo'sh qoladi)", async () => {
    await expect(plugin.normalizeInput("2099-2100")).resolves.toEqual({
      title: "2099-2100",
      ref: null,
    });
  });

  it("noma'lum `_id` da qiymat UMUMAN o'zgartirilmaydi", async () => {
    await expect(plugin.normalizeInput("6a5a0acbd34b3c21a575d5ff")).resolves.toBeNull();
  });

  it.each([null, undefined, ""])("bo'sh qiymat (%p) ref siz qaytadi", async (v) => {
    await expect(plugin.normalizeInput(v)).resolves.toEqual({
      title: v ?? null,
      ref: null,
    });
  });
});
