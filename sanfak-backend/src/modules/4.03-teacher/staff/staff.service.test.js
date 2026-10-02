const mockSave = jest.fn();
const mockProfileSave = jest.fn();

jest.mock("#modules/4.01-auth/user/user.model", () => {
  const MockUser = jest.fn().mockImplementation(function ctor(data) {
    Object.assign(this, data);
    this.save = mockSave;
  });
  MockUser.find = jest.fn();
  MockUser.findOne = jest.fn();
  MockUser.findById = jest.fn();
  MockUser.findByIdAndDelete = jest.fn();
  MockUser.findOneAndUpdate = jest.fn();
  MockUser.paginate = jest.fn();
  return MockUser;
});
jest.mock("#modules/4.01-auth/role/role.model");
jest.mock("#references/department/department.model");
jest.mock("#modules/4.03-teacher/teacher/teacher.model", () => {
  const MockTeacherProfile = jest.fn().mockImplementation(function ctor(data) {
    Object.assign(this, data);
    this.save = mockProfileSave;
  });
  MockTeacherProfile.findOneAndUpdate = jest.fn();
  return MockTeacherProfile;
});

const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const Department = require("#references/department/department.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const service = require("./staff.service");

const OQITUVCHI_ROLE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SUPER_ADMIN_ROLE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const USER_ID = "cccccccccccccccccccccccc";

const mockOqituvchiRole = () => {
  Role.findOne = jest.fn().mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: OQITUVCHI_ROLE_ID }) }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOqituvchiRole();
});

describe("create — `role` klientdan HECH QACHON olinmaydi", () => {
  test("yaratilgan xodim roli har doim `oqituvchi`, klient `role` yuborsa ham e'tiborsiz", async () => {
    mockSave.mockResolvedValue(undefined);

    const doc = await service.create({
      firstName: "Ali",
      lastName: "Valiyev",
      role: "hacked-super-admin-id",
    });

    expect(doc.role).toBe(OQITUVCHI_ROLE_ID);
    expect(mockSave).toHaveBeenCalled();
  });

  test("`oneIdPin` klientdan yuborilsa ham modelga yozilmaydi", async () => {
    mockSave.mockResolvedValue(undefined);

    const doc = await service.create({
      firstName: "Ali",
      lastName: "Valiyev",
      oneIdPin: "00000000000099",
    });

    expect(doc.oneIdPin).toBeUndefined();
  });

  test("`active` berilmasa default `true`", async () => {
    mockSave.mockResolvedValue(undefined);
    const doc = await service.create({ firstName: "Ali", lastName: "Valiyev" });
    expect(doc.active).toBe(true);
  });
});

