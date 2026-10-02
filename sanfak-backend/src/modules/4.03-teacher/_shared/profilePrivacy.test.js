const {
  PERSONAL_FIELDS,
  canSeePersonal,
  redactProfile,
  redactProfiles,
} = require("./profilePrivacy");
const { ROLES } = require("#config/constants");
const TeacherModel = require("./../teacher/teacher.model");

const OWNER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

const reqAs = (roleTitle, userId) => ({
  user: { _id: userId, role: { title: roleTitle } },
});

const profile = (ownerId = OWNER_ID) => ({
  _id: "ppppppppppppppppppppppppp",
  user: { _id: ownerId, firstName: "Dilnoza", lastName: "Yusupova" },
  position: { _id: "x", title: "Dotsent" },
  department: { _id: "y", title: "Ichki kasalliklar kafedrasi" },
  faculty: { _id: "z", title: "Davolash fakulteti" },
  academicDegree: "phd",
  academicTitle: "docent",
  employmentType: "asosiy",
  googleScholarUrl: "https://scholar.google.com/x",
  passportSeries: "AA",
  passportNumber: "1234567",
  passportIssuedBy: "IIB",
  passportIssuedAt: new Date("2015-01-01"),
  passportExpiry: new Date("2035-01-01"),
  jshshir: "12345678901234",
  address: "Farg'ona sh., 2-uy",
  birthDate: new Date("1985-05-05"),
  teachingSpecialtyNote: "muqobil asos izohi",
});

const hasAnyPersonal = (obj) => PERSONAL_FIELDS.some((f) => f in obj);
const hasAllPersonal = (obj) => PERSONAL_FIELDS.every((f) => f in obj);

describe("PERSONAL_FIELDS ro'yxati modelga mos (drift qorovuli)", () => {
  test("har bir maydon `teacher.model` sxemasida mavjud", () => {
    const allPaths = Object.keys(TeacherModel.schema.paths);
    const exists = (f) =>
      Boolean(TeacherModel.schema.path(f)) ||
      allPaths.some((p) => p.startsWith(`${f}.`));

    const missing = PERSONAL_FIELDS.filter((f) => !exists(f));
    expect(missing).toEqual([]);
  });

  test("`address` nested obyekt sifatida to'liq o'chadi", () => {
    const out = redactProfile(reqAs(ROLES.KAFEDRA_MUDIRI, OTHER_ID), {
      ...profile(),
      address: { region: "Farg'ona", district: "Marg'ilon", street: "Navoiy" },
    });
    expect(out.address).toBeUndefined();
  });

  test("ro'yxat bo'sh emas", () => {
    expect(PERSONAL_FIELDS.length).toBeGreaterThan(0);
  });
});

describe("canSeePersonal — kim ko'ra oladi", () => {
  test("profil EGASI — ha", () => {
    expect(canSeePersonal(reqAs(ROLES.OQITUVCHI, OWNER_ID), profile())).toBe(
      true,
    );
  });

  test("KADRLAR — ha (TZ 4.3.2 shaxsni tasdiqlaydi)", () => {
    expect(canSeePersonal(reqAs(ROLES.KADRLAR, OTHER_ID), profile())).toBe(true);
  });

  test("super_admin — ha", () => {
    expect(canSeePersonal(reqAs(ROLES.SUPER_ADMIN, OTHER_ID), profile())).toBe(
      true,
    );
  });

  test("kafedra mudiri (begona profil) — YO'Q", () => {
    expect(
      canSeePersonal(reqAs(ROLES.KAFEDRA_MUDIRI, OTHER_ID), profile()),
    ).toBe(false);
  });

  test("dekan (begona profil) — YO'Q", () => {
    expect(canSeePersonal(reqAs(ROLES.DEKAN, OTHER_ID), profile())).toBe(false);
  });

  test("boshqa o'qituvchi (begona profil) — YO'Q", () => {
    expect(canSeePersonal(reqAs(ROLES.OQITUVCHI, OTHER_ID), profile())).toBe(
      false,
    );
  });

  test("`user` xom ObjectId bo'lsa ham egalik aniqlanadi (populate qilinmagan)", () => {
    const raw = { ...profile(), user: OWNER_ID };
    expect(canSeePersonal(reqAs(ROLES.OQITUVCHI, OWNER_ID), raw)).toBe(true);
  });

  test("req.user yo'q — YO'Q (fail-closed)", () => {
    expect(canSeePersonal({}, profile())).toBe(false);
  });
});

