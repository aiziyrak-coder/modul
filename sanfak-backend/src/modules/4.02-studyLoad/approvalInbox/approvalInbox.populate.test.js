const mongoose = require("mongoose");

require("./approvalInbox.controller");

describe("approvalInbox — populate uchun modellar ro'yxatdan o'tgan bo'lsin", () => {
  test("`academicYear` modeli ro'yxatdan o'tgan", () => {
    expect(mongoose.models.academicYear).toBeDefined();
  });

  test("`department` modeli ro'yxatdan o'tgan", () => {
    expect(mongoose.models.department).toBeDefined();
  });

  test("populate chaqirilayotgan har bir yo'l uchun model bor", () => {
    const POPULATED_MODELS = ["department", "academicYear", "direction"];
    const missing = POPULATED_MODELS.filter((m) => !mongoose.models[m]);

    expect(missing).toEqual([]);
  });
});
