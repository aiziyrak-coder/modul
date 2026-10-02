const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");

const ScienceProgram = require("./scienceProgram.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./scienceProgram.controller");

const SCIENCE_ID = new mongoose.Types.ObjectId();
const AY_ID = new mongoose.Types.ObjectId();
const WS_ID = new mongoose.Types.ObjectId();

const PDF_KNOWN_SLUGS = [
  "maruza",
  "seminar",
  "laboratoriya",
  "amaliy",
  "klinik_amaliyot",
  "mustaqil",
];

const livingParticle = () => [
  { slug: "soat", title: "soat", canonical: "hour", value: 180 },
  { slug: "foiz", title: "%", canonical: "percent", value: 10 },
  { slug: "jami", title: "Jami", canonical: "total", value: 120 },
  { slug: "maruza", title: "Ma'ruza", canonical: "lecture", value: 30 },
  { slug: "seminar", title: "Seminar", canonical: "seminar", value: 20 },
  {
    slug: "laboratoriya_mashg_uloti",
    title: "Laboratoriya mashg' uloti",
    canonical: "laboratory",
    value: 10,
  },
  {
    slug: "amaliy_mashg_ulot",
    title: "Amaliy mashg' ulot",
    canonical: "practical",
    value: 60,
  },
  {
    slug: "mustaqil_ta_lim",
    title: "Mustaqil ta' lim",
    canonical: "independent",
    value: 60,
  },
];

const wpFixture = (block = {}, sci = {}) => ({
  workingSchedule: { academicYear: AY_ID },
  semesters: new Map([
    [
      "1",
      {
        blocks: [
          {
            blockCode: "TF2",
            title: "Tanlov fanlari",
            ...block,
            sciences: [
              {
                science: SCIENCE_ID,
                serialNumber: "1.21",
                code: "FA120",
                totalCredit: 4,
                weeklyHours: 6,
                particle: livingParticle(),
                ...sci,
              },
            ],
          },
        ],
      },
    ],
  ]),
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (body = {}) => ({
  body: { science: String(SCIENCE_ID), ...body },
  user: { _id: new mongoose.Types.ObjectId(), role: { title: ROLES.SUPER_ADMIN } },
});

const wireLookup = (plans) => {
  jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
    distinct: jest.fn().mockResolvedValue([WS_ID]),
  });
  const chain = {};
  chain.sort = jest.fn(() => chain);
  chain.populate = jest.fn(() => chain);
  chain.exec = jest.fn().mockResolvedValue(plans);
  jest.spyOn(WorkingPlan, "find").mockReturnValue(chain);
  return chain;
};

