const mongoose = require("mongoose");
const Patent = require("./patent.model");

describe("patent.model", () => {
  const base = () => ({
    author: new mongoose.Types.ObjectId(),
    title: "Yangi diagnostika qurilmasi",
    registrationNumber: "FAP 01829",
    academicYear: "2025/2026",
  });

  it("turisiz patent yaratilishi mumkin", () => {
    const err = new Patent(base()).validateSync();
    expect(err).toBeUndefined();
  });

  it("to'g'ri turi bilan ham o'tadi (eski yozuvlar saqlanadi)", () => {
    const err = new Patent({ ...base(), patentType: "invention" }).validateSync();
    expect(err).toBeUndefined();
  });

  it("noto'g'ri turi rad etiladi (enum kuchda qoladi)", () => {
    const err = new Patent({ ...base(), patentType: "trademark" }).validateSync();
    expect(err).toBeDefined();
    expect(err.errors).toHaveProperty("patentType");
  });

  it("ishlanma nomi hamon majburiy", () => {
    const { title, ...noTitle } = base();
    const err = new Patent(noTitle).validateSync();
    expect(err).toBeDefined();
    expect(err.errors).toHaveProperty("title");
  });
});
