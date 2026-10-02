jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#modules/4.01-auth/role/role.model");
jest.mock("#references/department/department.model");
jest.mock("#references/academicYear/academicYear.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const Department = require("#references/department/department.model");
const AcademicYear = require("#references/academicYear/academicYear.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { ROLES } = require("#config/constants");
const {
  safeDispatch,
  safeDispatchMany,
  STEP_ROLE,
  STEP_SCOPE,
  getRecipients,
  getRecipientsForSteps,
  describeOwner,
} = require("./chainNotify");

const TEACHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEPT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DEPT_ID_2 = "ffffffffffffffffffffffff";
const FACULTY_ID = "cccccccccccccccccccccccc";
const YEAR_ID = "dddddddddddddddddddddddd";

const chain = (result) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(result),
  }),
});

const roleId = (title) => `role-${title}`;
const userIdFor = (rid) => `user-${rid}`;

let userFindFilter;

beforeEach(() => {
  jest.clearAllMocks();
  userFindFilter = null;

  Role.find = jest.fn((filter) =>
    chain((filter?.title?.$in || []).map((title) => ({ _id: roleId(title) }))),
  );
  User.find = jest.fn((filter) => {
    userFindFilter = filter;
    return chain(
      (filter?.role?.$in || []).map((rid) => ({ _id: userIdFor(rid) })),
    );
  });
  User.findById = jest.fn(() => chain({ department: DEPT_ID, faculty: null }));
  Department.findById = jest.fn(() => chain({ faculty: FACULTY_ID }));
  Department.find = jest.fn(() =>
    chain([{ _id: DEPT_ID }, { _id: DEPT_ID_2 }]),
  );
  AcademicYear.findById = jest.fn(() => chain({ title: "2026/2027" }));
});

describe("getRecipients — kafedra (department) darajasi", () => {
  test("faqat egasining KAFEDRASIDAGI shu roldagi xodimlar so'raladi", async () => {
    const ids = await getRecipients({
      roleTitles: [ROLES.KAFEDRA_MUDIRI],
      level: "department",
      ownerId: TEACHER_ID,
    });

    expect(ids).toEqual([userIdFor(roleId(ROLES.KAFEDRA_MUDIRI))]);
    expect(userFindFilter).toMatchObject({
      department: DEPT_ID,
      active: true,
    });
  });

  test("egasining kafedrasi yo'q bo'lsa — [] (begona kafedraga ketmaydi)", async () => {
    User.findById = jest.fn(() => chain({ department: null, faculty: null }));

    const ids = await getRecipients({
      roleTitles: [ROLES.KAFEDRA_MUDIRI],
      level: "department",
      ownerId: TEACHER_ID,
    });

    expect(ids).toEqual([]);
    expect(User.find).not.toHaveBeenCalled();
  });
});