describe("create — A-1: `teacherProfile` ham yaratiladi", () => {
  test("`user` VA `teacherProfile` ikkisi ham yaratiladi, profil `hrApprovalStatus: pending`", async () => {
    mockSave.mockResolvedValue(undefined);
    mockProfileSave.mockResolvedValue(undefined);

    const doc = await service.create({ firstName: "Ali", lastName: "Valiyev" });

    expect(mockSave).toHaveBeenCalled();
    expect(mockProfileSave).toHaveBeenCalled();
    expect(TeacherProfile).toHaveBeenCalledWith(
      expect.objectContaining({ user: doc._id, hrApprovalStatus: "pending" }),
    );
  });

  test("profil yaratish xato bersa — `user` kompensatsiya bilan o'chiriladi", async () => {
    mockSave.mockResolvedValue(undefined);
    mockProfileSave.mockRejectedValue(new Error("Mongo xatosi"));
    User.findByIdAndDelete = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.create({ firstName: "Ali", lastName: "Valiyev" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(User.findByIdAndDelete).toHaveBeenCalled();
  });

  test("profil `user`da dublikat bo'lsa (E11000) — 409, `user` baribir o'chiriladi", async () => {
    mockSave.mockResolvedValue(undefined);
    const dupErr = new Error("duplicate");
    dupErr.code = 11000;
    mockProfileSave.mockRejectedValue(dupErr);
    User.findByIdAndDelete = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.create({ firstName: "Ali", lastName: "Valiyev" }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(User.findByIdAndDelete).toHaveBeenCalled();
  });

  test("jshshir/birthDate/address profilga tushadi, `user`ga tushmaydi", async () => {
    mockSave.mockResolvedValue(undefined);
    mockProfileSave.mockResolvedValue(undefined);

    const doc = await service.create({
      firstName: "Ali",
      lastName: "Valiyev",
      jshshir: "12345678901234",
      birthDate: "1990-01-01",
      address: { region: "Farg'ona", district: "Marg'ilon", street: "Bog'bon" },
    });

    expect(doc.jshshir).toBeUndefined();
    expect(doc.birthDate).toBeUndefined();
    expect(doc.address).toBeUndefined();
    expect(TeacherProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        jshshir: "12345678901234",
        birthDate: "1990-01-01",
        address: { region: "Farg'ona", district: "Marg'ilon", street: "Bog'bon" },
      }),
    );
  });

  test("scholar/scopus IKKALASIGA yoziladi (`user.googleScholar` + `teacherProfile.googleScholarUrl`)", async () => {
    mockSave.mockResolvedValue(undefined);
    mockProfileSave.mockResolvedValue(undefined);

    const doc = await service.create({
      firstName: "Ali",
      lastName: "Valiyev",
      googleScholar: "https://scholar.google.com/x",
      scopus: "https://scopus.com/y",
    });

    expect(doc.googleScholar).toBe("https://scholar.google.com/x");
    expect(doc.scopus).toBe("https://scopus.com/y");
    expect(TeacherProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        googleScholarUrl: "https://scholar.google.com/x",
        scopusUrl: "https://scopus.com/y",
      }),
    );
  });

  test("Faza 1b: kasbiy mutaxassislik maydonlari profilga tushadi, `user`ga tushmaydi", async () => {
    mockSave.mockResolvedValue(undefined);
    mockProfileSave.mockResolvedValue(undefined);

    const doc = await service.create({
      firstName: "Ali",
      lastName: "Valiyev",
      teachingSpecialtyName: "Bolalar stomatologiyasi",
      teachingSpecialtyCode: "14.00.07",
      teachingSpecialtyBasis: "diplom",
      teachingSpecialtyNote: "izoh",
    });

    expect(doc.teachingSpecialtyName).toBeUndefined();
    expect(doc.teachingSpecialtyCode).toBeUndefined();
    expect(doc.teachingSpecialtyBasis).toBeUndefined();
    expect(doc.teachingSpecialtyNote).toBeUndefined();
    expect(TeacherProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        teachingSpecialtyName: "Bolalar stomatologiyasi",
        teachingSpecialtyCode: "14.00.07",
        teachingSpecialtyBasis: "diplom",
        teachingSpecialtyNote: "izoh",
      }),
    );
  });

  test("`faculty` yuborilsa ham profilga qo'lda yozilmaydi (hook o'zi hisoblaydi)", async () => {
    mockSave.mockResolvedValue(undefined);
    mockProfileSave.mockResolvedValue(undefined);

    await service.create({
      firstName: "Ali",
      lastName: "Valiyev",
      faculty: "aaaaaaaaaaaaaaaaaaaaaaaa",
    });

    const [profileArg] = TeacherProfile.mock.calls[0];
    expect(profileArg.faculty).toBeUndefined();
  });
});

describe("update / remove — faqat `oqituvchi` rolli userga tegish mumkin", () => {
  test("update — begona user (topilmadi) -> 404", async () => {
    User.findById = jest.fn().mockReturnValue({ select: () => Promise.resolve(null) });

    await expect(service.update(USER_ID, { phone: "+998900000000" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("update — `super_admin` rolli userga -> 403", async () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: SUPER_ADMIN_ROLE_ID }) });

    await expect(service.update(USER_ID, { phone: "+998900000000" })).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("remove — `super_admin` rolli userga -> 403", async () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: SUPER_ADMIN_ROLE_ID }) });

    await expect(service.remove(USER_ID)).rejects.toMatchObject({ statusCode: 403 });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("update — `oqituvchi` rolli userga ruxsat, `role`/`oneIdPin` tashlab yuboriladi", async () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: OQITUVCHI_ROLE_ID }) });
    User.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: USER_ID });

    await service.update(USER_ID, {
      phone: "+998900000000",
      role: "hacked",
      oneIdPin: "00000000000099",
    });

    const [filter, update] = User.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: USER_ID, role: OQITUVCHI_ROLE_ID });
    expect(update.$set.role).toBeUndefined();
    expect(update.$set.oneIdPin).toBeUndefined();
    expect(update.$set.phone).toBe("+998900000000");
  });

  test("update — `degrees` `$push` bilan qo'shiladi (mavjudlarni almashtirmaydi)", async () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: OQITUVCHI_ROLE_ID }) });
    User.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: USER_ID });

    await service.update(USER_ID, {
      degrees: { bachelorDegree: [{ title: "Diplom", path: "https://x/y.pdf" }] },
    });

    const [, update] = User.findOneAndUpdate.mock.calls[0];
    expect(update.$push["degrees.bachelorDegree"]).toEqual({
      $each: [{ title: "Diplom", path: "https://x/y.pdf" }],
    });
    expect(update.$set.degrees).toBeUndefined();
  });

  test("remove — SOFT delete (`active:false`, hujjat qoladi)", async () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: OQITUVCHI_ROLE_ID }) });
    User.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: USER_ID, active: false });

    const doc = await service.remove(USER_ID);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: USER_ID, role: OQITUVCHI_ROLE_ID },
      { active: false },
      { new: true },
    );
    expect(doc.active).toBe(false);
  });
});

