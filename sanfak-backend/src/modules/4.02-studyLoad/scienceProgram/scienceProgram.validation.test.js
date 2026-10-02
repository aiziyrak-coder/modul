const {
  approveScienceProgramSchema,
  PROTOCOL_RX,
} = require("./scienceProgram.validation");

const TEMP_ERI_SIGNATURE = "TEMP_ERI_PLACEHOLDER";

describe("scienceProgram.validation — approveScienceProgramSchema", () => {
  test("frontend payload'i: signature stub + protocol raqam — qabul qilinadi", () => {
    const { error, value } = approveScienceProgramSchema.validate({
      signature: TEMP_ERI_SIGNATURE,
      protocol: " 12 ",
    });
    expect(error).toBeUndefined();
    expect(value.protocol).toBe("12");
  });

  test.each(["1", "12", "3/2026", "7-A", "2026/12"])(
    "ruxsat etilgan format: %s",
    (protocol) => {
      expect(PROTOCOL_RX.test(protocol)).toBe(true);
      expect(approveScienceProgramSchema.validate({ protocol }).error).toBeUndefined();
    },
  );

  test("butun gap (QA 2026-09-03 holati) — RAD etiladi", () => {
    const { error } = approveScienceProgramSchema.validate({
      signature: TEMP_ERI_SIGNATURE,
      protocol:
        "Institut Ilmiy kengashining 2026-yil 2-sentabrdagi 1-son bayonnomasi asosida tasdiqlandi.",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Bayonnoma raqami/);
  });

  test.each(["abc", "12 34", "№12", "12/", "/12"])("noto'g'ri format: %s", (protocol) => {
    expect(approveScienceProgramSchema.validate({ protocol }).error).toBeDefined();
  });

  test("20 belgidan uzun — RAD etiladi", () => {
    const { error } = approveScienceProgramSchema.validate({ protocol: "1".repeat(21) });
    expect(error).toBeDefined();
  });

  test("bo'sh body (submit/reopen shoxlari) va protocol='' — qabul qilinadi", () => {
    expect(approveScienceProgramSchema.validate({}).error).toBeUndefined();
    expect(approveScienceProgramSchema.validate({ protocol: "" }).error).toBeUndefined();
    expect(approveScienceProgramSchema.validate({ protocol: null }).error).toBeUndefined();
  });

  test("ERI maydonlari (eriSignature/eriSerial) rad etilmaydi", () => {
    const { error } = approveScienceProgramSchema.validate({
      eriSignature: TEMP_ERI_SIGNATURE,
      eriSerial: "ABC123",
      protocol: "5",
    });
    expect(error).toBeUndefined();
  });

  test("noma'lum maydon — RAD etiladi (mass-assignment himoyasi)", () => {
    const { error } = approveScienceProgramSchema.validate({ status: "approved" });
    expect(error).toBeDefined();
  });
});

const {
  createscienceProgramSchema,
  updatescienceProgramSchema,
  v142Schema,
} = require("./scienceProgram.validation");
const { TOPIC_TYPES, EDUCATION_FORMS } = require("./scienceProgram.model");

const SCIENCE_ID = "cccccccccccccccccccccccc";

const v142Base = {
  educationForm: "kunduzgi",
  prerequisites: [{ code: "2.07", title: "Fiziologiya" }],
  outcomes: {
    competencies: [{ code: "TN1", text: "Klinik fikrlash" }],
    skills: [{ code: "TN4", text: "Og'riqsizlantirish usulini tanlash" }],
  },
  topics: [
    { type: "maruza", code: "M1", title: "Anesteziologiya tarixi", hours: 2, refs: [1, 2] },
    { type: "amaliy", code: "A1", title: "Og'riqsizlantirish usullari", hours: 6, refs: [] },
  ],
  independentTasks: [{ order: 1, title: "Referat", hours: 12 }],
  techMethods: ["ma'ruzalar", "interfaol keys-stadilar"],
  grading: { a: ["86–100"], b: ["71–85"], d: ["55–70"], e: ["0–54"] },
  authors: [
    { fio: "Axmadaliyev Sh.Sh.", degree: "PhD", title: null, department: "Anesteziologiya", position: "Kafedra mudiri" },
  ],
  reviewers: [{ fio: "Fattoxov N.X.", degree: "DSc" }],
  councilProtocol: { date: "2026-08-20", number: "6" },
  departmentProtocol: { date: "2026-08-15", number: "7" },
};

const many = (n, item) => Array.from({ length: n }, () => ({ ...item }));

describe("scienceProgram.validation — v142 bloki, CREATE (Joi.when(formVersion))", () => {
  test("formVersion:'v142' + to'liq v142 bloki — qabul qilinadi", () => {
    const { error } = createscienceProgramSchema.validate({
      science: SCIENCE_ID,
      formVersion: "v142",
      language: "O'zbek",
      v142: v142Base,
    });
    expect(error).toBeUndefined();
  });

  test("formVersion:'v142', v142 bloki YO'Q — qabul qilinadi (blok ixtiyoriy)", () => {
    const { error } = createscienceProgramSchema.validate({
      science: SCIENCE_ID,
      formVersion: "v142",
    });
    expect(error).toBeUndefined();
  });

  test("formVersion:'v259' + v142 → RAD (forbidden), xabar o'zbekcha va 142-sonni ko'rsatadi", () => {
    const { error } = createscienceProgramSchema.validate({
      science: SCIENCE_ID,
      formVersion: "v259",
      v142: v142Base,
    });
    expect(error).toBeDefined();
    expect(error.details[0].path).toEqual(["v142"]);
    expect(error.message).toMatch(/142-son/);
  });

  test("formVersion berilmagan (default v259) + v142 → RAD", () => {
    const { error } = createscienceProgramSchema.validate({
      science: SCIENCE_ID,
      v142: v142Base,
    });
    expect(error).toBeDefined();
    expect(error.details[0].path).toEqual(["v142"]);
  });

  test("REGRESSIYA: v259 payload'i v142'siz avvalgidek o'tadi", () => {
    const { error } = createscienceProgramSchema.validate({
      science: SCIENCE_ID,
      title: "Anatomiya",
      topics: [{ title: "Kirish" }],
    });
    expect(error).toBeUndefined();
  });
});

describe("scienceProgram.validation — v142 bloki, UPDATE (D-5 `.fork([\"v142\"])` tuzog'i)", () => {
  test("PUT: v142 bloki formVersion'SIZ qabul qilinadi (aks holda har v142 PUT 400 bo'lardi)", () => {
    const { error } = updatescienceProgramSchema.validate({ v142: v142Base });
    expect(error).toBeUndefined();
  });

  test("PUT: formVersion hamon RAD etiladi (xavfsizlik qulfi o'zgarmagan)", () => {
    const { error } = updatescienceProgramSchema.validate({
      formVersion: "v142",
      v142: v142Base,
    });
    expect(error).toBeDefined();
    expect(error.details[0].path).toEqual(["formVersion"]);
  });

  test("PUT: v142 ichidagi cheklov hamon ishlaydi (fork sxemani yumshatmagan)", () => {
    const { error } = updatescienceProgramSchema.validate({
      v142: { topics: [{ type: "zzz", title: "X" }] },
    });
    expect(error).toBeDefined();
    expect(error.details[0].path).toEqual(["v142", "topics", 0, "type"]);
  });
});

describe("scienceProgram.validation — v142Schema cheklovlari (§3.3)", () => {
  test("to'liq namuna o'tadi; hours default 0", () => {
    const { error, value } = v142Schema.validate({
      ...v142Base,
      topics: [{ type: "seminar", title: "S" }],
    });
    expect(error).toBeUndefined();
    expect(value.topics[0].hours).toBe(0);
  });

  test.each(TOPIC_TYPES)("topics[].type '%s' — modeldagi lug'at qabul qilinadi", (type) => {
    expect(
      v142Schema.validate({ topics: [{ type, title: "T" }] }).error,
    ).toBeUndefined();
  });

  test("topics[].type noma'lum yoki berilmagan → RAD (required + valid)", () => {
    expect(v142Schema.validate({ topics: [{ type: "lecture", title: "T" }] }).error).toBeDefined();
    expect(v142Schema.validate({ topics: [{ title: "T" }] }).error).toBeDefined();
  });

  test("topics[].title bo'sh/yo'q → RAD", () => {
    expect(v142Schema.validate({ topics: [{ type: "maruza" }] }).error).toBeDefined();
    expect(v142Schema.validate({ topics: [{ type: "maruza", title: "" }] }).error).toBeDefined();
  });

  test("topics[].hours: manfiy ❌ · kasr ❌ · 999 ✅ · 1000 ❌", () => {
    const t = (hours) => v142Schema.validate({ topics: [{ type: "maruza", title: "T", hours }] }).error;
    expect(t(-1)).toBeDefined();
    expect(t(1.5)).toBeDefined();
    expect(t(999)).toBeUndefined();
    expect(t(1000)).toBeDefined();
  });

  test("topics[].code 8 belgidan uzun → RAD; refs 21 ta → RAD; refs 0 → RAD", () => {
    expect(v142Schema.validate({ topics: [{ type: "maruza", title: "T", code: "M12345678" }] }).error).toBeDefined();
    expect(v142Schema.validate({ topics: [{ type: "maruza", title: "T", refs: Array.from({ length: 21 }, (_, i) => i + 1) }] }).error).toBeDefined();
    expect(v142Schema.validate({ topics: [{ type: "maruza", title: "T", refs: [0] }] }).error).toBeDefined();
  });

  test("topics 300 ✅ · 301 ❌", () => {
    const topic = { type: "maruza", title: "T" };
    expect(v142Schema.validate({ topics: many(300, topic) }).error).toBeUndefined();
    expect(v142Schema.validate({ topics: many(301, topic) }).error).toBeDefined();
  });

  test("prerequisites / outcomes.* / independentTasks — 50 ✅ · 51 ❌", () => {
    expect(v142Schema.validate({ prerequisites: many(50, { title: "F" }) }).error).toBeUndefined();
    expect(v142Schema.validate({ prerequisites: many(51, { title: "F" }) }).error).toBeDefined();
    expect(v142Schema.validate({ outcomes: { competencies: many(51, { text: "K" }) } }).error).toBeDefined();
    expect(v142Schema.validate({ outcomes: { skills: many(51, { text: "K" }) } }).error).toBeDefined();
    expect(v142Schema.validate({ independentTasks: many(51, { title: "M" }) }).error).toBeDefined();
  });

  test("prerequisites[].title / outcomes[].text / independentTasks[].title — required", () => {
    expect(v142Schema.validate({ prerequisites: [{ code: "KI106" }] }).error).toBeDefined();
    expect(v142Schema.validate({ outcomes: { competencies: [{ code: "TN1" }] } }).error).toBeDefined();
    expect(v142Schema.validate({ independentTasks: [{ order: 1, hours: 2 }] }).error).toBeDefined();
  });

  test("techMethods / grading.* — massiv 30 ✅ · 31 ❌; element 500 ✅ · 501 belgi ❌", () => {
    expect(v142Schema.validate({ techMethods: Array(30).fill("x") }).error).toBeUndefined();
    expect(v142Schema.validate({ techMethods: Array(31).fill("x") }).error).toBeDefined();
    expect(v142Schema.validate({ techMethods: ["x".repeat(500)] }).error).toBeUndefined();
    expect(v142Schema.validate({ techMethods: ["x".repeat(501)] }).error).toBeDefined();
    expect(v142Schema.validate({ grading: { a: Array(31).fill("x") } }).error).toBeDefined();
    expect(v142Schema.validate({ grading: { e: ["x".repeat(501)] } }).error).toBeDefined();
    expect(v142Schema.validate({ grading: { c: ["x"] } }).error).toBeDefined();
  });

  test("authors / reviewers — 20 ✅ · 21 ❌; fio required", () => {
    expect(v142Schema.validate({ authors: many(20, { fio: "A.B." }) }).error).toBeUndefined();
    expect(v142Schema.validate({ authors: many(21, { fio: "A.B." }) }).error).toBeDefined();
    expect(v142Schema.validate({ reviewers: many(21, { fio: "A.B." }) }).error).toBeDefined();
    expect(v142Schema.validate({ authors: [{ degree: "PhD" }] }).error).toBeDefined();
    expect(v142Schema.validate({ reviewers: [{ fio: "" }] }).error).toBeDefined();
  });

  test.each(["6", "12", "3/2026", "7-A"])(
    "*Protocol.number '%s' — mavjud PROTOCOL_RX bilan qabul qilinadi",
    (number) => {
      expect(v142Schema.validate({ councilProtocol: { number } }).error).toBeUndefined();
      expect(v142Schema.validate({ departmentProtocol: { number } }).error).toBeUndefined();
    },
  );

  test.each(["abc", "12 34", "№6", "6/"])("*Protocol.number '%s' → RAD", (number) => {
    expect(v142Schema.validate({ councilProtocol: { number } }).error).toBeDefined();
  });

  test("*Protocol.number 21 belgi → RAD; ''/null → ✅; trim qilinadi", () => {
    expect(v142Schema.validate({ councilProtocol: { number: "1".repeat(21) } }).error).toBeDefined();
    expect(v142Schema.validate({ councilProtocol: { number: "" } }).error).toBeUndefined();
    expect(v142Schema.validate({ councilProtocol: { number: null } }).error).toBeUndefined();
    expect(v142Schema.validate({ councilProtocol: { number: " 6 " } }).value.councilProtocol.number).toBe("6");
  });

  test("*Protocol.date — ISO sana ✅ · null ✅ · 'kecha' ❌", () => {
    expect(v142Schema.validate({ councilProtocol: { date: "2026-08-20" } }).error).toBeUndefined();
    expect(v142Schema.validate({ councilProtocol: { date: null } }).error).toBeUndefined();
    expect(v142Schema.validate({ councilProtocol: { date: "kecha" } }).error).toBeDefined();
  });

  test.each(EDUCATION_FORMS)("educationForm '%s' — modeldagi lug'at qabul qilinadi", (educationForm) => {
    expect(v142Schema.validate({ educationForm }).error).toBeUndefined();
  });

  test("educationForm noma'lum → RAD", () => {
    expect(v142Schema.validate({ educationForm: "onlayn" }).error).toBeDefined();
  });

  test("D-1 qulfi: `v142.language` YO'Q — noma'lum kalit RAD etiladi (til top-level `language`da)", () => {
    const { error } = v142Schema.validate({ language: "O'zbek" });
    expect(error).toBeDefined();
    expect(error.details[0].path).toEqual(["language"]);
  });

  test("D-3 qulfi: `v142.responsible`/`reviewer` (TitleDesc) yo'q — strukturali authors/reviewers ishlatiladi", () => {
    expect(v142Schema.validate({ responsible: { desc: "x" } }).error).toBeDefined();
    expect(v142Schema.validate({ reviewer: { desc: "x" } }).error).toBeDefined();
  });
});