describe("getRecipients — fakultet (faculty) darajasi", () => {
  test("fakultet kafedra orqali aniqlanadi va `$or` (faculty | kafedralar) bo'yicha qidiriladi", async () => {
    const ids = await getRecipients({
      roleTitles: [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
      level: "faculty",
      ownerId: TEACHER_ID,
    });

    expect(ids).toEqual([
      userIdFor(roleId(ROLES.DEKAN)),
      userIdFor(roleId(ROLES.FAKULTET_KENGASH_KOTIBI)),
    ]);
    expect(Department.findById).toHaveBeenCalledWith(DEPT_ID);
    expect(userFindFilter.$or).toEqual([
      { faculty: FACULTY_ID },
      { department: { $in: [DEPT_ID, DEPT_ID_2] } },
    ]);
  });

  test("`user.faculty` to'g'ridan-to'g'ri bo'lsa kafedra orqali qidirilmaydi", async () => {
    User.findById = jest.fn(() =>
      chain({ department: null, faculty: FACULTY_ID }),
    );

    await getRecipients({
      roleTitles: [ROLES.DEKAN],
      level: "faculty",
      ownerId: TEACHER_ID,
    });

    expect(Department.findById).not.toHaveBeenCalled();
    expect(userFindFilter.$or[0]).toEqual({ faculty: FACULTY_ID });
  });
});

describe("getRecipients — global daraja", () => {
  test("kafedra/fakultet cheklovi QO'YILMAYDI", async () => {
    const ids = await getRecipients({
      roleTitles: [ROLES.OQUV_USLUBIY_BOSHQARMA],
      level: "global",
    });

    expect(ids).toEqual([userIdFor(roleId(ROLES.OQUV_USLUBIY_BOSHQARMA))]);
    expect(userFindFilter.department).toBeUndefined();
    expect(userFindFilter.$or).toBeUndefined();
    expect(User.findById).not.toHaveBeenCalled();
  });

  test("rol hujjati topilmasa — [] va user so'rovi UMUMAN yuborilmaydi", async () => {
    Role.find = jest.fn(() => chain([]));

    const ids = await getRecipients({
      roleTitles: [ROLES.ICHKI_NAZORAT],
      level: "global",
    });

    expect(ids).toEqual([]);
    expect(User.find).not.toHaveBeenCalled();
  });
});

describe("getRecipients — regressiya qulflari", () => {
  test("rol filtri `active: { $ne: false }` (qat'iy `true` EMAS)", async () => {
    await getRecipients({ roleTitles: [ROLES.DEKAN], level: "global" });
    expect(Role.find).toHaveBeenCalledWith({
      title: { $in: [ROLES.DEKAN] },
      active: { $ne: false },
    });
  });

  test("noma'lum daraja — [] (throw YO'Q)", async () => {
    const ids = await getRecipients({ roleTitles: [ROLES.DEKAN], level: "x" });
    expect(ids).toEqual([]);
  });

  test("DB xatosi — [] (asosiy amal yiqilmaydi)", async () => {
    Role.find = jest.fn(() => {
      throw new Error("connection lost");
    });

    const ids = await getRecipients({
      roleTitles: [ROLES.DEKAN],
      level: "global",
    });
    expect(ids).toEqual([]);
  });
});

describe("getRecipientsForSteps — bosqich -> rol -> daraja", () => {
  test("STEP_ROLE — `ROLE_STEP`ning teskarisi (yangi xarita yozilmagan)", () => {
    expect(STEP_ROLE.kafedraMudiri).toBe(ROLES.KAFEDRA_MUDIRI);
    expect(STEP_ROLE.dekan).toBe(ROLES.DEKAN);
    expect(STEP_ROLE.oquvUslubiy).toBe(ROLES.OQUV_USLUBIY_BOSHQARMA);
    expect(STEP_ROLE.ichkiNazorat).toBe(ROLES.ICHKI_NAZORAT);
  });

  test("G1 (3 bosqich, hammasi kafedra darajasida) — BITTA user so'rovi", async () => {
    const ids = await getRecipientsForSteps(
      ["kafedraUslubiy", "kafedraIlmiy", "kafedraUstozShogird"],
      TEACHER_ID,
    );

    expect(User.find).toHaveBeenCalledTimes(1);
    expect(userFindFilter.department).toBe(DEPT_ID);
    expect(ids).toHaveLength(3);
  });

  test("G4 (dekan) — fakultet darajasi", async () => {
    await getRecipientsForSteps(["dekan"], TEACHER_ID);
    expect(userFindFilter.$or).toBeDefined();
  });

  test("G3 (oquvUslubiy) — global daraja", async () => {
    await getRecipientsForSteps(["oquvUslubiy"], TEACHER_ID);
    expect(userFindFilter.$or).toBeUndefined();
    expect(userFindFilter.department).toBeUndefined();
  });

  test("`teacher` (G0) qabul qiluvchi BERMAYDI — reja egasiga navbat xabari ketmaydi", async () => {
    expect(STEP_SCOPE.teacher).toBeUndefined();
    const ids = await getRecipientsForSteps(["teacher"], TEACHER_ID);
    expect(ids).toEqual([]);
    expect(User.find).not.toHaveBeenCalled();
  });
});

describe("safeDispatch / safeDispatchMany — best-effort", () => {
  test("dispatch xato bersa throw QILMAYDI, null qaytaradi", async () => {
    dispatch.mockRejectedValueOnce(new Error("socket down"));
    await expect(
      safeDispatch({ userId: "u1", eventType: "x", title: "t" }),
    ).resolves.toBeNull();
  });

  test("takroriy qabul qiluvchi — bitta dispatch", async () => {
    await safeDispatchMany(["u1", "u1", null, "u2"], {
      eventType: "x",
      title: "t",
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  test("qabul qiluvchi yo'q — 0 dispatch, xato yo'q", async () => {
    await expect(
      safeDispatchMany([], { eventType: "x", title: "t" }),
    ).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("describeOwner", () => {
  test("familiya + ism bosh harfi + o'quv yili", async () => {
    User.findById = jest.fn(() =>
      chain({ firstName: "Akmal", lastName: "Anatomov" }),
    );
    await expect(describeOwner(TEACHER_ID, YEAR_ID)).resolves.toBe(
      "Anatomov A. — 2026/2027 o'quv yili",
    );
  });

  test("xatoda bo'sh satr (xabar baribir ketadi)", async () => {
    User.findById = jest.fn(() => {
      throw new Error("boom");
    });
    await expect(describeOwner(TEACHER_ID, YEAR_ID)).resolves.toBe("");
  });
});
