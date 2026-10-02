const {
  transformItem,
  transformDoc,
} = require("./personalWorkPlan-item-shape.migration");

describe("transformItem", () => {
  test("`workVolume: \"12 soat\"` → `plannedCount: 12`, `workVolume` o'chadi", () => {
    const { next, changed } = transformItem({
      title: "Maqola",
      workVolume: "12 soat",
    });
    expect(changed).toBe(true);
    expect(next.plannedCount).toBe(12);
    expect(next).not.toHaveProperty("workVolume");
  });

  test("`workVolume` raqamga aylanmasa `plannedCount: 0`", () => {
    const { next } = transformItem({ title: "x", workVolume: "noma'lum" });
    expect(next.plannedCount).toBe(0);
  });

  test("`semester: 1` (son) → `semester: [1]`", () => {
    const { next, changed } = transformItem({ title: "x", semester: 1 });
    expect(changed).toBe(true);
    expect(next.semester).toEqual([1]);
  });

  test("`semester` allaqachon massiv bo'lsa tegilmaydi", () => {
    const { next, changed } = transformItem({ title: "x", semester: [1, 2] });
    expect(next.semester).toEqual([1, 2]);
    expect(changed).toBe(false);
  });

  test("mentoringWork: `title` yo'q, `topic` bor → `title = topic`", () => {
    const { next, changed } = transformItem(
      { topic: "Kurs ishi mavzusi", studentName: "Aliyev Vali" },
      true,
    );
    expect(changed).toBe(true);
    expect(next.title).toBe("Kurs ishi mavzusi");
  });

  test("mentoringWork: `title` va `topic` yo'q, `studentName` bor → `title = studentName`", () => {
    const { next } = transformItem({ studentName: "Aliyev Vali" }, true);
    expect(next.title).toBe("Aliyev Vali");
  });

  test("mentoringWork: hech narsa yo'q → `title = \"(nomsiz)\"`", () => {
    const { next } = transformItem({}, true);
    expect(next.title).toBe("(nomsiz)");
  });

  test("mentoringWork emas va `title` yo'q bo'lsa — title fallback QO'LLANMAYDI", () => {
    const { next, changed } = transformItem({ note: "izoh" }, false);
    expect(next.title).toBeUndefined();
    expect(changed).toBe(false);
  });

  test("o'zgarish kerak bo'lmasa `changed: false`", () => {
    const { changed } = transformItem({ title: "x", plannedCount: 3, semester: [1] });
    expect(changed).toBe(false);
  });
});

describe("transformDoc", () => {
  test("bir nechta bo'lim, faqat o'zgarganlari `$set`ga tushadi", () => {
    const doc = {
      _id: "x1",
      researchWork: [{ title: "Maqola", workVolume: "3" }],
      mentoringWork: [{ topic: "Bitiruv ishi" }],
      organizationalWork: [{ title: "Tadbir", plannedCount: 2, semester: [1] }],
      extraWork: [],
    };
    const { $set, itemsChanged, docChanged } = transformDoc(doc);

    expect(docChanged).toBe(true);
    expect(Object.keys($set).sort()).toEqual(
      ["mentoringWork", "researchWork"].sort(),
    );
    expect($set.researchWork[0].plannedCount).toBe(3);
    expect($set.mentoringWork[0].title).toBe("Bitiruv ishi");
    expect(itemsChanged).toBe(2);
  });

  test("hech narsa o'zgarmasa `docChanged: false`", () => {
    const doc = {
      _id: "x2",
      researchWork: [{ title: "x", plannedCount: 1, semester: [1] }],
    };
    const { docChanged } = transformDoc(doc);
    expect(docChanged).toBe(false);
  });
});

test("modul `require()` qilinganda DB'ga ulanmaydi (`main()` chaqirilmaydi)", () => {
  expect(true).toBe(true);
});
