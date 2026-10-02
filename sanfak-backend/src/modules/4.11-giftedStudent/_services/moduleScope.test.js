const { translateScope, SCOPE_FIELD_MAP, advisorScope, ADVISOR } = require("./moduleScope");
const { roleMatches } = require("./roleEligibility");
const GiftedStudentModel = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");

const FACULTY_ID = "69df7a8f94bda50c83a1d435";
const USER_ID = "6a44f15063c031f0012da696";

describe("translateScope — scope kaliti modul maydoniga o'giriladi", () => {
  test("`faculty` (shared kaliti) -> `facultyId` (modul ref maydoni)", () => {
    expect(translateScope({ faculty: FACULTY_ID })).toEqual({ facultyId: FACULTY_ID });
  });

  test("aynan SHU nuqson: sarlavha maydoni `faculty` ga YOZILMAYDI", () => {
    const out = translateScope({ faculty: FACULTY_ID });
    expect(out.faculty).toBeUndefined();
  });

  test("`user` o'zgarmaydi — modelda to'g'ridan-to'g'ri ObjectId ref", () => {
    expect(translateScope({ user: USER_ID })).toEqual({ user: USER_ID });
  });

  test("bo'sh scope (bypass qilgan rol) bo'sh qoladi", () => {
    expect(translateScope({})).toEqual({});
    expect(translateScope(undefined)).toEqual({});
    expect(translateScope(null)).toEqual({});
  });

  test("`department` — modul kafedrani saqlamaydi -> 403, bo'sh ro'yxat EMAS", () => {
    expect(() => translateScope({ department: "6a87517ac85fefe47122aa0f" })).toThrow(
      /department/,
    );
    try {
      translateScope({ department: "6a87517ac85fefe47122aa0f" });
    } catch (e) {
      expect(e.statusCode).toBe(403);
    }
  });

  test("noma'lum kalit jimgina tashlanmaydi — xato beriladi", () => {
    expect(() => translateScope({ region: "x" })).toThrow(/region/);
  });

  test("bir nechta kalit birga o'giriladi", () => {
    expect(translateScope({ faculty: FACULTY_ID, user: USER_ID })).toEqual({
      facultyId: FACULTY_ID,
      user: USER_ID,
    });
  });
});

describe("SCOPE_FIELD_MAP haqiqiy sxemaga bog'langan", () => {
  test("har bir maqsad maydon giftedStudent sxemasida MAVJUD", () => {
    for (const field of Object.values(SCOPE_FIELD_MAP)) {
      expect(GiftedStudentModel.schema.path(field)).toBeDefined();
    }
  });

  test("`facultyId` — ObjectId ref, `faculty` esa String snapshot", () => {
    expect(GiftedStudentModel.schema.path("facultyId").instance).toBe("ObjectId");
    expect(GiftedStudentModel.schema.path("faculty").instance).toBe("String");
  });

  test("scope hech qachon String snapshot maydoniga yo'naltirilmaydi", () => {
    const SNAPSHOT_FIELDS = ["faculty", "direction", "group"];
    for (const field of Object.values(SCOPE_FIELD_MAP)) {
      expect(SNAPSHOT_FIELDS).not.toContain(field);
    }
  });
});

describe("advisorScope — maslahatchi EGALIK bo'yicha doiralanadi", () => {
  test("`{ advisorId: String(_id) }` qaytaradi — fakultet EMAS", () => {
    const out = advisorScope({ _id: USER_ID });
    expect(out).toEqual({ advisorId: USER_ID });
    expect(out.facultyId).toBeUndefined();
    expect(out.faculty).toBeUndefined();
  });

  test("ObjectId ham satrga keltiriladi (model maydoni String)", () => {
    const oid = { toString: () => USER_ID };
    expect(advisorScope({ _id: oid })).toEqual({ advisorId: USER_ID });
    expect(typeof advisorScope({ _id: oid }).advisorId).toBe("string");
  });
});

describe("ADVISOR profili — kim maslahatchi sanaladi", () => {
  const role = (perms) => ({
    permissions: Object.entries(perms).map(([section, actionKeys]) => ({ section, actionKeys })),
  });
  const isAdvisor = (r) => roleMatches(r, ADVISOR.required, ADVISOR);

  test("oqituvchi (readAll + chat:create, create YO'Q) -> maslahatchi", () => {
    expect(isAdvisor(role({ giftedStudent: ["read", "readAll"], chat: ["create"] }))).toBe(true);
  });

  test("bo'lim xodimi (create bor) -> maslahatchi EMAS — bypass yo'lidan ketadi", () => {
    expect(
      isAdvisor(role({ giftedStudent: ["create", "read", "readAll"], chat: ["create"] })),
    ).toBe(false);
  });

  test("rahbariyat (chat yo'q) -> maslahatchi EMAS, global qoladi", () => {
    expect(isAdvisor(role({ giftedStudent: ["read", "readAll"] }))).toBe(false);
  });

  test("talaba (readAll yo'q) -> maslahatchi EMAS", () => {
    expect(isAdvisor(role({ giftedStudent: ["read"], chat: ["create"] }))).toBe(false);
  });
});
