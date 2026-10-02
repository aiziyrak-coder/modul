"use strict";

const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model");

const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const { buildSyllabusPdf } = require("./syllabus.pdf");

const FORBIDDEN_HEX = [
  "#1a3c5e",
  "#2e6da4",
  "#e8f0fa",
  "#f5f8fc",
  "#1a7a4a",
  "#b8860b",
  "#c0392b",
];

const chainable = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const richFixture = () => ({
  _id: "syl1",
  label: null,
  title: null,
  createdAt: new Date("2026-08-19T05:25:57.414Z"),
  confirmation: { confirm: null, position: null, viceRector: null, date: null },
  science: {
    title: "Mehnat gigiyenasi",
    scienceCode: "FA1003",
    department: { title: "Gigiyena va ekologiya kafedrasi" },
  },
  scienceTitle: null,
  scienceType: "Majburiy",
  scienceCode: null,
  faculty: { title: "Tibbiy profilaktika fakulteti" },
  directions: [
    { title: "Tibbiy profilaktika ishi", directionCode: "60910500" },
  ],
  year: 3,
  semester: 1,
  credits: 4,
  educationForm: "full_time",
  evaluationForm: "exam",
  scienceLang: "uz",
  hoursByType: {
    title: null,
    totalHours: 120,
    items: [
      { slug: "maruza", title: "Ma'ruza", value: 30 },
      { slug: "amaliy", title: "Amaliy", value: 30 },
      { slug: "mustaqil", title: "Mustaqil ta'lim", value: 60 },
    ],
  },
  sciencePurpose: {
    title: null,
    desc: "Fanni o'rganishdan maqsad — kasb kasalliklarining oldini olish.",
  },
  prerequisiteKnowledge: {
    title: null,
    desc: "Anatomiya va fiziologiya asoslari.",
  },
  learningOutcome: {
    title: null,
    knowledgeAspect: null,
    skillsAspect: null,
    knowledgeOutcomes: [
      "Gigiyenaning asosiy tamoyillarini biladi",
      "Kasb kasalliklarini tasniflaydi",
    ],
    skillOutcomes: ["Ish joyida gigiyenik baholash o'tkaza oladi"],
  },
  scienceContent: {
    title: null,
    desc: "Ma'ruza mavzulari ro'yxati.",
    topics: [
      { topic: "Kirish. Gigiyena fani predmeti", hour: 2 },
      { topic: "Mehnat gigiyenasining asosiy tamoyillari", hour: 2 },
    ],
  },
  trainingSeminar: {
    title: null,
    topics: [{ topic: "Ish joyi mikroiqlimini baholash", hour: 2 }],
  },
  independent: {
    title: null,
    topics: [{ topic: "Adabiyotlar bilan mustaqil ishlash", hour: 4 }],
  },
  literatureGroups: [
    {
      slug: "primary",
      title: null,
      literatures: ["Gigiyena. Darslik, 2020"],
    },
    {
      slug: "additional",
      title: "Qo'shimcha adabiyotlar",
      literatures: ["Mehnat gigiyenasi amaliyoti, 2019"],
    },
  ],
  evaluationCriteria: {
    title: null,
    criteria: [
      { slug: "5", title: "A'lo (5)", desc: "To'liq va mustaqil javob." },
      { slug: "4", title: "Yaxshi (4)", desc: "Kichik xatoliklar bilan javob." },
    ],
  },
  author: {
    teacher: {
      firstName: "Ibrohim",
      lastName: "Qodirjonov",
      middleName: "Jabborovich",
      position: { title: "Professor" },
    },
    email: "example@edu.uz",
    organization: "FarJSTI",
    reviewer: {
      title: null,
      desc: "Taqrizchi fikri: fan dasturi to'liq va izchil.",
    },
  },
  desc: "Qo'shimcha izoh matni.",
  weeklySchedule: {
    title: null,
    weeks: [{ week: 1, topic: "Kirish mavzusi", type: "Ma'ruza", hour: 2 }],
  },
  submissionRules: {
    title: null,
    desc: "Topshiriqlar belgilangan muddatda platformaga yuklanadi.",
  },
  contactInfo: {
    title: null,
    schedule: "Har seshanba, 14:00-16:00",
    room: "204-xona",
    phone: "+998901234567",
    desc: "Qo'shimcha savollar uchun murojaat qiling.",
  },
  methodicalHead: {},
  facultyDean: {},
  departmentHead: {},
  creator: {},
  approvalSteps: [
    {
      step: "kafedra",
      status: "approved",
      approvedBy: { firstName: "Sanjar", lastName: "Abdusalimov" },
      date: new Date("2026-08-19T05:29:54.409Z"),
    },
    {
      step: "prorektor",
      status: "approved",
      approvedBy: { firstName: "Ulugbek", lastName: "Boltaboyev" },
      date: new Date("2026-08-19T05:32:58.374Z"),
    },
  ],
  status: "approved",
  location: null,
  verify: null,
});

const renderColors = async () => {
  Syllabus.findById = jest.fn().mockReturnValue(chainable(richFixture()));

  const fillColorSpy = jest.spyOn(PDFDocument.prototype, "fillColor");
  const strokeColorSpy = jest.spyOn(PDFDocument.prototype, "strokeColor");
  const fillSpy = jest.spyOn(PDFDocument.prototype, "fill");
  try {
    const doc = await buildSyllabusPdf("syl1");
    doc.end();
    const flat = (spy) =>
      spy.mock.calls.map((c) => c[0]).filter((v) => typeof v === "string");
    return {
      fillColors: flat(fillColorSpy),
      strokeColors: flat(strokeColorSpy),
      fills: flat(fillSpy),
    };
  } finally {
    fillColorSpy.mockRestore();
    strokeColorSpy.mockRestore();
    fillSpy.mockRestore();
  }
};

describe("syllabus.pdf ICHKI bloklari — qora-oq, ramkali (N-06/W3)", () => {
  let colors;

  beforeAll(async () => {
    jest.clearAllMocks();
    colors = await renderColors();
  });

  test("rang chaqiruvlari yozilgan (spy ishlayapti — yolg'on yashil emas)", () => {
    expect(colors.fillColors.length).toBeGreaterThan(10);
    expect(colors.strokeColors.length).toBeGreaterThan(5);
  });

  test("olib tashlangan ICHKI blok palitrasi (ko'k/yashil/amber/qizil) qolmagan", () => {
    const all = [
      ...colors.fillColors,
      ...colors.strokeColors,
      ...colors.fills,
    ].map((c) => c.toLowerCase());

    for (const hex of FORBIDDEN_HEX) {
      expect(all).not.toContain(hex);
    }
  });

  test("ichki bloklar ramkasi qora-kulrang (`#444`) — ko'k ramka emas", () => {
    expect(colors.strokeColors.map((c) => c.toLowerCase())).toContain("#444");
  });

  test("ichki bloklar matni qora (`#000`) bilan chiziladi", () => {
    expect(colors.fillColors.map((c) => c.toLowerCase())).toContain("#000");
  });
});
