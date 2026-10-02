const { achievementQuerySchema } = require("./achievement.validation");
const { monographQuerySchema } = require("../monograph/monograph.validation");
const {
  methodicalQuerySchema,
} = require("../methodicalRecommendation/methodicalRecommendation.validation");

const HEX = "6a98017bb99e1864e90a5703";

describe.each([
  ["achievementQuerySchema (5 yutuq entity)", achievementQuerySchema],
  ["monographQuerySchema", monographQuerySchema],
  ["methodicalQuerySchema", methodicalQuerySchema],
])("F-46-BE %s — ?author=", (_name, schema) => {
  it("24-hex ObjectId qabul qilinadi", () => {
    const { error, value } = schema.validate({ author: HEX });
    expect(error).toBeUndefined();
    expect(value.author).toBe(HEX);
  });

  it("hex bo'lmagan qiymat rad etiladi (Mongo operator injection yopiq)", () => {
    const { error } = schema.validate({ author: "not-an-id" });
    expect(error).toBeDefined();
  });

  it("bo'sh satr xavfsiz (D-014 optionalString) — filtr qo'shilmaydi", () => {
    const { error } = schema.validate({ author: "" });
    expect(error).toBeUndefined();
  });
});
