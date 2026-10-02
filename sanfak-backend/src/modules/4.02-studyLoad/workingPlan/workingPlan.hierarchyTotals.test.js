const WorkingPlanModel = require("./workingPlan.model");
const {
  buildBlockSerialIndex,
} = require("#modules/4.02-studyLoad/_shared/planRowType");

const { computeSemesterTotals } = WorkingPlanModel;

const hourParticle = (hour) => [
  { slug: "umumiy_yuklamaning_hajmi_soat", title: "Umumiy", value: hour },
];

const mf1Sem1 = () => ({
  blockCode: "MF1",
  title: "Majburiy fanlar",
  sciences: [
    { serialNumber: "1.2.", code: "", title: "Klinika oldi fanlari moduli", totalCredit: 13, particle: hourParticle(390) },
    { serialNumber: "1.2.12", code: "KAN1504", title: "Клиник анатомия", science: "s1", totalCredit: 4, particle: hourParticle(120) },
    { serialNumber: "1.2.13", code: "PAN15-606", title: "Patologik anatomiya 1,2", science: "s2", totalCredit: 3, particle: hourParticle(90) },
    { serialNumber: "1.2.14", code: "PFZ15-606", title: "Patologik fiziologiya 1,2", science: "s3", totalCredit: 3, particle: hourParticle(90) },
    { serialNumber: "1.2.15", code: "FR15-606", title: "Farmakologiya 1,2", science: "s4", totalCredit: 3, particle: hourParticle(90) },
    { serialNumber: "1.3.", code: "", title: "Klinik modullar", totalCredit: 10, particle: hourParticle(300) },
    { serialNumber: "1.3.1", code: "", title: "Terapiya yo'nalishi", totalCredit: 4, particle: hourParticle(120) },
    { serialNumber: "1.3.1.02", code: "IKP15-608", title: "Ichki kasalliklar propedevtikasi 1,2", science: "s5", totalCredit: 4, particle: hourParticle(120) },
    { serialNumber: "1.3.2", code: "", title: "Akusherlik-ginekologiya va pediatriya yo'nalishi", totalCredit: 3, particle: hourParticle(90) },
    { serialNumber: "1.3.2.02", code: "BKP15-606", title: "Bolalar kasalliklari propedevtikasi 1,2", science: "s6", totalCredit: 3, particle: hourParticle(90) },
    { serialNumber: "1.3.3", code: "", title: "Xirurgiya yo'nalishi", totalCredit: 3, particle: hourParticle(90) },
    { serialNumber: "1.3.3.01", code: "UX15-606", title: "Umumiy xirurgiya 1,2", science: "s7", totalCredit: 3, particle: hourParticle(90) },
  ],
});

const tf2Sem1 = () => ({
  blockCode: "TF2",
  title: "Tanlov fanlar",
  sciences: [
    { serialNumber: "", code: "", title: "Malakaviy amaliyot", totalCredit: 2, particle: hourParticle(0) },
    { serialNumber: "", code: "ICHM304", title: "Ishlab chiqarish amaliyoti", totalCredit: 2, particle: hourParticle(0) },
    { serialNumber: null, code: null, title: "Tanlov fani (tanlanmagan)", totalCredit: 5, particle: hourParticle(0) },
  ],
});

