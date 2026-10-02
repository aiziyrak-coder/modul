const {
  ROW_TYPE,
  rowTypeOf,
  classifyRows,
  isCountableSubject,
  annotateBlocks,
  isPrefixOfAny,
  buildBlockSerialIndexFromBlocks,
  buildBlockSerialIndex,
  isDoubleCountedHeader,
} = require("./planRowType");

const r = (serialNumber, code, title) => ({ serialNumber, code, title });

const MF1 = [
  r("1.1", "", "Ijtimoiy-gumanitar fanlar moduli"),
  r("1.1.01", "O‘YT1104", "O‘zbekistonning eng yangi tarixi"),
  r("1.1.02", "FS1104", "Falsafa"),
  r("1.2.", "", "Klinika oldi fanlari moduli"),
  r("1.2.01", "TBUG1106", "Tibbiy biologiya. Umumiy genetika"),
  r("1.3.", "", "Klinik modullar"),
  r("1.3.1", "", "Terapiya yo‘nalishi"),
  r("1.3.1.01", "TKK1104", "Tibbiyot kasbiga kirish"),
];

const TF2 = [
  r("", "", "Jami"),
  r("", "", "Malakaviy amaliyot"),
  r("", "TM104", "Tanishuv amaliyoti"),
  r("", "ICHM206", "Ishlab chiqarish amaliyoti"),
  r("", "", "HAMMASI"),
];

describe("classifyRows — MF1 (serial prefiksi)", () => {
  const types = classifyRows(MF1);

  test("oraliq sarlavhalar sectionHeader", () => {
    expect(types[0]).toBe(ROW_TYPE.SECTION_HEADER);
    expect(types[3]).toBe(ROW_TYPE.SECTION_HEADER);
    expect(types[5]).toBe(ROW_TYPE.SECTION_HEADER);
    expect(types[6]).toBe(ROW_TYPE.SECTION_HEADER);
  });

  test("kodli qatorlar — fan", () => {
    expect(types[1]).toBe(ROW_TYPE.SUBJECT);
    expect(types[2]).toBe(ROW_TYPE.SUBJECT);
    expect(types[4]).toBe(ROW_TYPE.SUBJECT);
    expect(types[7]).toBe(ROW_TYPE.SUBJECT);
  });

  test("jonli o'lchov: 8 qatordan 4 tasi fan", () => {
    expect(types.filter(isCountableSubject)).toHaveLength(4);
  });
});

describe("classifyRows — TF2 (T/r bo'sh)", () => {
  const types = classifyRows(TF2);

  test("«Jami» va «HAMMASI» — yig'indi", () => {
    expect(types[0]).toBe(ROW_TYPE.AGGREGATE);
    expect(types[4]).toBe(ROW_TYPE.AGGREGATE);
  });

  test("«Malakaviy amaliyot» — bo'lim sarlavhasi (serialsiz, 4-qoida)", () => {
    expect(types[1]).toBe(ROW_TYPE.SECTION_HEADER);
  });

  test("kodli amaliyot fanlari — `practice` (fan sanog'iga kirmaydi)", () => {
    expect(types[2]).toBe(ROW_TYPE.PRACTICE);
    expect(types[3]).toBe(ROW_TYPE.PRACTICE);
    expect(types.filter(isCountableSubject)).toHaveLength(0);
  });
});

describe("qoidalar tartibi va chegara holatlari", () => {
  test("KOD har doim ustun — kodli «Jami» ham fan", () => {
    expect(rowTypeOf(r("", "FS1104", "Jami"), 0, [])).toBe(ROW_TYPE.SUBJECT);
  });

  test("🔴 kodsiz HAQIQIY fan sarlavha DEB HISOBLANMAYDI (D-2 qarori)", () => {
    const rows = [r("1.1.05", "", "Kodsiz haqiqiy fan")];
    expect(classifyRows(rows)).toEqual([ROW_TYPE.SUBJECT]);
  });

  test("prefiks faqat KEYINGI qatorlarda qidiriladi", () => {
    const rows = [r("1.1.01", "FS1104", "Falsafa"), r("1.1", "", "Modul")];
    expect(classifyRows(rows)[1]).toBe(ROW_TYPE.SUBJECT);
  });

  test("qisman moslik prefiks emas ('1.1' ≠ '1.10.01')", () => {
    const rows = [r("1.1", "", "Modul"), r("1.10.01", "X1", "Fan")];
    expect(classifyRows(rows)[0]).toBe(ROW_TYPE.SUBJECT);
  });

  test("bo'sh/noto'g'ri ma'lumotda yiqilmaydi", () => {
    expect(classifyRows(undefined)).toEqual([]);
    expect(classifyRows([{}])).toEqual([ROW_TYPE.SUBJECT]);
  });
});