describe("update — A-1: profil maydonlari profilga boradi", () => {
  const mockOqituvchiUser = () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: OQITUVCHI_ROLE_ID }) });
    User.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: USER_ID });
  };

  test("profil maydonlari (jshshir, department, ...) `teacherProfile.findOneAndUpdate`ga boradi — profil yo'q bo'lsa yaratiladi (upsert)", async () => {
    mockOqituvchiUser();
    TeacherProfile.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: "p1" });

    await service.update(USER_ID, {
      jshshir: "12345678901234",
      department: "dep1",
    });

    expect(TeacherProfile.findOneAndUpdate).toHaveBeenCalledWith(
      { user: USER_ID },
      { $set: { department: "dep1", jshshir: "12345678901234" } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  });

  test("`hrApprovalStatus` TEGILMAYDI — `$set` ichida bunday kalit yo'q", async () => {
    mockOqituvchiUser();
    TeacherProfile.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: "p1" });

    await service.update(USER_ID, { phone: "+998900000000", department: "dep1" });

    const [, update] = TeacherProfile.findOneAndUpdate.mock.calls[0];
    expect(update.$set.hrApprovalStatus).toBeUndefined();
  });

  test("profilga tegishli maydon yuborilmasa — `TeacherProfile.findOneAndUpdate` chaqirilmaydi", async () => {
    mockOqituvchiUser();
    TeacherProfile.findOneAndUpdate = jest.fn();

    await service.update(USER_ID, { phone: "+998900000000" });

    expect(TeacherProfile.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("remove — A-1: profil ham `active:false`", () => {
  test("`user` VA `teacherProfile` ikkisi ham `active:false` bo'ladi", async () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: OQITUVCHI_ROLE_ID }) });
    User.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: USER_ID, active: false });
    TeacherProfile.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: "p1", active: false });

    await service.remove(USER_ID);

    expect(TeacherProfile.findOneAndUpdate).toHaveBeenCalledWith(
      { user: USER_ID },
      { active: false },
    );
  });
});

describe("findOne — A-1 + Faza 1b: profil maydonlari (jshshir, kasbiy mutaxassislik) qaytadi", () => {
  test("Faza 1b: `teachingSpecialty*` maydonlari javobda keladi (SPEC §B.4 tuzoq #2 — bo'sh forma emas)", async () => {
    User.findOne = jest.fn().mockReturnValue({
      populate: () => ({ lean: () => Promise.resolve({ _id: USER_ID, firstName: "Ali" }) }),
    });
    TeacherProfile.findOne = jest.fn().mockReturnValue({
      lean: () =>
        Promise.resolve({
          jshshir: "12345678901234",
          teachingSpecialtyName: "Bolalar stomatologiyasi",
          teachingSpecialtyCode: "14.00.07",
          teachingSpecialtyBasis: "diplom",
          teachingSpecialtyNote: "izoh",
        }),
    });

    const doc = await service.findOne(USER_ID);

    expect(doc.teachingSpecialtyName).toBe("Bolalar stomatologiyasi");
    expect(doc.teachingSpecialtyCode).toBe("14.00.07");
    expect(doc.teachingSpecialtyBasis).toBe("diplom");
    expect(doc.teachingSpecialtyNote).toBe("izoh");
  });

  test("profil hali yo'q (yangi xodim) — kasbiy mutaxassislik maydonlari `null`, xato tashlanmaydi", async () => {
    User.findOne = jest.fn().mockReturnValue({
      populate: () => ({ lean: () => Promise.resolve({ _id: USER_ID, firstName: "Ali" }) }),
    });
    TeacherProfile.findOne = jest.fn().mockReturnValue({
      lean: () => Promise.resolve(null),
    });

    const doc = await service.findOne(USER_ID);

    expect(doc.teachingSpecialtyName).toBeNull();
    expect(doc.teachingSpecialtyCode).toBeNull();
    expect(doc.teachingSpecialtyBasis).toBeNull();
    expect(doc.teachingSpecialtyNote).toBeNull();
  });

  test("user topilmasa — `null`, `TeacherProfile` so'ralmaydi", async () => {
    User.findOne = jest.fn().mockReturnValue({
      populate: () => ({ lean: () => Promise.resolve(null) }),
    });
    TeacherProfile.findOne = jest.fn();

    const doc = await service.findOne(USER_ID);

    expect(doc).toBeNull();
    expect(TeacherProfile.findOne).not.toHaveBeenCalled();
  });
});

