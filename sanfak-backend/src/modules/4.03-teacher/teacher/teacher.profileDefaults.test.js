jest.mock("./teacher.model");
jest.mock("./teacher.service", () => ({
  profileDefaultsFromUser: jest.fn(),
  syncApprovedPositionToUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.03-teacher/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getRecipients: jest.fn().mockResolvedValue([]),
  getRecipientsForSteps: jest.fn().mockResolvedValue([]),
  describeOwner: jest.fn().mockResolvedValue(""),
}));

const TeacherProfileModel = require("./teacher.model");
const service = require("./teacher.service");
const Controller = require("./teacher.controller");

const ME = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "bbbbbbbbbbbbbbbbbbbbbbbb";
const U_DEP = "6a99de9882b198d4acbe1737";
const U_FAC = "6a7344010156990958a25c46";
const U_POS = "69a69690e42dc426eff9201e";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockCtor = (saveImpl) => {
  TeacherProfileModel.mockImplementation(function ctor(data) {
    Object.assign(this, data);
    this.save = saveImpl || jest.fn().mockResolvedValue(this);
  });
};

const createdWith = () => TeacherProfileModel.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  service.profileDefaultsFromUser.mockResolvedValue({
    department: U_DEP,
    faculty: U_FAC,
    position: U_POS,
  });
});

