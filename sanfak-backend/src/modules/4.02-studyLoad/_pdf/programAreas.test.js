const mongoose = require("mongoose");
const { areaValues, areaText } = require("./programAreas");

const DIR_A = { knowledgeArea: "900000 – Sog'liqni saqlash", educationArea: "910000 – Sog'liqni saqlash" };
const DIR_B = { knowledgeArea: "200000 – San'at va gumanitar fanlar", educationArea: "230000 – Tillar" };

describe("areaValues — ustuvorlik: o'z qiymati → yo'nalishlar", () => {
  test("hujjatning o'z qiymati ustun — yo'nalishdagi qiymat ishlatilmaydi", () => {
    const doc = { knowledgeArea: ["Tibbiyot"], directions: [DIR_A] };
    expect(areaValues(doc, "knowledgeArea")).toEqual(["Tibbiyot"]);
  });

  test("o'z qiymati bo'sh (`[]`) — yo'nalishdan olinadi", () => {
    const doc = { educationArea: [], directions: [DIR_A] };
    expect(areaValues(doc, "educationArea")).toEqual(["910000 – Sog'liqni saqlash"]);
  });

  test("o'z qiymati faqat bo'sh qatorlar (`['', '  ']`) — bo'sh hisoblanadi", () => {
    const doc = { knowledgeArea: ["", "  "], directions: [DIR_A] };
    expect(areaValues(doc, "knowledgeArea")).toEqual(["900000 – Sog'liqni saqlash"]);
  });

  test("o'z qiymatidagi bo'sh qatorlar tashlanadi, qolgani trim bilan", () => {
    const doc = { knowledgeArea: ["", " Tibbiyot "], directions: [DIR_A] };
    expect(areaValues(doc, "knowledgeArea")).toEqual(["Tibbiyot"]);
  });

  test("bir nechta yo'nalish — birinchi uchragan tartibda", () => {
    const doc = { knowledgeArea: [], directions: [DIR_B, DIR_A] };
    expect(areaValues(doc, "knowledgeArea")).toEqual([
      "200000 – San'at va gumanitar fanlar",
      "900000 – Sog'liqni saqlash",
    ]);
  });
});

describe("areaValues — dedupe va null-safe", () => {
  test("bir xil soha ikki yo'nalishda — bitta (apostrof va registr farqi bitta kalit)", () => {
    const doc = {
      directions: [
        { knowledgeArea: "900000 – Sog'liqni saqlash" },
        { knowledgeArea: "900000 – Sog‘liqni saqlash" },
        { knowledgeArea: "900000 – SOGʻLIQNI SAQLASH " },
      ],
    };
    expect(areaValues(doc, "knowledgeArea")).toEqual(["900000 – Sog'liqni saqlash"]);
  });

  test("populate qilinmagan yo'nalish (ObjectId), null, satr bo'lmagan qiymat — tashlanadi", () => {
    const doc = {
      directions: [
        new mongoose.Types.ObjectId(),
        null,
        { knowledgeArea: 900000 },
        { knowledgeArea: null },
        { knowledgeArea: "   " },
        DIR_A,
      ],
    };
    expect(areaValues(doc, "knowledgeArea")).toEqual(["900000 – Sog'liqni saqlash"]);
  });

  test.each([
    ["hujjat yo'q", undefined],
    ["hujjat null", null],
    ["maydon va yo'nalish yo'q", {}],
    ["directions massiv emas", { directions: "x" }],
  ])("%s — bo'sh massiv", (_n, doc) => {
    expect(areaValues(doc, "knowledgeArea")).toEqual([]);
  });
});

describe("areaText — matn va fallback", () => {
  test("qiymatlar «, » bilan qo'shiladi", () => {
    const doc = { directions: [DIR_B, DIR_A] };
    expect(areaText(doc, "educationArea", "—")).toBe("230000 – Tillar, 910000 – Sog'liqni saqlash");
  });

  test("hech narsa yo'q — berilgan fallback («—»), berilmasa null", () => {
    const doc = { knowledgeArea: [], directions: [{ knowledgeArea: null }] };
    expect(areaText(doc, "knowledgeArea", "—")).toBe("—");
    expect(areaText(doc, "knowledgeArea")).toBeNull();
  });
});