describe("P0-01 — institute-chain 6a97f7de99981540c681db28 (haqiqiy ma'lumot)", () => {
  test("1-semestr: 1680h/65kr (eski, ierarxiya bilan) → 690h/32kr (to'g'ri)", () => {
    const naiveSum = [...mf1Sem1().sciences, ...tf2Sem1().sciences].reduce(
      (acc, s) => {
        acc.hour += s.particle[0].value;
        acc.credit += s.totalCredit;
        return acc;
      },
      { hour: 0, credit: 0 },
    );
    expect(naiveSum).toEqual({ hour: 1680, credit: 65 });

    const sem1 = { blocks: [mf1Sem1(), tf2Sem1()] };
    computeSemesterTotals(sem1);

    expect(sem1.blocksTotal.totalHour).toBe(690);
    expect(sem1.blocksTotal.totalCredit).toBe(32);
  });

  test("2-semestr: 1800h/67kr (eski) → 750h/32kr (to'g'ri)", () => {
    const mf1Sem2 = () => ({
      blockCode: "MF1",
      title: "Majburiy fanlar",
      sciences: [
        { serialNumber: "1.2.", code: "", title: "Klinika oldi fanlari moduli", totalCredit: 15, particle: hourParticle(450) },
        { serialNumber: "1.2.13", code: "PAN15-606", title: "Patologik anatomiya 1,2", science: "s2", totalCredit: 3, particle: hourParticle(90) },
        { serialNumber: "1.2.14", code: "PFZ15-606", title: "Patologik fiziologiya 1,2", science: "s3", totalCredit: 3, particle: hourParticle(90) },
        { serialNumber: "1.2.15", code: "FR15-606", title: "Farmakologiya 1,2", science: "s4", totalCredit: 3, particle: hourParticle(90) },
        { serialNumber: "1.2.17", code: "JSMM1606", title: "Jamoat salomatligi. Marketing, menejment", science: "s8", totalCredit: 6, particle: hourParticle(180) },
        { serialNumber: "1.3.", code: "", title: "Klinik modullar", totalCredit: 10, particle: hourParticle(300) },
        { serialNumber: "1.3.1", code: "", title: "Terapiya yo'nalishi", totalCredit: 4, particle: hourParticle(120) },
        { serialNumber: "1.3.1.02", code: "IKP15-608", title: "Ichki kasalliklar propedevtikasi 1,2", science: "s5", totalCredit: 4, particle: hourParticle(120) },
        { serialNumber: "1.3.2", code: "", title: "Akusherlik-ginekologiya va pediatriya yo'nalishi", totalCredit: 3, particle: hourParticle(90) },
        { serialNumber: "1.3.2.02", code: "BKP15-606", title: "Bolalar kasalliklari propedevtikasi 1,2", science: "s6", totalCredit: 3, particle: hourParticle(90) },
        { serialNumber: "1.3.3", code: "", title: "Xirurgiya yo'nalishi", totalCredit: 3, particle: hourParticle(90) },
        { serialNumber: "1.3.3.01", code: "UX15-606", title: "Umumiy xirurgiya 1,2", science: "s7", totalCredit: 3, particle: hourParticle(90) },
      ],
    });
    const tf2Sem2 = () => ({
      blockCode: "TF2",
      title: "Tanlov fanlar",
      sciences: [
        { serialNumber: "", code: "", title: "Malakaviy amaliyot", totalCredit: 2, particle: hourParticle(0) },
        { serialNumber: "", code: "ICHM304", title: "Ishlab chiqarish amaliyoti", totalCredit: 2, particle: hourParticle(0) },
        { serialNumber: null, code: null, title: "Tanlov fani (tanlanmagan)", totalCredit: 3, particle: hourParticle(0) },
      ],
    });

    const sem2 = { blocks: [mf1Sem2(), tf2Sem2()] };
    computeSemesterTotals(sem2);

    expect(sem2.blocksTotal.totalHour).toBe(750);
    expect(sem2.blocksTotal.totalCredit).toBe(32);
  });
});

describe("P0-01 — tekis (sarlavhasiz) reja: yig'indi O'ZGARMAYDI", () => {
  test("faqat leaf fanlar — natija naive summaga TENG (1.00×)", () => {
    const flatBlock = {
      blockCode: "MFI",
      title: "Majburiy fanlar",
      sciences: [
        { serialNumber: "1", code: "FA1", title: "Fan A", totalCredit: 4, particle: hourParticle(120) },
        { serialNumber: "2", code: "FA2", title: "Fan B", totalCredit: 3, particle: hourParticle(90) },
        { serialNumber: "3", code: "FA3", title: "Fan C", totalCredit: 3, particle: hourParticle(90) },
      ],
    };
    const sem = { blocks: [flatBlock] };
    computeSemesterTotals(sem);

    expect(sem.blocksTotal.totalHour).toBe(300);
    expect(sem.blocksTotal.totalCredit).toBe(10);
  });
});

describe("P0-01 — sarlavhaning bolalari BOSHQA semestrda (cross-semester)", () => {
  test("blockSerialIndex BARCHA semestrlardan qurilsa — sarlavha to'g'ri chiqariladi", () => {
    const sem1 = {
      blocks: [
        {
          blockCode: "MF1",
          sciences: [
            { serialNumber: "1.1.", code: "", title: "Modul", totalCredit: 4, particle: hourParticle(100) },
          ],
        },
      ],
    };
    const sem2 = {
      blocks: [
        {
          blockCode: "MF1",
          sciences: [
            { serialNumber: "1.1.01", code: "FA9", title: "Fan D", totalCredit: 4, particle: hourParticle(100) },
          ],
        },
      ],
    };
    const semestersMap = { 1: sem1, 2: sem2 };
    const blockSerialIndex = buildBlockSerialIndex(semestersMap);

    computeSemesterTotals(sem1, false, blockSerialIndex);
    expect(sem1.blocksTotal.totalHour).toBe(0);
    expect(sem1.blocksTotal.totalCredit).toBe(0);

    const sem1Solo = {
      blocks: [
        {
          blockCode: "MF1",
          sciences: [
            { serialNumber: "1.1.", code: "", title: "Modul", totalCredit: 4, particle: hourParticle(100) },
          ],
        },
      ],
    };
    computeSemesterTotals(sem1Solo);
    expect(sem1Solo.blocksTotal.totalHour).toBe(100);
  });
});

describe("P0-01 — zaxira signal (`!code && !science`) ATAYLAB qo'llanilmagan", () => {
  test("kodsiz, science'siz, LEKIN bolasi yo'q qator — LEAF sifatida SANaladi", () => {
    const sem = {
      blocks: [
        {
          blockCode: "TF2",
          sciences: [
            { serialNumber: "", code: "", title: "Malakaviy amaliyot", totalCredit: 2, particle: hourParticle(0) },
          ],
        },
      ],
    };
    computeSemesterTotals(sem);
    expect(sem.blocksTotal.totalCredit).toBe(2);
  });
});
