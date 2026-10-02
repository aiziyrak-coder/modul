const { checkApplyEligibility } = require("./applicationEligibility");
const { currentAcademicYear } = require("./academicYearWindow");

const YIL = currentAcademicYear();

const student = (over = {}) => ({
  totalScore: 100,
  scoresByYear: { [YIL]: 100 },
  course: 1,
  ...over,
});
const sch = (over = {}) => ({ active: true, minScore: 0, allowedCourses: [], ...over });

describe("checkApplyEligibility", () => {
  test("hamma shart bajarilsa null (ruxsat)", () => {
    expect(checkApplyEligibility(sch(), student())).toBeNull();
  });

  test("stipendiyasiz ariza (davlat granti) tekshirilmaydi", () => {
    expect(checkApplyEligibility(null, student())).toBeNull();
    expect(checkApplyEligibility(undefined, student())).toBeNull();
  });

  describe("active", () => {
    test("nofaol yo'nalishga ariza topshirib bo'lmaydi", () => {
      const r = checkApplyEligibility(sch({ active: false }), student());
      expect(r.message).toMatch(/faol emas/);
    });

    test("`active` yo'q bo'lsa bloklamaydi (ortga moslik)", () => {
      const s = sch();
      delete s.active;
      expect(checkApplyEligibility(s, student())).toBeNull();
    });
  });

  describe("deadline", () => {
    const DEADLINE = new Date("2026-12-31T00:00:00Z");

    test("muddat o'tgan bo'lsa rad etiladi", () => {
      const r = checkApplyEligibility(
        sch({ deadline: DEADLINE }),
        student(),
        new Date("2027-01-01T08:00:00Z"),
      );
      expect(r.message).toMatch(/muddati tugagan \(2026-12-31\)/);
    });

    test("muddat KUNI hali ochiq — 23:59 gacha", () => {
      expect(
        checkApplyEligibility(
          sch({ deadline: DEADLINE }),
          student(),
          new Date("2026-12-31T22:00:00Z"),
        ),
      ).toBeNull();
    });

    test("muddatdan oldin ochiq", () => {
      expect(
        checkApplyEligibility(
          sch({ deadline: DEADLINE }),
          student(),
          new Date("2026-08-21T10:00:00Z"),
        ),
      ).toBeNull();
    });

    test("`deadline` yo'q = cheksiz (eski yozuvlar)", () => {
      expect(checkApplyEligibility(sch(), student(), new Date("2099-01-01"))).toBeNull();
    });
  });

  describe("minScore", () => {
    test("ball kam bo'lsa rad etiladi — xabar SAQLANGAN", () => {
      const r = checkApplyEligibility(
        sch({ minScore: 60 }),
        student({ scoresByYear: { [YIL]: 5 } }),
      );
      expect(r.message).toMatch(/Ball yetarli emas: 5\/60/);
    });

    test("ball aynan minScore ga teng bo'lsa ruxsat", () => {
      expect(
        checkApplyEligibility(sch({ minScore: 60 }), student({ scoresByYear: { [YIL]: 60 } })),
      ).toBeNull();
    });

    test("🔴 UMRBOD ball darvozadan O'TKAZMAYDI", () => {
      const r = checkApplyEligibility(
        sch({ minScore: 60 }),
        student({ totalScore: 999, scoresByYear: { "2025/2026": 999 } }),
      );
      expect(r).not.toBeNull();
      expect(r.message).toMatch(/Ball yetarli emas: 0\/60/);
    });

    test("xabar QAYSI yil ekanini aytadi", () => {
      const r = checkApplyEligibility(
        sch({ minScore: 60 }),
        student({ scoresByYear: { "2020/2021": 999 } }),
      );
      expect(r.message).toContain(YIL);
    });

    test("`now` YILNI ham suradi — o'tgan yil bali o'sha yilda hisoblanadi", () => {
      expect(
        checkApplyEligibility(
          sch({ minScore: 50 }),
          student({ totalScore: 0, scoresByYear: { "2025/2026": 80 } }),
          new Date(2026, 0, 15),
        ),
      ).toBeNull();
    });

    test("xarita YO'Q bo'lsa ball 0 (eski yozuv, yiqilmaydi)", () => {
      const r = checkApplyEligibility(sch({ minScore: 1 }), { totalScore: 500, course: 1 });
      expect(r.message).toMatch(/Ball yetarli emas: 0\/1/);
    });

    test("mongoose `Map` shakli ham o'qiladi (hujjat `.lean()` siz kelganda)", () => {
      expect(
        checkApplyEligibility(sch({ minScore: 60 }), {
          course: 1,
          scoresByYear: new Map([[YIL, 80]]),
        }),
      ).toBeNull();
    });
  });

  describe("allowedCourses", () => {
    test("boshqa kurs talabasi rad etiladi", () => {
      const r = checkApplyEligibility(sch({ allowedCourses: ["1"] }), student({ course: 5 }));
      expect(r.message).toMatch(/faqat quyidagi kurslar uchun: 1/);
    });

    test("ruxsat etilgan kurs o'tadi (Number <-> String)", () => {
      expect(
        checkApplyEligibility(sch({ allowedCourses: ["1", "2"] }), student({ course: 2 })),
      ).toBeNull();
    });

    test("bo'sh massiv = cheklovsiz", () => {
      expect(checkApplyEligibility(sch({ allowedCourses: [] }), student({ course: 6 }))).toBeNull();
    });

    test("maydonning o'zi yo'q = cheklovsiz (eski yozuvlar)", () => {
      const s = sch();
      delete s.allowedCourses;
      expect(checkApplyEligibility(s, student({ course: 6 }))).toBeNull();
    });

    test("kursi belgilanmagan talaba cheklangan stipendiyaga o'tolmaydi", () => {
      const r = checkApplyEligibility(sch({ allowedCourses: ["1"] }), student({ course: null }));
      expect(r).not.toBeNull();
    });

    const C1 = "69df7a8f94bda50c83a1d4b1";
    const C5 = "69df7a8f94bda50c83a1d4b5";

    test("ref mos kelsa o'tadi — satr mos kelmasa ham", () => {
      const r = checkApplyEligibility(
        sch({ allowedCourses: ["1-kurs"], allowedCourseIds: [C1] }),
        student({ course: 1, courseId: C1 }),
      );
      expect(r).toBeNull();
    });

    test("ref mos kelmasa, lekin SATR mos kelsa — o'tadi (backfill ishlamagan yozuv)", () => {
      const r = checkApplyEligibility(
        sch({ allowedCourses: ["1"], allowedCourseIds: [C1] }),
        student({ course: 1, courseId: null }),
      );
      expect(r).toBeNull();
    });

    test("na ref, na satr mos kelmasa — rad etiladi", () => {
      const r = checkApplyEligibility(
        sch({ allowedCourses: ["1"], allowedCourseIds: [C1] }),
        student({ course: 5, courseId: C5 }),
      );
      expect(r).not.toBeNull();
      expect(r.message).toMatch(/faqat quyidagi kurslar uchun/);
    });

    test("cheklov borligini SATR ro'yxati belgilaydi, id ro'yxati emas", () => {
      const r = checkApplyEligibility(
        sch({ allowedCourses: ["mag-1"], allowedCourseIds: [] }),
        student({ course: 1, courseId: C1 }),
      );
      expect(r).not.toBeNull();
    });

    test("`mag-1` hech qanday kurs qiymatiga mos kelmaydi — mavjud holat qulflandi", () => {
      const r = checkApplyEligibility(sch({ allowedCourses: ["mag-1"] }), student({ course: 1 }));
      expect(r).not.toBeNull();
    });
  });

  describe("tartib — eng aniq sabab birinchi qaytadi", () => {
    test("nofaol + muddat o'tgan bo'lsa 'faol emas' deyiladi", () => {
      const r = checkApplyEligibility(
        sch({ active: false, deadline: new Date("2020-01-01") }),
        student(),
        new Date("2026-08-21"),
      );
      expect(r.message).toMatch(/faol emas/);
    });
  });
});
