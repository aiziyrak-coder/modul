"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES } = require("../src/config/constants");

const M = "../src/modules/4.10-scientificDept";

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[SciSample Seed] MongoDB ga ulandi\n");

  const User = require("../src/modules/4.01-auth/user/user.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");
  const Department = require("../src/references/department/department.model");
  require("../src/references/faculty/faculty.model");
  const AcademicYear = require("../src/references/academicYear/academicYear.model");

  const OakJournal = require(`${M}/oakJournal/oakJournal.model`);
  const ThesisCategory = require(`${M}/thesisCategory/thesisCategory.model`);
  const Article = require(`${M}/article/article.model`);
  const Thesis = require(`${M}/thesis/thesis.model`);
  const Methodical = require(`${M}/methodicalRecommendation/methodicalRecommendation.model`);
  const Monograph = require(`${M}/monograph/monograph.model`);
  const EconomicContract = require(`${M}/economicContract/economicContract.model`);
  const Conference = require(`${M}/conference/conference.model`);
  const HIndexProfile = require(`${M}/hIndexProfile/hIndexProfile.model`);
  const ScientificDegree = require(`${M}/scientificDegree/scientificDegree.model`);
  const ScientificTitle = require(`${M}/scientificTitle/scientificTitle.model`);
  const Patent = require(`${M}/patent/patent.model`);
  const Copyright = require(`${M}/copyright/copyright.model`);
  const DepartmentWorkPlan = require(`${M}/departmentWorkPlan/departmentWorkPlan.model`);
  const AnnualReport = require(`${M}/annualReport/annualReport.model`);
  const ExamSpecialty = require(`${M}/examSpecialty/examSpecialty.model`);
  const QualifyingApplicant = require(`${M}/qualifyingApplicant/qualifyingApplicant.model`);
  const ScientificPost = require(`${M}/scientificPost/scientificPost.model`);
  const Notification = require("../src/system/notification/notification.model");

  const depts = await Department.find({ active: true })
    .populate("faculty", "_id title")
    .lean();
  if (depts.length === 0) {
    console.warn("  ⚠ Kafedra topilmadi — avval `npm run seed:refs` ni ishga tushiring");
    await mongoose.disconnect();
    process.exit(1);
  }
  const deptByTitle = {};
  depts.forEach((d) => (deptByTitle[d.title] = d));
  const pickDept = (title, idx) => deptByTitle[title] || depts[idx % depts.length];
  const D1 = pickDept("Ichki kasalliklar kafedrasi", 0);
  const D2 = pickDept("Jarrohlik kafedrasi", 1);
  const D3 = pickDept("Stomatologiya kafedrasi", 2);
  const facOf = (d) => (d.faculty && (d.faculty._id || d.faculty)) || null;

  const ay2025 = await AcademicYear.findOne({ title: "2025/2026" }).select("_id").lean();
  const ay2024 = await AcademicYear.findOne({ title: "2024/2025" }).select("_id").lean();
  const ayRef = ay2025 || ay2024;
  const AY_STR = "2025-2026";

  if (!ayRef) {
    console.warn("  ⚠ O'quv yili topilmadi — avval `npm run seed:refs` ni ishga tushiring");
    await mongoose.disconnect();
    process.exit(1);
  }

  const userByRole = async (title) => {
    const r = await Role.findOne({ title }).select("_id").lean();
    if (!r) return null;
    return User.findOne({ role: r._id }).select("_id firstName lastName").lean();
  };
  const ilmiy = await userByRole(ROLES.ILMIY_BOLIM);
  const kotib = await userByRole(ROLES.ILMIY_KENGASH_KOTIBI);
  const rektor = await userByRole(ROLES.REKTOR);
  const prorektor = await userByRole(ROLES.PROREKTOR);
  const dekan = await userByRole(ROLES.DEKAN);
  const mudir = await userByRole(ROLES.KAFEDRA_MUDIRI);

  if (!ilmiy) {
    console.warn("  ⚠ ilmiy_bolim useri topilmadi — avval scientific-users.seed.js");
    await mongoose.disconnect();
    process.exit(1);
  }

  const oqRole = await Role.findOne({ title: ROLES.OQITUVCHI }).select("_id").lean();
  if (!oqRole) {
    console.warn("  ⚠ oqituvchi roli topilmadi — avval scientific-roles.seed.js");
    await mongoose.disconnect();
    process.exit(1);
  }

  const upsertTeacher = async (pin, firstName, lastName, dept) => {
    const set = {
      firstName,
      lastName,
      role: oqRole._id,
      department: dept._id,
      active: true,
    };
    const existing = await User.findOne({ oneIdPin: pin });
    if (existing) {
      Object.assign(existing, set);
      await existing.save();
      return existing;
    }
    return User.create({ oneIdPin: pin, ...set });
  };

  const loginTeacher = await upsertTeacher("41000000000002", "Akmal", "Karimov", D1);
  const t2 = await upsertTeacher("41010000000002", "Dilshod", "Yusupov", D2);
  const t3 = await upsertTeacher("41010000000003", "Malika", "Toshmatova", D3);
  const t4 = await upsertTeacher("41010000000004", "Feruza", "Rahimova", D1);
  console.log("  ✓ 4 o'qituvchi kafedra bilan tayyor (login: 41000000000002)\n");

  const A = [
    { _id: loginTeacher._id, department: D1._id, faculty: facOf(D1), name: "Karimov A." },
    { _id: t2._id, department: D2._id, faculty: facOf(D2), name: "Yusupov D." },
    { _id: t3._id, department: D3._id, faculty: facOf(D3), name: "Toshmatova M." },
    { _id: t4._id, department: D1._id, faculty: facOf(D1), name: "Rahimova F." },
  ];

  const now = new Date();
  const plus = (d) => new Date(now.getTime() + d * 864e5);

  const seedIfEmpty = async (Model, label, docs) => {
    const c = await Model.countDocuments();
    if (c > 0) {
      console.log(`  ~ ${label}: ${c} ta mavjud — SKIP`);
      return;
    }
    await Model.insertMany(docs);
    console.log(`  + ${label}: ${docs.length} ta qo'shildi`);
  };

  await seedIfEmpty(OakJournal, "OAK jurnallari", [
    { name: "The Lancet", type: "scopus", active: true },
    { name: "Journal of Clinical Medicine", type: "wos", active: true },
    { name: "O'zbekiston tibbiyot jurnali", type: "nationalOak", active: true },
    { name: "Central Asian Journal of Medicine", type: "foreignOak", active: true },
  ]);

  await seedIfEmpty(ThesisCategory, "Tezis toifalari", [
    { name: "Respublika ilmiy-amaliy konferensiyasi", type: "national", active: true },
    { name: "Xalqaro ilmiy konferensiya", type: "international", active: true },
    { name: "Yosh olimlar konferensiyasi", type: "national", active: true },
  ]);

  const mkBase = (a) => ({ author: a._id, department: a.department, faculty: a.faculty });
  await seedIfEmpty(Article, "Maqolalar", [
    {
      ...mkBase(A[0]),
      journalName: "The Lancet",
      title: "Yurak-qon tomir kasalliklari erta diagnostikasi",
      type: "scopus",
      academicYear: AY_STR,
      year: 2025,
      pages: "45-52",
      url: "https://example.org/article-1",
      authorCount: 3,
      status: "approved",
      approvedBy: ilmiy._id,
      approvedAt: plus(-12),
    },
    {
      ...mkBase(A[1]),
      journalName: "Journal of Clinical Medicine",
      title: "Jarrohlik amaliyotida minimal invaziv usullar",
      type: "wos",
      academicYear: AY_STR,
      year: 2025,
      pages: "10-18",
      url: "https://example.org/article-2",
      authorCount: 2,
      status: "pending",
    },
    {
      ...mkBase(A[2]),
      journalName: "O'zbekiston tibbiyot jurnali",
      title: "Stomatologik implantatsiya natijalari tahlili",
      type: "nationalOak",
      academicYear: AY_STR,
      year: 2024,
      pages: "77-83",
      url: "https://example.org/article-3",
      authorCount: 4,
      status: "new",
    },
    {
      ...mkBase(A[3]),
      journalName: "Central Asian Journal of Medicine",
      title: "Ichki kasalliklar profilaktikasi",
      type: "foreignOak",
      academicYear: AY_STR,
      year: 2025,
      pages: "5-11",
      url: "https://example.org/article-4",
      authorCount: 1,
      status: "rejected",
      rejectionReason: "Manba ro'yxati to'liq emas, qayta ko'rib chiqing.",
      rejectedBy: ilmiy._id,
    },
    {
      ...mkBase(A[0]),
      journalName: "Journal of Clinical Medicine",
      title: "Diabet asoratlarini boshqarish",
      type: "scopus",
      academicYear: AY_STR,
      year: 2025,
      pages: "120-129",
      url: "https://example.org/article-5",
      authorCount: 3,
      status: "new",
    },
    {
      ...mkBase(A[2]),
      journalName: "The Lancet",
      title: "Og'iz bo'shlig'i onkologiyasi skrining",
      type: "wos",
      academicYear: AY_STR,
      year: 2024,
      pages: "200-210",
      url: "https://example.org/article-6",
      authorCount: 2,
      status: "approved",
      approvedBy: ilmiy._id,
      approvedAt: plus(-30),
    },
  ]);

  await seedIfEmpty(Thesis, "Tezislar", [
    {
      ...mkBase(A[0]),
      conferenceName: "Respublika ilmiy-amaliy konferensiyasi",
      title: "Kardiologiyada yangi yondashuvlar",
      type: "national",
      academicYear: AY_STR,
      year: 2025,
      pages: "3-4",
      authorCount: 2,
      status: "approved",
      approvedBy: ilmiy._id,
      approvedAt: plus(-8),
    },
    {
      ...mkBase(A[1]),
      conferenceName: "Xalqaro ilmiy konferensiya",
      title: "Modern surgery techniques",
      type: "international",
      academicYear: AY_STR,
      year: 2025,
      pages: "12-13",
      authorCount: 3,
      status: "pending",
    },
    {
      ...mkBase(A[2]),
      conferenceName: "Yosh olimlar konferensiyasi",
      title: "Stomatologiyada raqamli texnologiyalar",
      type: "national",
      academicYear: AY_STR,
      year: 2024,
      pages: "45-46",
      authorCount: 1,
      status: "new",
    },
    {
      ...mkBase(A[3]),
      conferenceName: "Respublika ilmiy-amaliy konferensiyasi",
      title: "Profilaktik tibbiyot asoslari",
      type: "national",
      academicYear: AY_STR,
      year: 2025,
      pages: "88-89",
      authorCount: 2,
      status: "rejected",
      rejectionReason: "Tezis matni talab qilingan hajmga mos emas.",
      rejectedBy: ilmiy._id,
    },
  ]);

  await seedIfEmpty(Methodical, "Uslubiy tavsiyanomalar", [
    {
      ...mkBase(A[0]),
      title: "Ichki kasalliklar bo'yicha uslubiy qo'llanma",
      direction: "Davolash ishi",
      academicYear: AY_STR,
      status: "new",
    },
    {
      ...mkBase(A[1]),
      title: "Jarrohlik amaliyoti uslubiy tavsiyanomasi",
      direction: "Davolash ishi",
      academicYear: AY_STR,
      status: "pending",
      ilmiyApprovedBy: ilmiy._id,
      ilmiyApprovedAt: plus(-5),
    },
    {
      ...mkBase(A[2]),
      title: "Stomatologiya amaliy mashg'ulotlari",
      direction: "Stomatologiya",
      academicYear: AY_STR,
      status: "approved",
      ilmiyApprovedBy: ilmiy._id,
      ilmiyApprovedAt: plus(-20),
      kotibSignedBy: kotib && kotib._id,
      kotibSignedAt: plus(-18),
      kotibEriSerial: "A1B2-C3D4-E5F6-G7H8",
      rektorSignedBy: rektor && rektor._id,
      rektorSignedAt: plus(-15),
      rektorEriSerial: "Z9Y8-X7W6-V5U4-T3S2",
      registrationNumber: "u-t-25-1",
    },
    {
      ...mkBase(A[3]),
      title: "Profilaktika bo'yicha uslubiy ko'rsatma",
      direction: "Tibbiy profilaktika ishi",
      academicYear: AY_STR,
      status: "rejected",
      rejectionReason: "Titul varaq va antiplagiat hisoboti yetishmaydi.",
      rejectedBy: ilmiy._id,
      rejectedByRole: "ilmiy_bolim",
    },
  ]);

  await seedIfEmpty(Monograph, "Monografiyalar", [
    {
      ...mkBase(A[0]),
      status: "new",
    },
    {
      ...mkBase(A[1]),
      status: "pending",
      ilmiyApprovedBy: ilmiy._id,
      ilmiyApprovedAt: plus(-6),
    },
    {
      ...mkBase(A[2]),
      status: "approved",
      title: "Zamonaviy stomatologiya asoslari",
      isbn: "978-9943-00-123-4",
      publisher: "Tibbiyot nashriyoti",
      ssvNumber: "SSV-2025-14",
      ssvDate: "2025-03-10",
      ilmiyApprovedBy: ilmiy._id,
      ilmiyApprovedAt: plus(-40),
      kotibSignedBy: kotib && kotib._id,
      kotibSignedAt: plus(-38),
      kotibEriSerial: "A1B2-C3D4-E5F6-G7H8",
      prorektorSignedBy: prorektor && prorektor._id,
      prorektorSignedAt: plus(-35),
      prorektorEriSerial: "Z9Y8-X7W6-V5U4-T3S2",
      ssvSentBy: ilmiy._id,
      ssvSentAt: plus(-30),
      ssvReceivedAt: plus(-20),
      teacherConfirmedAt: plus(-12),
      dataApprovedBy: ilmiy._id,
      dataApprovedAt: plus(-10),
    },
    {
      ...mkBase(A[3]),
      status: "rejected",
      rejectionReason: "Ilmiy kengash ko'chirmasi biriktirilmagan.",
      rejectedBy: ilmiy._id,
      rejectedByRole: "ilmiy_bolim",
    },
  ]);

  await seedIfEmpty(EconomicContract, "Xo'jalik shartnomalari", [
    {
      createdBy: (mudir && mudir._id) || ilmiy._id,
      teacher: A[0]._id,
      department: A[0].department,
      faculty: A[0].faculty,
      title: "Klinika bilan ilmiy hamkorlik",
      partnerOrganization: "Farg'ona shahar ko'p tarmoqli klinikasi",
      contractDate: plus(-25),
      amount: 25000000,
      currentYearAmount: 25000000,
      academicYear: ayRef && ayRef._id,
      status: "approved",
      approvedBy: ilmiy._id,
      approvedAt: plus(-22),
    },
    {
      createdBy: (mudir && mudir._id) || ilmiy._id,
      teacher: A[1]._id,
      department: A[1].department,
      faculty: A[1].faculty,
      title: "Jarrohlik uskunalari sinovlari",
      partnerOrganization: "MedTech MChJ",
      contractDate: plus(-10),
      amount: 15000000,
      currentYearAmount: 15000000,
      academicYear: ayRef && ayRef._id,
      status: "new",
    },
    {
      createdBy: (mudir && mudir._id) || ilmiy._id,
      teacher: A[2]._id,
      department: A[2].department,
      faculty: A[2].faculty,
      title: "Stomatologik materiallar tadqiqoti",
      partnerOrganization: "DentPro LLC",
      contractDate: plus(-5),
      amount: 18000000,
      currentYearAmount: 18000000,
      academicYear: ayRef && ayRef._id,
      status: "rejected",
      rejectionReason: "Shartnoma nusxasi to'liq skaner qilinmagan.",
      rejectedBy: ilmiy._id,
    },
  ]);

  await seedIfEmpty(Conference, "Konferensiyalar", [
    {
      title: "Respublika kardiologiya kongressi 2025",
      type: "national",
      description: "Yurak-qon tomir kasalliklari bo'yicha yillik anjuman.",
      deadline: plus(20),
      createdBy: ilmiy._id,
      kafedras: [
        { department: D1._id, status: "pending" },
        { department: D2._id, status: "pending" },
      ],
      status: "active",
    },
    {
      title: "International Dentistry Forum",
      type: "international",
      description: "Xalqaro stomatologiya forumi.",
      deadline: plus(45),
      createdBy: ilmiy._id,
      kafedras: [{ department: D3._id, status: "accepted", acceptedBy: mudir && mudir._id, acceptedAt: plus(-2) }],
      status: "active",
    },
    {
      title: "Yosh olimlar ilmiy sessiyasi",
      type: "national",
      description: "Institut yosh olimlari uchun.",
      deadline: plus(-3),
      createdBy: ilmiy._id,
      kafedras: [
        { department: D1._id, status: "pending" },
        { department: D3._id, status: "pending" },
      ],
      status: "closed",
    },
  ]);

  await seedIfEmpty(HIndexProfile, "H-indeks profillari", [
    {
      teacher: A[0]._id,
      department: A[0].department,
      faculty: A[0].faculty,
      scopusUrl: "https://www.scopus.com/authid/1",
      scopusHIndex: 6,
      scopusCitations: 142,
      scholarUrl: "https://scholar.google.com/citations?user=1",
      scholarHIndex: 9,
      scholarCitations: 310,
    },
    {
      teacher: A[1]._id,
      department: A[1].department,
      faculty: A[1].faculty,
      scopusHIndex: 3,
      scopusCitations: 54,
      scholarHIndex: 5,
      scholarCitations: 120,
    },
    {
      teacher: A[2]._id,
      department: A[2].department,
      faculty: A[2].faculty,
      scopusHIndex: 4,
      scopusCitations: 88,
      scholarHIndex: 7,
      scholarCitations: 205,
    },
    {
      teacher: A[3]._id,
      department: A[3].department,
      faculty: A[3].faculty,
      scopusHIndex: 2,
      scopusCitations: 21,
      scholarHIndex: 4,
      scholarCitations: 76,
    },
  ]);

  await seedIfEmpty(ScientificDegree, "Ilmiy darajalar", [
    {
      ...mkBase(A[0]),
      academicYear: AY_STR,
      degreeType: "phd",
      specialty: "14.00.06 — Kardiologiya",
      dissertationTopic: "Yurak yetishmovchiligini erta aniqlash",
      awardedDate: plus(-200),
      status: "approved",
      approvedBy: ilmiy._id,
      approvedAt: plus(-190),
    },
    {
      ...mkBase(A[1]),
      academicYear: AY_STR,
      degreeType: "dsc",
      specialty: "14.00.27 — Jarrohlik",
      dissertationTopic: "Minimal invaziv jarrohlik samaradorligi",
      status: "new",
    },
    {
      ...mkBase(A[2]),
      academicYear: AY_STR,
      degreeType: "phd",
      specialty: "14.00.21 — Stomatologiya",
      dissertationTopic: "Implant integratsiyasi omillari",
      status: "rejected",
      rejectionReason: "Diplom nusxasi biriktirilmagan.",
      rejectedBy: ilmiy._id,
    },
  ]);

  await seedIfEmpty(ScientificTitle, "Ilmiy unvonlar", [
    {
      ...mkBase(A[0]),
      academicYear: AY_STR,
      titleType: "dotsent",
      specialty: "Kardiologiya",
      diplomaSeries: "AA",
      diplomaNumber: "001234",
      date: plus(-150),
      status: "approved",
      approvedBy: ilmiy._id,
      approvedAt: plus(-145),
    },
    {
      ...mkBase(A[2]),
      academicYear: AY_STR,
      titleType: "professor",
      specialty: "Stomatologiya",
      diplomaSeries: "BB",
      diplomaNumber: "005678",
      status: "new",
    },
  ]);

  await seedIfEmpty(Patent, "Patentlar", [
    {
      ...mkBase(A[1]),
      academicYear: AY_STR,
      title: "Jarrohlik asbobi konstruksiyasi",
      patentType: "invention",
      registrationNumber: "IAP 2025 0123",
      date: plus(-90),
      status: "approved",
      approvedBy: ilmiy._id,
      approvedAt: plus(-85),
    },
    {
      ...mkBase(A[3]),
      academicYear: AY_STR,
      title: "Tibbiy diagnostika qurilmasi",
      patentType: "utilityModel",
      registrationNumber: "FAP 2025 0456",
      status: "new",
    },
  ]);

  await seedIfEmpty(Copyright, "AKT guvohnomalari", [
    {
      ...mkBase(A[0]),
      academicYear: AY_STR,
      title: "Kardiologik monitoring dasturi",
      authors: "Karimov A., Rahimova F.",
      institutionName: "Farg'ona jamoat salomatligi tibbiyot instituti",
      registrationNumber: "DGU 2025 01111",
      date: plus(-60),
      status: "approved",
      approvedBy: ilmiy._id,
      approvedAt: plus(-55),
    },
    {
      ...mkBase(A[2]),
      academicYear: AY_STR,
      title: "Stomatologik reyestr tizimi",
      authors: "Toshmatova M.",
      institutionName: "Farg'ona jamoat salomatligi tibbiyot instituti",
      registrationNumber: "DGU 2025 02222",
      status: "new",
    },
  ]);

  const planStatuses = DepartmentWorkPlan.schema.paths.status.enumValues;
  const midStatus = planStatuses.includes("pending") ? "pending" : "new";
  await seedIfEmpty(DepartmentWorkPlan, "Kafedra ish rejalari", [
    {
      department: D1._id,
      faculty: facOf(D1),
      createdBy: (mudir && mudir._id) || ilmiy._id,
      academicYear: ayRef && ayRef._id,
      status: "new",
    },
    {
      department: D2._id,
      faculty: facOf(D2),
      createdBy: (mudir && mudir._id) || ilmiy._id,
      academicYear: ayRef && ayRef._id,
      status: midStatus,
      dekanApprovedBy: dekan && dekan._id,
      dekanApprovedAt: plus(-6),
    },
    {
      department: D3._id,
      faculty: facOf(D3),
      createdBy: (mudir && mudir._id) || ilmiy._id,
      academicYear: ayRef && ayRef._id,
      status: "approved",
      dekanApprovedBy: dekan && dekan._id,
      dekanApprovedAt: plus(-14),
      prorektorApprovedBy: prorektor && prorektor._id,
      prorektorApprovedAt: plus(-10),
    },
  ]);

  await seedIfEmpty(AnnualReport, "Yillik hisobotlar", [
    {
      department: D1._id,
      faculty: facOf(D1),
      createdBy: (mudir && mudir._id) || ilmiy._id,
      academicYear: ayRef && ayRef._id,
      status: "new",
    },
    {
      department: D2._id,
      faculty: facOf(D2),
      createdBy: (mudir && mudir._id) || ilmiy._id,
      academicYear: ayRef && ayRef._id,
      status: midStatus,
      dekanApprovedBy: dekan && dekan._id,
      dekanApprovedAt: plus(-4),
    },
    {
      department: D3._id,
      faculty: facOf(D3),
      createdBy: (mudir && mudir._id) || ilmiy._id,
      academicYear: ayRef && ayRef._id,
      status: "approved",
      dekanApprovedBy: dekan && dekan._id,
      dekanApprovedAt: plus(-12),
      prorektorApprovedBy: prorektor && prorektor._id,
      prorektorApprovedAt: plus(-9),
    },
  ]);

  await seedIfEmpty(ExamSpecialty, "Imtihon mutaxassisliklari", [
    { code: "3210100", name: "Terapiya", regStart: plus(-10), regEnd: plus(20), status: "open" },
    { code: "3210200", name: "Jarrohlik", regStart: plus(-5), regEnd: plus(25), status: "open" },
    { code: "5110100", name: "Pediatriya", regStart: plus(-40), regEnd: plus(-10), status: "closed" },
    { code: "5A130102", name: "Stomatologiya", regStart: plus(-2), regEnd: plus(30), status: "open" },
  ]);

  await seedIfEmpty(QualifyingApplicant, "Imtihon talabgorlari", [
    {
      addedBy: A[0]._id,
      department: A[0].department,
      faculty: A[0].faculty,
      name: "Aliyev Sardor Botirovich",
      researcherType: "mustaqil",
      course: 1,
      specialization: "3210100",
      university: "Farg'ona davlat universiteti",
      phone: "+998 90 111 22 33",
      status: "new",
    },
    {
      addedBy: A[1]._id,
      department: A[1].department,
      faculty: A[1].faculty,
      name: "Karimova Dilnoza Akmalovna",
      researcherType: "tayanch",
      course: 2,
      specialization: "3210200",
      university: "Toshkent davlat texnika universiteti",
      phone: "+998 91 222 33 44",
      status: "approved",
      reviewedBy: ilmiy._id,
      examDate: plus(15),
    },
    {
      addedBy: A[2]._id,
      department: A[2].department,
      faculty: A[2].faculty,
      name: "Yusupov Jasur Farhodovich",
      researcherType: "mustaqil",
      course: 3,
      specialization: "5A130102",
      university: "Toshkent tibbiyot akademiyasi",
      phone: "+998 93 333 44 55",
      status: "rejected",
      reviewedBy: ilmiy._id,
      rejectionReason: "Obyektivka va shaxsiy hujjatlar to'liq emas.",
    },
    {
      addedBy: A[0]._id,
      department: A[0].department,
      faculty: A[0].faculty,
      name: "Toshmatova Nigora Baxtiyorovna",
      researcherType: "tayanch",
      course: 1,
      specialization: "3210100",
      university: "Farg'ona davlat universiteti",
      phone: "+998 94 444 55 66",
      status: "passed",
      reviewedBy: ilmiy._id,
      examDate: plus(-6),
      certificateFileUrl: "https://example.org/certificate-1.pdf",
      resultBy: (kotib && kotib._id) || ilmiy._id,
    },
    {
      addedBy: A[1]._id,
      department: A[1].department,
      faculty: A[1].faculty,
      name: "Rahimov Bekzod Shuhratovich",
      researcherType: "mustaqil",
      course: 2,
      specialization: "3210200",
      university: "Andijon davlat tibbiyot instituti",
      phone: "+998 95 555 66 77",
      status: "new",
    },
  ]);

  await seedIfEmpty(ScientificPost, "E'lonlar", [
    {
      title: "Ilmiy maqolalar bo'yicha seminar",
      text: "Hurmatli professor-o'qituvchilar! 25-iyul kuni Scopus/WoS jurnallariga maqola tayyorlash bo'yicha seminar bo'lib o'tadi.",
      recipients: ["teachers"],
      telegram: true,
      author: ilmiy._id,
    },
    {
      title: "Malakaviy imtihon: ro'yxatdan o'tish ochildi — 3210100 (Terapiya)",
      text: "Terapiya mutaxassisligi bo'yicha malakaviy imtihonga ro'yxatdan o'tish ochildi. Ariza topshirish uchun \"Topshirish\" tugmasidan foydalaning.",
      recipients: ["teachers"],
      telegram: true,
      specialtyCode: "3210100",
      author: ilmiy._id,
    },
    {
      title: "Yillik hisobotlarni topshirish muddati",
      text: "Kafedra mudirlari va dekanlar e'tiboriga: yillik ilmiy hisobotlarni 1-avgustgacha tizimga yuklang.",
      recipients: ["heads", "deans"],
      telegram: false,
      author: ilmiy._id,
    },
  ]);

  await seedIfEmpty(Notification, "Bildirishnomalar", [
    {
      user: loginTeacher._id,
      eventType: "scientific_post",
      title: "Ilmiy maqolalar bo'yicha seminar",
      body: "25-iyul kuni Scopus/WoS jurnallariga maqola tayyorlash seminari.",
      link: "/scientific-department/announcements",
      read: false,
      channels: ["inApp"],
    },
    {
      user: loginTeacher._id,
      eventType: "qualifying_applicant",
      title: "Ariza tasdiqlandi",
      body: "Malakaviy imtihon arizangiz tasdiqlandi.",
      link: "/scientific-department/qualification-exam",
      read: false,
      channels: ["inApp"],
    },
    {
      user: loginTeacher._id,
      eventType: "article_approved",
      title: "Maqola tasdiqlandi",
      body: "\"Yurak-qon tomir kasalliklari\" maqolangiz tasdiqlandi.",
      link: "/scientific-department/articles",
      read: true,
      readAt: plus(-1),
      channels: ["inApp"],
    },
  ]);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  [SciSample Seed] Tugadi — kafedra ma'lumotlari 3 kafedraga tarqatildi");
  console.log("  Login: 41000000000001 (ilmiy_bolim) barcha yozuvlarni + Kafedra filtrini ko'radi");
  console.log("  Login: 41000000000002 (oqituvchi) o'z yozuvlarini (Ichki kasalliklar) ko'radi");
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[SciSample Seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