describe("restore — C-1 (2026-07-31): `remove`ning aksi", () => {
  test("boshqa rolli (`super_admin`) userga -> 403, `findOneAndUpdate` chaqirilmaydi", async () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: SUPER_ADMIN_ROLE_ID }) });
    User.findOneAndUpdate = jest.fn();

    await expect(service.restore(USER_ID)).rejects.toMatchObject({ statusCode: 403 });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("user umuman topilmasa (`assertOqituvchi`) -> 404", async () => {
    User.findById = jest.fn().mockReturnValue({ select: () => Promise.resolve(null) });

    await expect(service.restore(USER_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("allaqachon faol bo'lsa -> 400, yozuv o'zgartirilmaydi", async () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: OQITUVCHI_ROLE_ID }) });
    User.findOne = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ active: true }) });
    User.findOneAndUpdate = jest.fn();

    await expect(service.restore(USER_ID)).rejects.toMatchObject({ statusCode: 400 });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("o'chirilgan (`active:false`) `oqituvchi` -> user VA teacherProfile ikkisi ham `active:true`", async () => {
    User.findById = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ role: OQITUVCHI_ROLE_ID }) });
    User.findOne = jest
      .fn()
      .mockReturnValue({ select: () => Promise.resolve({ active: false }) });
    User.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: USER_ID, active: true });
    TeacherProfile.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: "p1", active: true });

    const doc = await service.restore(USER_ID);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: USER_ID, role: OQITUVCHI_ROLE_ID },
      { active: true },
      { new: true },
    );
    expect(TeacherProfile.findOneAndUpdate).toHaveBeenCalledWith(
      { user: USER_ID },
      { active: true },
    );
    expect(doc.active).toBe(true);
  });
});

describe("buildFilter — ro'yxat FAQAT `oqituvchi` rollilarni qaytaradi", () => {
  test("filtrda har doim `role: <oqituvchi id>` bor", async () => {
    const filter = await service.buildFilter({});
    expect(filter.role).toBe(OQITUVCHI_ROLE_ID);
    expect(filter.active).toBe(true);
  });

  describe("`active` filtri (C-1)", () => {
    test("berilmasa — mavjud xulq saqlanadi (faqat faollar)", async () => {
      const filter = await service.buildFilter({});
      expect(filter.active).toBe(true);
    });

    test("`active: false` berilsa — faqat o'chirilganlar", async () => {
      const filter = await service.buildFilter({ active: false });
      expect(filter.active).toBe(false);
    });

    test("`active: true` aniq berilsa ham — faollar (o'zgarishsiz)", async () => {
      const filter = await service.buildFilter({ active: true });
      expect(filter.active).toBe(true);
    });
  });

  test("`department` berilsa to'g'ridan-to'g'ri qo'llanadi", async () => {
    const filter = await service.buildFilter({ department: "dep1" });
    expect(filter.department).toBe("dep1");
  });

  test("`faculty` berilsa — shu fakultet kafedralari bo'yicha `$in`", async () => {
    Department.find = jest.fn().mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: "dep1" }, { _id: "dep2" }]),
      }),
    });

    const filter = await service.buildFilter({ faculty: "fac1" });

    expect(Department.find).toHaveBeenCalledWith({ faculty: "fac1" });
    expect(filter.department).toEqual({ $in: ["dep1", "dep2"] });
  });

  test("`search` FISH bo'yicha regex ($or) quradi", async () => {
    const filter = await service.buildFilter({ search: "Ali" });
    expect(filter.$or).toHaveLength(3);
  });
});

describe("findAll / paginate — role filtri bilan chaqiriladi", () => {
  test("findAll — `User.find` role filtri bilan", async () => {
    const chain = { populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    User.find = jest.fn().mockReturnValue(chain);

    await service.findAll({});

    expect(User.find.mock.calls[0][0]).toMatchObject({ role: OQITUVCHI_ROLE_ID });
  });

  test("paginate — `User.paginate` role filtri bilan", async () => {
    User.paginate = jest.fn().mockResolvedValue({ docs: [], totalDocs: 0 });

    await service.paginate({ page: 1, limit: 10 });

    expect(User.paginate.mock.calls[0][0]).toMatchObject({ role: OQITUVCHI_ROLE_ID });
  });
});
