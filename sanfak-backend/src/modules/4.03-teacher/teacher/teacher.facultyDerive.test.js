jest.mock("#references/department/department.model", () => ({}), {
  virtual: true,
});

const mongoose = require("mongoose");

const DEPT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const FACULTY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const OTHER_FACULTY = "cccccccccccccccccccccccc";

beforeAll(() => {
  if (!mongoose.models.department) {
    mongoose.model("department", new mongoose.Schema({ faculty: String }));
  }
  mongoose.models.department.findById = jest.fn(() => ({
    select: () => ({
      lean: () => Promise.resolve({ faculty: FACULTY_ID }),
    }),
  }));
});

const TeacherProfile = require("./teacher.model");

const getPreUpdateHook = () => {
  const pres = TeacherProfile.schema.s.hooks._pres.get("findOneAndUpdate");
  const entry = pres.find((p) => p.fn && p.fn.name === "preUpdate");
  if (!entry) throw new Error("preUpdate hook topilmadi");
  return entry.fn;
};

const runHook = async (update) => {
  const fn = getPreUpdateHook();
  const ctx = {
    getUpdate: () => update,
    setUpdate: (u) => {
      update = u;
    },
  };
  await new Promise((resolve, reject) => {
    fn.call(ctx, (err) => (err ? reject(err) : resolve()));
  });
  return update;
};

const readFaculty = (u) => u.$set?.faculty ?? u.faculty;

describe("teacherProfile — findOneAndUpdate: faculty qayta hisoblanishi (D16)", () => {
  test("REAL CONTROLLER SHAKLI: top-level department + timestamps $set — faculty YOZILADI", async () => {
    const result = await runHook({
      department: DEPT_ID,
      hrApprovalStatus: "approved",
      $set: { updatedAt: new Date() },
    });

    expect(String(readFaculty(result))).toBe(FACULTY_ID);
  });

  test("$set ichidagi department — faculty ham $set ichiga yoziladi", async () => {
    const result = await runHook({
      $set: { department: DEPT_ID, updatedAt: new Date() },
    });

    expect(String(result.$set.faculty)).toBe(FACULTY_ID);
    expect(result.faculty).toBeUndefined();
  });

  test("timestamps'siz sof top-level — faculty top-level yoziladi", async () => {
    const result = await runHook({ department: DEPT_ID });

    expect(String(result.faculty)).toBe(FACULTY_ID);
  });

  test("faculty ANIQ berilgan bo'lsa — ustidan yozilmaydi", async () => {
    const result = await runHook({
      department: DEPT_ID,
      faculty: OTHER_FACULTY,
      $set: { updatedAt: new Date() },
    });

    expect(String(result.faculty)).toBe(OTHER_FACULTY);
  });

  test("department tegilmasa — faculty umuman qo'shilmaydi", async () => {
    const result = await runHook({
      hrApprovalStatus: "approved",
      $set: { updatedAt: new Date() },
    });

    expect(readFaculty(result)).toBeUndefined();
  });

  test("hook tartibi: mongoose timestamps hooki BIZNIKIDAN OLDIN turadi", () => {
    const pres = TeacherProfile.schema.s.hooks._pres.get("findOneAndUpdate");
    const names = pres.map((p) => p.fn && p.fn.name);

    expect(names.indexOf("_setTimestampsOnUpdate")).toBeLessThan(
      names.indexOf("preUpdate"),
    );
  });
});
