const {
  isClinicalSectionTitle,
  collectClinicalPrefixes,
  isClinicalRow,
  applyClinicalSplit,
} = require("./clinicalPractice");

const SHARE = 0.5;

const r = (serialNumber, code, title) => ({ serialNumber, code, title });

describe("isClinicalSectionTitle", () => {
  test("'Klinik modullar' — klinik", () => {
    expect(isClinicalSectionTitle("Klinik modullar")).toBe(true);
  });

  test("'Klinik (mutaxassislik) fanlar moduli' — klinik", () => {
    expect(isClinicalSectionTitle("Klinik (mutaxassislik) fanlar moduli")).toBe(
      true,
    );
  });

  test("'Klinika oldi fanlari moduli' — klinik EMAS (negative lookahead)", () => {
    expect(isClinicalSectionTitle("Klinika oldi fanlari moduli")).toBe(false);
  });

  test("'Klinik farmakologiya' — sarlavha bo'lganda ham bu predikat matn bo'yicha ishlaydi (chaqiruvchi faqat SECTION_HEADER qatoriga qo'llaydi)", () => {
    expect(isClinicalSectionTitle("Klinik farmakologiya")).toBe(true);
  });

  test("bo'sh/undefined — false", () => {
    expect(isClinicalSectionTitle("")).toBe(false);
    expect(isClinicalSectionTitle(undefined)).toBe(false);
  });
});

describe("collectClinicalPrefixes — MF1 uslubidagi blok (planRowType.test.js bilan bir xil fixture)", () => {
  const MF1 = [
    r("1.1", "", "Ijtimoiy-gumanitar fanlar moduli"),
    r("1.1.01", "O‘YT1104", "O‘zbekistonning eng yangi tarixi"),
    r("1.2.", "", "Klinika oldi fanlari moduli"),
    r("1.2.01", "TBUG1106", "Tibbiy biologiya. Umumiy genetika"),
    r("1.3.", "", "Klinik modullar"),
    r("1.3.1", "", "Terapiya yo‘nalishi"),
    r("1.3.1.01", "TKK1104", "Tibbiyot kasbiga kirish"),
  ];

  test("faqat '1.3.' prefiksi yig'iladi ('1.2.' — Klinika oldi, klinik emas)", () => {
    const prefixes = collectClinicalPrefixes(MF1);
    expect(prefixes).toEqual(new Set(["1.3."]));
  });

  test("'1.3.1.01' (Terapiya yo'nalishi ostidagi fan) — klinik (prefiks '1.3.')", () => {
    const prefixes = collectClinicalPrefixes(MF1);
    expect(isClinicalRow(MF1[6], prefixes)).toBe(true);
  });

  test("'1.2.01' (Klinika oldi ostidagi fan) — klinik EMAS", () => {
    const prefixes = collectClinicalPrefixes(MF1);
    expect(isClinicalRow(MF1[3], prefixes)).toBe(false);
  });

  test("'1.1.01' (klinik bo'limga umuman tegishli emas) — klinik EMAS", () => {
    const prefixes = collectClinicalPrefixes(MF1);
    expect(isClinicalRow(MF1[1], prefixes)).toBe(false);
  });
});

describe("collectClinicalPrefixes — sarlavhasiz (tekis T-P uslubi) blok", () => {
  const FLAT = [
    r("", "FA1002", "Kommunal gigiyena"),
    r("", "AN11-312", "Odam anatomiyasi"),
  ];

  test("prefiks to'plami bo'sh", () => {
    expect(collectClinicalPrefixes(FLAT)).toEqual(new Set());
  });

  test("hech qanday qator klinik deb tanilmaydi", () => {
    const prefixes = collectClinicalPrefixes(FLAT);
    expect(isClinicalRow(FLAT[0], prefixes)).toBe(false);
    expect(isClinicalRow(FLAT[1], prefixes)).toBe(false);
  });
});

