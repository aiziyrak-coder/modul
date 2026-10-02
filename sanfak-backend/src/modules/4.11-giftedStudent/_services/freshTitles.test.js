const FAC = "69df7a8f94bda50c83a1d435";
const DIR = "69df7a8f94bda50c83a1d4a1";
const GRP = "69df7a8f94bda50c83a1d4a7";

let mockRows = { faculty: [], direction: [], group: [] };
const mockCalls = { faculty: 0, direction: 0, group: 0 };
const model = (kind) => ({
  find: (q) => {
    mockCalls[kind] += 1;
    const ids = (q._id.$in || []).map(String);
    return { select: () => ({ lean: async () => mockRows[kind].filter((r) => ids.includes(String(r._id))) }) };
  },
});
jest.mock("#references/faculty/faculty.model", () => model("faculty"));
jest.mock("#references/direction/direction.model", () => model("direction"));
jest.mock("#references/group/group.model", () => model("group"));

const { applyFreshTitles, REF_FIELDS } = require("./freshTitles");

beforeEach(() => {
  mockRows = {
    faculty: [{ _id: FAC, title: "Fakultet (JORIY)" }],
    direction: [{ _id: DIR, title: "Yo'nalish (JORIY)" }],
    group: [{ _id: GRP, title: "Guruh (JORIY)" }],
  };
  mockCalls.faculty = 0;
  mockCalls.direction = 0;
  mockCalls.group = 0;
});

describe("applyFreshTitles — ma'lumotnomadagi joriy nom snapshot ustiga", () => {
  test("eskirgan snapshot almashtiriladi", async () => {
    const doc = { faculty: "ESKI NOM", facultyId: FAC };
    await applyFreshTitles(doc);
    expect(doc.faculty).toBe("Fakultet (JORIY)");
  });

  test("ID TEGILMAYDI — javob shakli o'zgarmaydi", async () => {
    const doc = { faculty: "x", facultyId: FAC };
    await applyFreshTitles(doc);
    expect(doc.facultyId).toBe(FAC);
  });

  test("uchala maydon ham yangilanadi", async () => {
    const doc = { faculty: "a", direction: "b", group: "c", facultyId: FAC, directionId: DIR, groupId: GRP };
    await applyFreshTitles(doc);
    expect([doc.faculty, doc.direction, doc.group]).toEqual([
      "Fakultet (JORIY)", "Yo'nalish (JORIY)", "Guruh (JORIY)",
    ]);
  });

  describe("TEGILMAYDIGAN holatlar", () => {
    test("ref `null` — snapshot o'z holicha", async () => {
      const doc = { group: "Farm-201", groupId: null };
      await applyFreshTitles(doc);
      expect(doc.group).toBe("Farm-201");
    });

    test("ma'lumotnoma qatori O'CHIRILGAN — snapshot ham, ID ham saqlanadi", async () => {
      mockRows.faculty = [];
      const doc = { faculty: "Oxirgi ma'lum nom", facultyId: FAC };
      await applyFreshTitles(doc);
      expect(doc.faculty).toBe("Oxirgi ma'lum nom");
      expect(doc.facultyId).toBe(FAC);
    });

    test("ma'lumotnomada sarlavha bo'sh — snapshot saqlanadi", async () => {
      mockRows.faculty = [{ _id: FAC, title: "" }];
      const doc = { faculty: "Eski", facultyId: FAC };
      await applyFreshTitles(doc);
      expect(doc.faculty).toBe("Eski");
    });

    test("null/bo'sh kirish yiqitmaydi", async () => {
      await expect(applyFreshTitles(null)).resolves.toBeNull();
      await expect(applyFreshTitles([])).resolves.toEqual([]);
    });
  });
});

describe("So'rovlar soni — N+1 yo'q", () => {
  test("100 hujjat uchun ham har bir ma'lumotnomaga BITTA so'rov", async () => {
    const docs = Array.from({ length: 100 }, () => ({
      faculty: "x", direction: "y", group: "z", facultyId: FAC, directionId: DIR, groupId: GRP,
    }));
    await applyFreshTitles(docs);
    expect(mockCalls).toEqual({ faculty: 1, direction: 1, group: 1 });
    expect(docs.every((d) => d.faculty === "Fakultet (JORIY)")).toBe(true);
  });

  test("ref siz hujjatlar uchun so'rov UMUMAN yuborilmaydi", async () => {
    await applyFreshTitles([{ faculty: "a" }, { faculty: "b" }]);
    expect(mockCalls).toEqual({ faculty: 0, direction: 0, group: 0 });
  });
});

describe("Konfiguratsiya", () => {
  test("uchala Hybrid Lean ref ham qamrab olingan", () => {
    expect(REF_FIELDS.map((f) => f.ref).sort()).toEqual(["directionId", "facultyId", "groupId"]);
  });
});