describe("redactProfile — maydonlarni olib tashlash", () => {
  test("egasi uchun BARCHA shaxsiy maydon qoladi", () => {
    const out = redactProfile(reqAs(ROLES.OQITUVCHI, OWNER_ID), profile());
    expect(hasAllPersonal(out)).toBe(true);
  });

  test("kadrlar uchun ham qoladi", () => {
    const out = redactProfile(reqAs(ROLES.KADRLAR, OTHER_ID), profile());
    expect(hasAllPersonal(out)).toBe(true);
  });

  test("kafedra mudiri uchun HECH BIRI qolmaydi", () => {
    const out = redactProfile(reqAs(ROLES.KAFEDRA_MUDIRI, OTHER_ID), profile());
    expect(hasAnyPersonal(out)).toBe(false);
  });

  test("XIZMAT ma'lumoti kafedra mudiriga QOLADI (monitoring uchun kerak)", () => {
    const out = redactProfile(reqAs(ROLES.KAFEDRA_MUDIRI, OTHER_ID), profile());
    expect(out.position).toEqual({ _id: "x", title: "Dotsent" });
    expect(out.department.title).toBe("Ichki kasalliklar kafedrasi");
    expect(out.academicDegree).toBe("phd");
    expect(out.employmentType).toBe("asosiy");
    expect(out.googleScholarUrl).toBeTruthy();
    expect(out.user.firstName).toBe("Dilnoza");
  });

  test("asl hujjat O'ZGARTIRILMAYDI (nusxa qaytadi)", () => {
    const original = profile();
    redactProfile(reqAs(ROLES.DEKAN, OTHER_ID), original);
    expect(original.jshshir).toBe("12345678901234");
  });

  test("mongoose hujjati (toObject bilan) ham ishlaydi", () => {
    const plain = profile();
    const doc = { ...plain, toObject: () => plain };
    const out = redactProfile(reqAs(ROLES.DEKAN, OTHER_ID), doc);
    expect(hasAnyPersonal(out)).toBe(false);
    expect(out.toObject).toBeUndefined();
  });

  test("null/undefined — yiqilmaydi", () => {
    expect(redactProfile(reqAs(ROLES.DEKAN, OTHER_ID), null)).toBeNull();
  });
});

describe("redactProfiles — ro'yxat (o'ziniki ochiq, begonasi yopiq)", () => {
  test("o'qituvchi ro'yxatda faqat O'Z shaxsiy ma'lumotini ko'radi", () => {
    const rows = [profile(OWNER_ID), profile(OTHER_ID)];
    const out = redactProfiles(reqAs(ROLES.OQITUVCHI, OWNER_ID), rows);

    expect(hasAllPersonal(out[0])).toBe(true);
    expect(hasAnyPersonal(out[1])).toBe(false);
  });

  test("kafedra mudiri uchun BARCHA qatorlar yopiq", () => {
    const rows = [profile(OWNER_ID), profile(OTHER_ID)];
    const out = redactProfiles(reqAs(ROLES.KAFEDRA_MUDIRI, "ccc"), rows);

    expect(out.every((r) => !hasAnyPersonal(r))).toBe(true);
  });

  test("kadrlar uchun BARCHA qatorlar ochiq", () => {
    const rows = [profile(OWNER_ID), profile(OTHER_ID)];
    const out = redactProfiles(reqAs(ROLES.KADRLAR, "ccc"), rows);

    expect(out.every((r) => hasAllPersonal(r))).toBe(true);
  });

  test("massiv bo'lmasa — o'zgarishsiz qaytadi", () => {
    expect(redactProfiles(reqAs(ROLES.DEKAN, "x"), null)).toBeNull();
  });
});

describe("REGRESSION-GUARD — controller redaksiyani chetlab o'tmasin", () => {
  const fs = require("fs");
  const src = fs.readFileSync(
    require.resolve("./../teacher/teacher.controller"),
    "utf8",
  );

  test("findAllProfiles `redactProfiles` bilan qaytaradi", () => {
    expect(src).toMatch(/json\(redactProfiles\(req, docs\)\)/);
  });

  test("paginateProfiles `docs` massivini tozalaydi", () => {
    expect(src).toMatch(/doc\.docs = redactProfiles\(req, doc\.docs\)/);
  });

  test("findOneProfile `redactProfile` bilan qaytaradi", () => {
    expect(src).toMatch(/json\(redactProfile\(req, doc\)\)/);
  });

  test("xom `res.json(doc)` (redaksiyasiz) qaytish qolmagan", () => {
    expect(src).not.toMatch(/return res\.status\(200\)\.json\(doc\);\s*\n\s*\}\s*catch[\s\S]{0,80}Profilni olishda/);
  });
});