describe("collectClinicalPrefixes — bo'sh serialNumber'li klinik sarlavha", () => {
  test("prefiks qo'shilmaydi", () => {
    const rows = [r("", "", "Klinik modullar"), r("", "TKK1104", "Fan")];
    expect(collectClinicalPrefixes(rows)).toEqual(new Set());
  });
});

describe("applyClinicalSplit — golden misollar (ADR-018 verifikatsiya ro'yxati)", () => {
  test("72 aud / ma'ruza 10 / amaliy 62 → klinik 36, amaliy 26 (blanka namunasi)", () => {
    const out = applyClinicalSplit(
      { lecture: 10, seminar: 0, laboratory: 0, practical: 62, clinical: 0 },
      { share: SHARE },
    );
    expect(out.clinical).toBe(36);
    expect(out.practical).toBe(26);
    expect(out.clamped).toBe(false);
    expect(out.derived).toBe(true);
  });

  test("36 aud / ma'ruza 8 / amaliy 28 → klinik 18, amaliy 10", () => {
    const out = applyClinicalSplit(
      { lecture: 8, seminar: 0, laboratory: 0, practical: 28, clinical: 0 },
      { share: SHARE },
    );
    expect(out.clinical).toBe(18);
    expect(out.practical).toBe(10);
  });

  test("45 aud / ma'ruza 12 / amaliy 33 → klinik 23 (toq son, yuqoriga), amaliy 10", () => {
    const out = applyClinicalSplit(
      { lecture: 12, seminar: 0, laboratory: 0, practical: 33, clinical: 0 },
      { share: SHARE },
    );
    expect(out.clinical).toBe(23);
    expect(out.practical).toBe(10);
    expect(out.clamped).toBe(false);
  });

  test("cheklov: jami 60 / ma'ruza 40 / amaliy 20 → klinik 20, amaliy 0, clamped=true", () => {
    const out = applyClinicalSplit(
      { lecture: 40, seminar: 0, laboratory: 0, practical: 20, clinical: 0 },
      { share: SHARE },
    );
    expect(out.clinical).toBe(20);
    expect(out.practical).toBe(0);
    expect(out.clamped).toBe(true);
  });

  test("kirishda clinical > 0 — split QILINMAYDI (reja o'z manbasini beradi)", () => {
    const input = {
      lecture: 10,
      seminar: 0,
      laboratory: 0,
      practical: 62,
      clinical: 5,
    };
    const out = applyClinicalSplit(input, { share: SHARE });
    expect(out).toEqual({ ...input, clamped: false, derived: false });
  });

  test("seminar/laboratoriya TEGILMAYDI — kiruvchi qiymat chiqishda ham bir xil", () => {
    const out = applyClinicalSplit(
      { lecture: 5, seminar: 7, laboratory: 9, practical: 20, clinical: 0 },
      { share: SHARE },
    );
    expect(out.lecture).toBe(5);
    expect(out.seminar).toBe(7);
    expect(out.laboratory).toBe(9);
  });

  test("invariant: chiqish yig'indisi == kirish yig'indisi", () => {
    const input = {
      lecture: 12,
      seminar: 4,
      laboratory: 6,
      practical: 33,
      clinical: 0,
    };
    const inputSum =
      input.lecture + input.seminar + input.laboratory + input.practical + input.clinical;
    const out = applyClinicalSplit(input, { share: SHARE });
    const outSum =
      out.lecture + out.seminar + out.laboratory + out.practical + out.clinical;
    expect(outSum).toBe(inputSum);
  });

  test("hamma nol — klinik 0, clamped false", () => {
    const out = applyClinicalSplit(
      { lecture: 0, seminar: 0, laboratory: 0, practical: 0, clinical: 0 },
      { share: SHARE },
    );
    expect(out.clinical).toBe(0);
    expect(out.practical).toBe(0);
    expect(out.clamped).toBe(false);
  });
});