describe("addProfile — P-23: default'lar user hisobidan", () => {
  test("body'da kafedra/fakultet/lavozim yo'q → uchalasi user'dan", async () => {
    mockCtor();
    const res = createRes();

    await Controller.addProfile(
      { body: { phone: "+998900000001" }, user: { _id: ME } },
      res,
      jest.fn(),
    );

    expect(service.profileDefaultsFromUser).toHaveBeenCalledWith(ME);
    const data = createdWith();
    expect(data.department).toBe(U_DEP);
    expect(data.faculty).toBe(U_FAC);
    expect(data.position).toBe(U_POS);
    expect(data.user).toBe(ME);
    expect(data.hrApprovalStatus).toBe("pending");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("klient kafedra bergan → kafedra klientniki, fakultet user'dan KO'CHIRILMAYDI (pre-save hosila qiladi)", async () => {
    mockCtor();

    await Controller.addProfile(
      { body: { department: "client-dep" }, user: { _id: ME } },
      createRes(),
      jest.fn(),
    );

    const data = createdWith();
    expect(data.department).toBe("client-dep");
    expect(data.faculty).toBeUndefined();
    expect(data.position).toBe(U_POS);
  });

  test("klient hammasini bergan → user default'lari umuman aralashmaydi", async () => {
    mockCtor();

    await Controller.addProfile(
      {
        body: { department: "client-dep", faculty: "client-fac", position: "client-pos" },
        user: { _id: ME },
      },
      createRes(),
      jest.fn(),
    );

    const data = createdWith();
    expect(data).toEqual(
      expect.objectContaining({ department: "client-dep", faculty: "client-fac", position: "client-pos" }),
    );
  });

  test("user hisobida ham bo'sh → null saqlanmaydi, maydonlar undefined qoladi (avvalgi xulq)", async () => {
    service.profileDefaultsFromUser.mockResolvedValue({ department: null, faculty: null, position: null });
    mockCtor();

    await Controller.addProfile({ body: {}, user: { _id: ME } }, createRes(), jest.fn());

    const data = createdWith();
    expect(data.department).toBeUndefined();
    expect(data.faculty).toBeUndefined();
    expect(data.position).toBeUndefined();
  });

  test("`req.body.user` (begona id) hamon e'tiborsiz (F-3 saqlanadi)", async () => {
    mockCtor();

    await Controller.addProfile(
      { body: { user: OTHER }, user: { _id: ME } },
      createRes(),
      jest.fn(),
    );

    expect(createdWith().user).toBe(ME);
  });
});

describe("addProfile — P-23: dublikat profil → 409, xom Mongo xatosi sizmaydi", () => {
  const e11000 = () => {
    const err = new Error(
      'E11000 duplicate key error collection: institute-sanfak.teacherprofiles index: user_1 dup key: { user: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa") }',
    );
    err.code = 11000;
    return err;
  };

  test("err.code === 11000 → 409, xabar insoniy, detail'da baza nomi YO'Q", async () => {
    mockCtor(jest.fn().mockRejectedValue(e11000()));
    const next = jest.fn();

    await Controller.addProfile({ body: {}, user: { _id: ME } }, createRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.message).toMatch(/allaqachon mavjud/);
    expect(JSON.stringify(err)).not.toMatch(/E11000|institute-sanfak|teacherprofiles/);
  });

  test("faqat matnida E11000 bo'lgan xato (code'siz) ham 409", async () => {
    const err = e11000();
    delete err.code;
    mockCtor(jest.fn().mockRejectedValue(err));
    const next = jest.fn();

    await Controller.addProfile({ body: {}, user: { _id: ME } }, createRes(), next);

    expect(next.mock.calls[0][0].statusCode).toBe(409);
  });

  test("boshqa xato → avvalgidek 400 'Profil yaratishda xatolik'", async () => {
    mockCtor(jest.fn().mockRejectedValue(new Error("validation failed")));
    const next = jest.fn();

    await Controller.addProfile({ body: {}, user: { _id: ME } }, createRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Profil yaratishda xatolik");
  });
});

describe("findAllProfiles / paginateProfiles — P-23: o'z profili scope'siz", () => {
  const SCOPE = { department: "scope-dep" };

  const createChain = (resolvedValue) => {
    const chain = {};
    chain.populate = jest.fn().mockReturnValue(chain);
    chain.exec = jest.fn().mockResolvedValue(resolvedValue);
    return chain;
  };

  test("findAllProfiles: ?user=<o'zi> → filtrda scope YO'Q, faqat user", async () => {
    TeacherProfileModel.find = jest.fn().mockReturnValue(createChain([]));

    await Controller.findAllProfiles(
      { query: { user: ME }, scope: SCOPE, user: { _id: ME } },
      createRes(),
      jest.fn(),
    );

    const [filter] = TeacherProfileModel.find.mock.calls[0];
    expect(filter).toEqual({ active: true, user: ME });
  });

  test("findAllProfiles: ?user=<begona> → scope SAQLANADI (sizish yo'q)", async () => {
    TeacherProfileModel.find = jest.fn().mockReturnValue(createChain([]));

    await Controller.findAllProfiles(
      { query: { user: OTHER }, scope: SCOPE, user: { _id: ME } },
      createRes(),
      jest.fn(),
    );

    const [filter] = TeacherProfileModel.find.mock.calls[0];
    expect(filter).toEqual({ active: true, department: "scope-dep", user: OTHER });
  });

  test("findAllProfiles: user query yo'q → scope saqlanadi", async () => {
    TeacherProfileModel.find = jest.fn().mockReturnValue(createChain([]));

    await Controller.findAllProfiles(
      { query: {}, scope: SCOPE, user: { _id: ME } },
      createRes(),
      jest.fn(),
    );

    const [filter] = TeacherProfileModel.find.mock.calls[0];
    expect(filter).toEqual({ active: true, department: "scope-dep" });
  });

  test("paginateProfiles: ?user=<o'zi> → scope'siz; begona → scope bilan", async () => {
    TeacherProfileModel.paginate = jest.fn().mockResolvedValue({ docs: [], totalDocs: 0 });

    await Controller.paginateProfiles(
      { query: { user: ME }, scope: SCOPE, user: { _id: ME } },
      createRes(),
      jest.fn(),
    );
    expect(TeacherProfileModel.paginate.mock.calls[0][0]).toEqual({ active: true, user: ME });

    await Controller.paginateProfiles(
      { query: { user: OTHER }, scope: SCOPE, user: { _id: ME } },
      createRes(),
      jest.fn(),
    );
    expect(TeacherProfileModel.paginate.mock.calls[1][0]).toEqual({
      active: true,
      department: "scope-dep",
      user: OTHER,
    });
  });
});
