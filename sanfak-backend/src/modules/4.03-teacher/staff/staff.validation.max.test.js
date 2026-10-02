const { describe, test, expect } = require("@jest/globals");
const validation = require("./staff.validation");

const schema = validation.updateStaffSchema || validation.updateSchema || validation.update;

const base = {};

describe("staff.validation — teachingSpecialty uzunlik chegaralari", () => {
  const validate = (patch) => {
    const s = schema || Object.values(validation).find((v) => v && typeof v.validate === "function");
    return s.validate({ ...base, ...patch }, { allowUnknown: true, abortEarly: false });
  };

  test("Note 2000 belgigacha — qabul", () => {
    const { error } = validate({ teachingSpecialtyNote: "a".repeat(2000) });
    const noteErr = error && error.details.find((d) => d.path.includes("teachingSpecialtyNote"));
    expect(noteErr).toBeUndefined();
  });

  test("Note 50k belgi — RAD (ilgari qabul qilinardi)", () => {
    const { error } = validate({ teachingSpecialtyNote: "a".repeat(50000) });
    const noteErr = error && error.details.find((d) => d.path.includes("teachingSpecialtyNote"));
    expect(noteErr).toBeDefined();
  });

  test("Name 50k belgi — RAD", () => {
    const { error } = validate({ teachingSpecialtyName: "a".repeat(50000) });
    const nameErr = error && error.details.find((d) => d.path.includes("teachingSpecialtyName"));
    expect(nameErr).toBeDefined();
  });
});
