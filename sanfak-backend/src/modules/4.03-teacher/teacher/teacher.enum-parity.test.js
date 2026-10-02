const TeacherProfile = require("./teacher.model");
const {
  createProfileSchema,
  updateProfileSchema,
} = require("./teacher.validation");

function modelEnums() {
  const out = {};
  TeacherProfile.schema.eachPath((path, type) => {
    const values = (type.enumValues || []).filter((v) => v !== null);
    if (values.length) out[path] = values;
  });
  return out;
}

function joiEnums(schema) {
  const { keys = {} } = schema.describe();
  const out = {};
  for (const [key, desc] of Object.entries(keys)) {
    if (desc?.flags?.only && Array.isArray(desc.allow)) {
      out[key] = desc.allow.filter((v) => v !== null && v !== "");
    }
  }
  return out;
}

const MODEL_ENUMS = modelEnums();

describe("teacher.validation ↔ teacher.model enum parity", () => {
  it("modelda kamida bitta enum maydon bor (test o'zi bo'shab qolmasin)", () => {
    expect(Object.keys(MODEL_ENUMS).length).toBeGreaterThan(0);
  });

  describe.each([
    ["createProfileSchema", createProfileSchema],
    ["updateProfileSchema", updateProfileSchema],
  ])("%s", (_name, schema) => {
    const constrained = joiEnums(schema);

    for (const [field, values] of Object.entries(constrained)) {
      if (!MODEL_ENUMS[field]) continue;

      it(`${field}: Joi va model qiymatlari aynan bir xil`, () => {
        expect([...values].sort()).toEqual([...MODEL_ENUMS[field]].sort());
      });
    }

    const declared = new Set(Object.keys(schema.describe().keys || {}));
    const requiresUser = declared.has("user");

    for (const [field, values] of Object.entries(MODEL_ENUMS)) {
      if (!declared.has(field)) continue;

      it(`${field}: modeldagi barcha qiymatlarni Joi qabul qiladi`, () => {
        const rejected = values.filter((v) => {
          const payload = requiresUser
            ? { user: "a".repeat(24), [field]: v }
            : { [field]: v };
          return schema.validate(payload, { allowUnknown: false }).error;
        });
        expect(rejected).toEqual([]);
      });
    }
  });
});
