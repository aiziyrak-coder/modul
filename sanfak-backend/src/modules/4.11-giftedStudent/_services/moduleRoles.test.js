const {
  isRegistryOwner,
  isJudge,
  isAdvisor,
  isStudent,
  isObserver,
  isAchievementReviewer,
} = require("./moduleRoles");

const perm = (section, ...actionKeys) => ({ section, actionKeys });
const role = (...permissions) => ({ title: "nom_ahamiyatsiz", permissions });

const BOLIM = role(
  perm("giftedStudent", "create", "read", "readAll", "update", "delete", "export"),
  perm("evaluationCriteria", "create", "read", "readAll", "update", "delete"),
  perm("studentAchievement", "create", "read", "readAll", "update", "delete", "approve", "reject"),
  perm("scholarshipApplication", "create", "read", "readAll", "update", "delete", "approve", "reject", "sign", "export", "score"),
  perm("scholarship", "create", "read", "readAll", "update", "delete"),
  perm("documentType", "create", "read", "readAll", "update", "delete"),
  perm("chat", "create", "read", "readAll", "delete"),
);
const HAKAM = role(
  perm("giftedStudent", "read"),
  perm("studentAchievement", "readAll"),
  perm("evaluationCriteria", "readAll"),
  perm("scholarship", "readAll"),
  perm("scholarshipApplication", "readAll", "score"),
);
const MASLAHATCHI = role(
  perm("giftedStudent", "read", "readAll"),
  perm("studentAchievement", "read", "readAll"),
  perm("scholarshipApplication", "read", "readAll"),
  perm("documentType", "read", "readAll"),
  perm("chat", "create", "read", "readAll"),
);
const TALABA = role(
  perm("giftedStudent", "read"),
  perm("studentAchievement", "create", "read", "readAll"),
  perm("scholarshipApplication", "create", "read"),
  perm("scholarship", "read", "readAll"),
  perm("chat", "create", "read", "readAll", "delete"),
);
const RAHBAR = role(
  perm("giftedStudent", "read", "readAll"),
  perm("studentAchievement", "readAll"),
  perm("scholarship", "readAll"),
  perm("scholarshipApplication", "readAll"),
);

describe("rol profillari bir-birini istisno qiladi", () => {
  const table = [
    ["bo'lim xodimi", BOLIM, { isRegistryOwner: true, isAchievementReviewer: true }],
    ["hakam", HAKAM, { isJudge: true }],
    ["maslahatchi", MASLAHATCHI, { isAdvisor: true }],
    ["talaba", TALABA, { isStudent: true }],
    ["kuzatuvchi rahbariyat", RAHBAR, { isObserver: true }],
  ];
  const all = {
    isRegistryOwner,
    isJudge,
    isAdvisor,
    isStudent,
    isObserver,
    isAchievementReviewer,
  };

  test.each(table)("%s — faqat kutilgan profillarga mos", (_label, r, expected) => {
    for (const [name, fn] of Object.entries(all)) {
      expect({ [name]: fn(r) }).toEqual({ [name]: expected[name] === true });
    }
  });
});

describe("stipendiya yaratuvchisi hakam EMAS", () => {
  test("`score` granti bo'lsa ham bo'lim xodimi hakam sanalmaydi", () => {
    expect(isJudge(BOLIM)).toBe(false);
  });

  test("haqiqiy hakam (scholarship:create YO'Q) tanilaveradi", () => {
    expect(isJudge(HAKAM)).toBe(true);
  });
});

describe("chegara holatlari", () => {
  test("roli yo'q / ruxsatsiz rol — hech qaysi profilga tushmaydi", () => {
    for (const r of [undefined, null, {}, role()]) {
      expect(isRegistryOwner(r)).toBe(false);
      expect(isJudge(r)).toBe(false);
      expect(isAdvisor(r)).toBe(false);
      expect(isStudent(r)).toBe(false);
      expect(isObserver(r)).toBe(false);
    }
  });
});