describe("annotateBlocks", () => {
  test("har qatorga rowType qo'shadi, boshqa maydonlarga tegmaydi", () => {
    const doc = { blocks: [{ sciences: [...TF2] }] };
    annotateBlocks(doc);
    expect(doc.blocks[0].sciences.map((x) => x.rowType)).toEqual([
      ROW_TYPE.AGGREGATE,
      ROW_TYPE.SECTION_HEADER,
      ROW_TYPE.PRACTICE,
      ROW_TYPE.PRACTICE,
      ROW_TYPE.AGGREGATE,
    ]);
    expect(doc.blocks[0].sciences[2].code).toBe("TM104");
  });

  test("bloksiz hujjatda yiqilmaydi", () => {
    expect(() => annotateBlocks({})).not.toThrow();
    expect(() => annotateBlocks(null)).not.toThrow();
  });
});

describe("isPrefixOfAny — tartibga bog'liq emas", () => {
  test("boshqa qatorning prefiksi bo'lsa — true (tartibidan qat'iy nazar)", () => {
    expect(isPrefixOfAny("1.2.", ["1.2.01", "1.2.02"])).toBe(true);
    expect(isPrefixOfAny("1.2.01", ["1.2.", "1.2.01"])).toBe(false);
  });

  test("bo'sh serial — har doim false", () => {
    expect(isPrefixOfAny("", ["1.1.01"])).toBe(false);
    expect(isPrefixOfAny(null, ["1.1.01"])).toBe(false);
  });

  test("qisman moslik prefiks emas ('1.1' ≠ '1.10.01')", () => {
    expect(isPrefixOfAny("1.1", ["1.10.01"])).toBe(false);
  });
});

describe("buildBlockSerialIndexFromBlocks / buildBlockSerialIndex", () => {
  test("blockCode bo'yicha guruhlaydi, bo'sh serial tashlab ketiladi", () => {
    const blocks = [
      { blockCode: "MF1", sciences: [r("1.1", "", "M"), r("1.1.01", "X1", "F")] },
      { blockCode: "TF2", sciences: [r("", "", "amaliyot"), r(null, null, "slot")] },
    ];
    const idx = buildBlockSerialIndexFromBlocks(blocks);
    expect(idx.get("MF1")).toEqual(["1.1", "1.1.01"]);
    expect(idx.get("TF2")).toEqual([]);
  });

  test("`semesters` Map/obyektidan BARCHA semestrlarni birlashtiradi (cross-semester)", () => {
    const semestersMap = {
      1: { blocks: [{ blockCode: "MF1", sciences: [r("1.1", "", "M")] }] },
      2: { blocks: [{ blockCode: "MF1", sciences: [r("1.1.01", "X1", "F")] }] },
    };
    const idx = buildBlockSerialIndex(semestersMap);
    expect(idx.get("MF1")).toEqual(["1.1", "1.1.01"]);
  });

  test("Mongoose Map ham qabul qilinadi (obyektga aylantiradi)", () => {
    const semestersMap = new Map([
      ["1", { blocks: [{ blockCode: "MF1", sciences: [r("1.1", "", "M")] }] }],
    ]);
    const idx = buildBlockSerialIndex(semestersMap);
    expect(idx.get("MF1")).toEqual(["1.1"]);
  });
});

describe("isDoubleCountedHeader — P0-01 'Jami' filtri (rowTypeOf'dan MUSTAQIL)", () => {
  test("aggregate qator ('Jami'/'HAMMASI') — true", () => {
    expect(isDoubleCountedHeader(r("", "", "Jami"), [])).toBe(true);
    expect(isDoubleCountedHeader(r("", "", "HAMMASI"), [])).toBe(true);
  });

  test("strukturaviy sarlavha (boshqa qatorning prefiksi) — true", () => {
    expect(isDoubleCountedHeader(r("1.2.", "", "Modul"), ["1.2.01"])).toBe(
      true,
    );
  });

  test("🔴 kodsiz, science'siz, LEKIN bolasi yo'q — false (LEAF, real o'lchov)", () => {
    const row = { serialNumber: "", code: "", title: "Malakaviy amaliyot" };
    expect(isDoubleCountedHeader(row, [])).toBe(false);
  });

  test("oddiy fan (kod bor) — false", () => {
    expect(isDoubleCountedHeader(r("1.2.01", "FA1", "Fan"), [])).toBe(false);
  });
});