const runCreate = async (wp, body = {}) => {
  wireLookup(wp ? [wp] : []);

  let captured = null;
  jest
    .spyOn(ScienceProgram.prototype, "save")
    .mockImplementation(function saveMock() {
      captured = this;
      return Promise.resolve(this);
    });

  const res = makeRes();
  const next = jest.fn();
  await Controller.addScienceProgram(makeReq(body), res, next);
  return { captured, res, next };
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("autoFields — moduleType 142-son yorlig'iga aylanadi", () => {
  test("tanlov bloki (TF2 / 'Tanlov fanlari') → 'Tanlov'", async () => {
    const { captured, next } = await runCreate(wpFixture());
    expect(next).not.toHaveBeenCalled();
    expect(captured.moduleType).toBe("Tanlov");
  });

  test("majburiy blok (MFI / 'Majburiy fanlar') → 'Majburiy'", async () => {
    const { captured } = await runCreate(
      wpFixture({ blockCode: "MFI", title: "Majburiy fanlar" }),
    );
    expect(captured.moduleType).toBe("Majburiy");
  });

  test("generatsiya qilingan BLK2 (title'siz) ham → 'Tanlov'", async () => {
    const { captured } = await runCreate(
      wpFixture({ blockCode: "BLK2", title: "" }),
    );
    expect(captured.moduleType).toBe("Tanlov");
  });

  test("XOM blockCode ('TF2') hujjatga TUSHMAYDI", async () => {
    const { captured } = await runCreate(wpFixture());
    expect(captured.moduleType).not.toBe("TF2");
  });
});

describe("autoFields — weeklyHours va serialNumber ko'chadi", () => {
  test("weeklyHours ishchi o'quv rejadagi fandan olinadi", async () => {
    const { captured } = await runCreate(wpFixture());
    expect(captured.weeklyHours).toBe(6);
  });

  test("weeklyHours 0 bo'lsa null (qo'shni maydonlar bilan bir xil idioma)", async () => {
    const { captured } = await runCreate(wpFixture({}, { weeklyHours: 0 }));
    expect(captured.weeklyHours).toBeNull();
  });

  test("serialNumber ('1.21') ko'chadi — 142-son §1 tartib raqami", async () => {
    const { captured } = await runCreate(wpFixture());
    expect(captured.serialNumber).toBe("1.21");
  });
});

describe("autoFields — hourItems (Variant C) PDF tushunadigan slug bilan", () => {
  test("dars turlari particle'dan quriladi", async () => {
    const { captured } = await runCreate(wpFixture());
    const items = captured.hourItems.map((h) => ({
      slug: h.slug,
      value: h.value,
    }));
    expect(items).toEqual([
      { slug: "maruza", value: 30 },
      { slug: "seminar", value: 20 },
      { slug: "laboratoriya", value: 10 },
      { slug: "amaliy", value: 60 },
      { slug: "mustaqil", value: 60 },
    ]);
  });

  test("SEAM: har bir slug PDF `sumHourItems` ro'yxatida bor", async () => {
    const { captured } = await runCreate(wpFixture());
    for (const h of captured.hourItems) {
      expect(PDF_KNOWN_SLUGS).toContain(h.slug);
    }
  });

  test("yig'indi/ko'rsatkich particle'lari (soat/jami/foiz) hourItems ga tushmaydi", async () => {
    const { captured } = await runCreate(wpFixture());
    const slugs = captured.hourItems.map((h) => h.slug);
    expect(slugs).not.toContain("soat");
    expect(slugs).not.toContain("jami");
    expect(slugs).not.toContain("foiz");
  });

  test("particle title'i saqlanadi (PDF/UI uchun o'qiladigan nom)", async () => {
    const { captured } = await runCreate(wpFixture());
    const lab = captured.hourItems.find((h) => h.slug === "laboratoriya");
    expect(lab.title).toBe("Laboratoriya mashg' uloti");
  });

  test("LEGACY fixed maydonlar HAM to'ladi (olib tashlanmagan)", async () => {
    const { captured } = await runCreate(wpFixture());
    expect(captured.lectureHours).toBe(30);
    expect(captured.seminarHours).toBe(20);
    expect(captured.labHours).toBe(10);
    expect(captured.practicalHours).toBe(60);
  });

  test("mavjud autoFields maydonlari o'zgarmagan", async () => {
    const { captured } = await runCreate(wpFixture());
    expect(captured.code).toBe("FA120");
    expect(captured.semester).toBe("1");
    expect(captured.credits).toBe(4);
    expect(captured.totalHours).toBe(180);
    expect(captured.independentHours).toBe(60);
    expect(captured.classroomHours).toBe(120);
    expect(String(captured.academicYear)).toBe(String(AY_ID));
  });
});

describe("REGRESSIYA QULFI — workingPlan topilmasa xatti-harakat o'zgarmaydi", () => {
  test("wp null bo'lsa xato bermaydi, 201 qaytadi, maydonlar null qoladi", async () => {
    const { captured, res, next } = await runCreate(null);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(captured.moduleType).toBeNull();
    expect(captured.weeklyHours).toBeNull();
    expect(captured.serialNumber).toBeNull();
    expect(captured.hourItems).toHaveLength(0);
  });

  test("fan reja ichida topilmasa ham jim o'tadi", async () => {
    const wp = wpFixture({}, { science: new mongoose.Types.ObjectId() });
    const { captured, res } = await runCreate(wp);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(captured.moduleType).toBeNull();
  });
});

describe("language — manba yo'q, lekin body'dan qabul qilinadi", () => {
  test("body'dagi `language` hujjatga yozildi", async () => {
    const { captured } = await runCreate(wpFixture(), { language: "o'zbek" });
    expect(captured.language).toBe("o'zbek");
  });
});

describe("directions — ishchi rejadan default (bo'sh bo'lsa)", () => {
  const DIR_ID = new mongoose.Types.ObjectId();
  const wpWithDirection = () => {
    const wp = wpFixture();
    wp.workingSchedule = { academicYear: AY_ID, direction: DIR_ID };
    return wp;
  };

  test("body'da `directions` yo'q → rejaning yo'nalishi yoziladi", async () => {
    const { captured, next } = await runCreate(wpWithDirection());
    expect(next).not.toHaveBeenCalled();
    expect(captured.directions.map(String)).toEqual([String(DIR_ID)]);
  });

  test("body'da `directions` bo'sh massiv → rejaning yo'nalishi yoziladi", async () => {
    const { captured } = await runCreate(wpWithDirection(), { directions: [] });
    expect(captured.directions.map(String)).toEqual([String(DIR_ID)]);
  });

  test("foydalanuvchi tanlagan `directions` USTUN — reja yo'nalishi bosib ketmaydi", async () => {
    const chosen = new mongoose.Types.ObjectId();
    const { captured } = await runCreate(wpWithDirection(), { directions: [String(chosen)] });
    expect(captured.directions.map(String)).toEqual([String(chosen)]);
  });

  test("reja yo'nalishsiz (yoki reja yo'q) → `directions` bo'sh qoladi, xato yo'q", async () => {
    const { captured: a, next } = await runCreate(wpFixture());
    expect(next).not.toHaveBeenCalled();
    expect(a.directions).toEqual([]);
    const { captured: b } = await runCreate(null);
    expect(b.directions).toEqual([]);
  });
});
