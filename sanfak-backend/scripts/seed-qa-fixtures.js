"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

const { CHAINS } = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const {
  APPROVAL_STEPS: PWP_APPROVAL_STEPS,
} = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");

const WRITE = process.argv.includes("--write");
const CLEAN = process.argv.includes("--clean");
const DRY = !WRITE;

const QA_PREFIX = "[QA]";

const TITLES = {
  distribution: `${QA_PREFIX} S — Taqsimot javobi sinovi (in_review, 2 blok)`,
  syllabusDraft: `${QA_PREFIX} AA — Sillabus (Qoralama)`,
  syllabusNew: `${QA_PREFIX} AA/AB — Sillabus (Yangi, dekan bosqichi bilan)`,
  scienceProgramV259: `${QA_PREFIX} W — Fan dasturi v259 (draft, 6 bosqich)`,
  scienceProgramV142: `${QA_PREFIX} W — Fan dasturi v142 (draft, 3 bosqich, 142-son buyruq)`,
  personalWorkPlan: `${QA_PREFIX} Shaxsiy ish reja`,
};

const COLLECTION_KEYS = {
  workloaddistributions: "title",
  syllabuses: "title",
  scienceprograms: "title",
  personalworkplans: "name",
};
const keyFieldOf = (collection) => COLLECTION_KEYS[collection] || "title";

function todayDMY() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function pendingApprovalSteps(steps) {
  return steps.map((step) => ({
    step,
    label: null,
    approvedBy: null,
    status: "pending",
    comment: null,
    signature: null,
    eriSignature: null,
    eriSerial: null,
    eriSignedAt: null,
    date: null,
  }));
}

function pendingPlanApprovals() {
  return PWP_APPROVAL_STEPS.map(({ step, label }) => ({
    _id: new mongoose.Types.ObjectId(),
    step,
    label,
    approvedBy: null,
    status: "pending",
    date: null,
    comment: null,
    eriSignature: null,
    eriSerial: null,
    eriSignedAt: null,
  }));
}

function workItem(o) {
  return {
    _id: new mongoose.Types.ObjectId(),
    title: o.title,
    description: o.description ?? null,
    deadline: o.deadline ?? null,
    completedAt: null,
    status: "planned",
    fileUrl: null,
    note: o.note ?? null,
    link: o.link ?? null,
    verification: {
      status: "pending",
      reviewedBy: null,
      date: null,
      comment: null,
    },
    plannedCount: o.plannedCount ?? 0,
    actualCount: 0,
    semester: o.semester ?? [],
    venue: o.venue ?? null,
    studentName: o.studentName ?? null,
    topic: o.topic ?? null,
    workType: o.workType ?? null,
  };
}

(async () => {
  const uri = process.env.MONGO_HOST;
  if (!uri) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log(
    `REJIM: ${WRITE ? "YOZISH (--write)" : "DRY (yozilmaydi)"}${CLEAN ? " + CLEAN" : ""}\n`,
  );

  if (CLEAN) {
    await runClean(db);
    await mongoose.disconnect();
    return;
  }

  await runSeed(db);
  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});

async function runClean(db) {
  const collections = [
    "workloaddistributions",
    "syllabuses",
    "scienceprograms",
    "personalworkplans",
  ];

  console.log("── --clean: `[QA]` prefiksli hujjatlar ─────────────────────");
  let totalFound = 0;
  for (const coll of collections) {
    const keyField = keyFieldOf(coll);
    const filter = { [keyField]: { $regex: "^\\[QA\\]" } };
    const docs = await db
      .collection(coll)
      .find(filter, { projection: { [keyField]: 1 } })
      .toArray();
    totalFound += docs.length;
    if (docs.length === 0) {
      console.log(`  ${coll} (${keyField}): topilmadi`);
      continue;
    }
    for (const doc of docs) {
      console.log(
        `  ${coll} (${keyField}): O'CHIRILADI  ${doc._id}  "${doc[keyField]}"`,
      );
    }
    if (WRITE) {
      const res = await db.collection(coll).deleteMany(filter);
      console.log(`  ${coll}: o'chirildi = ${res.deletedCount}`);
    }
  }

  console.log(`\nXULOSA: jami topildi = ${totalFound}`);
  if (DRY) {
    console.log(
      "\nO'chirish uchun `--clean --write` bilan qayta ishga tushiring.",
    );
  }
}

async function runSeed(db) {
  async function requireByTitle(collection, title, label) {
    const doc = await db.collection(collection).findOne({ title });
    if (!doc) {
      throw new Error(
        `${label} "${title}" topilmadi (${collection}). Referens ma'lumot yo'q — skript to'xtatildi.`,
      );
    }
    return doc;
  }

  async function requireUserByPin(pin, label) {
    const doc = await db.collection("users").findOne({ oneIdPin: pin });
    if (!doc) {
      throw new Error(
        `${label} (PIN ${pin}) topilmadi (users). Avval seed-workload-teacher-fixtures.js --write ishga tushirilganmi?`,
      );
    }
    return doc;
  }

  console.log("── 0) Ma'lumotnoma qidiruvlari ──────────────────────────────");

  const department = await requireByTitle(
    "departments",
    "Gigiyena va ekologiya kafedrasi",
    "Kafedra",
  );
  const faculty = await requireByTitle(
    "faculties",
    "Tibbiy profilaktika fakulteti",
    "Fakultet",
  );
  const direction = await requireByTitle(
    "directions",
    "Tibbiy profilaktika ishi",
    "Yo'nalish",
  );
  const academicYear = await requireByTitle(
    "academicyears",
    "2026/2027",
    "O'quv yili",
  );

  const scienceKommunal = await requireByTitle(
    "sciences",
    "Kommunal gigiyena",
    "Fan",
  );
  const scienceMehnat = await requireByTitle(
    "sciences",
    "Mehnat gigiyenasi",
    "Fan",
  );
  const scienceRadiatsion = await requireByTitle(
    "sciences",
    "Radiatsion gigiyena",
    "Fan",
  );
  const scienceEkologiyaGigiyena = await requireByTitle(
    "sciences",
    "Ekologiya va gigiyena",
    "Fan",
  );
  const scienceEkologiya = await requireByTitle("sciences", "Ekologiya", "Fan");
  const scienceGigiyenaTibbiy = await requireByTitle(
    "sciences",
    "Gigiyena. Tibbiy ekologiya",
    "Fan",
  );

  const workload = await db
    .collection("workloads")
    .findOne({ department: department._id });
  if (!workload) {
    throw new Error(
      `Kafedra "${department.title}" uchun yuklama (workloads) topilmadi — skript to'xtatildi.`,
    );
  }

  function findBlockForScience(scienceId) {
    for (const dir of workload.directions || []) {
      for (const block of dir.blocks || []) {
        if (block.science && String(block.science) === String(scienceId)) {
          return block;
        }
      }
    }
    return null;
  }
  const blockKommunal = findBlockForScience(scienceKommunal._id);
  const blockMehnat = findBlockForScience(scienceMehnat._id);
  if (!blockKommunal || !blockMehnat) {
    throw new Error(
      "Yuklamada kutilgan fan bloklari (Kommunal gigiyena / Mehnat gigiyenasi) topilmadi — skript to'xtatildi.",
    );
  }

  const teacherDist = await requireUserByPin(
    "40400000000006",
    "Taqsimot o'qituvchisi",
  );
  const kafedraMudiri = await requireUserByPin(
    "40300000000001",
    "Kafedra mudiri",
  );
  const teacherSyllabusDraft = await requireUserByPin(
    "40400000000001",
    "Sillabus (Qoralama) egasi",
  );
  const teacherSyllabusNew = await requireUserByPin(
    "40400000000002",
    "Sillabus (Yangi) egasi",
  );
  const teacherScienceProgramV259 = await requireUserByPin(
    "40400000000003",
    "Fan dasturi (v259) egasi",
  );
  const teacherScienceProgramV142 = await requireUserByPin(
    "40400000000004",
    "Fan dasturi (v142) egasi",
  );

  console.log(
    `  Kafedra: ${department.title} (${department._id})\n` +
      `  Fakultet: ${faculty.title} (${faculty._id})\n` +
      `  Yo'nalish: ${direction.title} (${direction._id})\n` +
      `  O'quv yili: ${academicYear.title} (${academicYear._id})\n` +
      `  Yuklama (workload): ${workload._id}`,
  );

  const stats = { created: 0, skipped: 0 };

  async function upsertFixture(collection, doc, label, describe) {
    const keyField = keyFieldOf(collection);
    const existing = await db
      .collection(collection)
      .findOne({ [keyField]: doc[keyField] });
    if (existing) {
      console.log(`  SKIP  ${label}  — allaqachon mavjud (${existing._id})`);
      stats.skipped += 1;
      return;
    }
    console.log(`  YARATILADI  ${label}`);
    describe();
    if (WRITE) {
      await db.collection(collection).insertOne(doc);
    }
    stats.created += 1;
  }

  console.log(
    "\n── A) workloaddistributions — S (taqsimot javobi) ─────────────",
  );
  {
    const teacherEntryId = new mongoose.Types.ObjectId();
    const distDoc = {
      workload: workload._id,
      department: department._id,
      course: blockKommunal.course || 1,
      courseRef: blockKommunal.courseRef || null,
      scienceNumber: 2,
      totalHour: 0,
      residueHour: 0,
      title: TITLES.distribution,
      confirmation: {
        confirm: null,
        position: null,
        rector: null,
        signature: null,
        date: null,
      },
      academicYear: academicYear._id,
      meta: {},
      teachers: [
        {
          _id: teacherEntryId,
          teacher: teacherDist._id,
          isVacant: false,
          vacantLabel: null,
          vacantSince: null,
          vacancyReason: null,
          vacancyNumber: null,
          assignedAt: new Date(),
          vacancy: {
            requiredPosition: null,
            requiredSpecialization: null,
            requiredAcademicTitle: null,
            deadline: null,
            postedAt: null,
            history: [],
          },
          reassignedAt: null,
          reassignedFrom: null,
          reassignedBy: null,
          stavka: 1,
          position: "Katta o'qituvchi",
          specialization: null,
          phone: null,
          blocks: [
            {
              _id: new mongoose.Types.ObjectId(),
              workloadBlockId: blockKommunal._id,
              section: blockKommunal.section || "Majburiy fanlar",
              type: "lesson",
              science: scienceKommunal._id,
              practiceTitle: null,
              course: blockKommunal.course || 1,
              courseRef: blockKommunal.courseRef || null,
              semester: 1,
              student: 0,
              subGroup: 0,
              groups: [],
              streams: [],
              studyWork: {},
              nonAuditHour: 0,
              totalHour: 50,
              acceptanceStatus: "pending",
              rejectionReason: null,
              respondedAt: null,
            },
            {
              _id: new mongoose.Types.ObjectId(),
              workloadBlockId: blockMehnat._id,
              section: blockMehnat.section || "Majburiy fanlar",
              type: "lesson",
              science: scienceMehnat._id,
              practiceTitle: null,
              course: blockMehnat.course || 1,
              courseRef: blockMehnat.courseRef || null,
              semester: 1,
              student: 0,
              subGroup: 0,
              groups: [],
              streams: [],
              studyWork: {},
              nonAuditHour: 0,
              totalHour: 50,
              acceptanceStatus: "pending",
              rejectionReason: null,
              respondedAt: null,
            },
          ],
          totalHour: 100,
          acceptanceStatus: "pending",
          rejectionReason: null,
          respondedAt: null,
        },
      ],
      staffPositions: { items: [], totalPositions: 0, hourly: 0 },
      methodicalHead: { position: null, leader: null, signature: null, date: null },
      financialHead: { position: null, leader: null, signature: null, date: null },
      departmentHead: { position: null, manager: null, signature: null, date: null },
      approvalSteps: [
        {
          step: "kafedra",
          label: null,
          approvedBy: kafedraMudiri._id,
          status: "approved",
          comment: null,
          signature: "TEMP_ERI_PLACEHOLDER",
          eriSignature: null,
          eriSerial: null,
          eriSignedAt: null,
          date: new Date(),
        },
        ...pendingApprovalSteps(["methodical", "financial", "dean", "prorektor"]),
      ],
      status: "in_review",
      file: null,
      date: todayDMY(),
      active: true,
      comment: null,
      needsRecalculation: false,
      lastRecalculation: { triggeredBy: null, triggeredAt: null, reason: null },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await upsertFixture(
      "workloaddistributions",
      distDoc,
      `"${TITLES.distribution}"`,
      () => {
        console.log(
          `    o'qituvchi: ${teacherDist.lastName} ${teacherDist.firstName} (PIN ${teacherDist.oneIdPin}, teacherEntryId=${teacherEntryId})\n` +
            `    bloklar: "Kommunal gigiyena" (${scienceKommunal._id}) + "Mehnat gigiyenasi" (${scienceMehnat._id}), ikkalasi acceptanceStatus=pending\n` +
            `    approvalSteps: kafedra=approved, methodical/financial/dean/prorektor=pending; status=in_review`,
        );
      },
    );
  }

  console.log("\n── B) syllabuses — AA (draft/new) / AB (5 bosqich) ─────────");
  const syllabusApprovalSteps = pendingApprovalSteps([
    "kafedra",
    "arm",
    "methodical",
    "dean",
    "prorektor",
  ]);

  function buildSyllabus({ title, status, science, teacher, submittedAt }) {
    return {
      title,
      confirmation: {
        confirm: null,
        position: null,
        viceRector: null,
        signature: null,
        date: null,
      },
      scienceProgram: null,
      workload: null,
      workloadDistribution: null,
      science: science._id,
      scienceLabel: science.title,
      label: null,
      directions: [direction._id],
      syllabus: null,
      faculty: faculty._id,
      scienceTitle: science.title,
      scienceType: null,
      scienceCode: null,
      year: 0,
      semester: 1,
      courseRef: null,
      educationForm: null,
      hoursByType: { title: null, totalHours: 0, items: [] },
      credits: 0,
      evaluationForm: null,
      scienceLang: null,
      sciencePurpose: { title: null, desc: null },
      prerequisiteKnowledge: { title: null, desc: null },
      learningOutcome: {
        title: null,
        knowledgeAspect: null,
        knowledgeOutcomes: [],
        skillsAspect: null,
        skillOutcomes: [],
      },
      scienceContent: { title: null, desc: null, topics: [] },
      trainingSeminar: { title: null, topics: [] },
      independent: { title: null, topics: [] },
      literatureGroups: [],
      evaluationCriteria: { title: null, criteria: [] },
      author: {
        teacher: teacher._id,
        email: teacher.email || null,
        organization: null,
        reviewer: { title: null, desc: null },
      },
      desc: null,
      weeklySchedule: { title: null, weeks: [] },
      submissionRules: { title: null, desc: null },
      contactInfo: { title: null, schedule: null, room: null, phone: null, desc: null },
      methodicalHead: { position: null, leader: null, signature: null, date: null },
      facultyDean: { position: null, dean: null, signature: null, date: null },
      departmentHead: { position: null, manager: null, signature: null, date: null },
      creator: { position: null, teacher: null, signature: null, date: null },
      approvalSteps: syllabusApprovalSteps,
      status,
      submittedAt,
      location: null,
      file: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  await upsertFixture(
    "syllabuses",
    buildSyllabus({
      title: TITLES.syllabusDraft,
      status: "draft",
      science: scienceEkologiya,
      teacher: teacherSyllabusDraft,
      submittedAt: null,
    }),
    `"${TITLES.syllabusDraft}"`,
    () => {
      console.log(
        `    egasi: ${teacherSyllabusDraft.lastName} ${teacherSyllabusDraft.firstName} (PIN ${teacherSyllabusDraft.oneIdPin})\n` +
          `    fan: "${scienceEkologiya.title}"; status=draft ("Qoralama" tab); approvalSteps=5x pending (kafedra→arm→methodical→dean→prorektor)\n` +
          `    ⚠️ draft/new — faqat EGASI (yoki super_admin) ko'radi (_shared/draftVisibility.js)`,
      );
    },
  );

  await upsertFixture(
    "syllabuses",
    buildSyllabus({
      title: TITLES.syllabusNew,
      status: "new",
      science: scienceGigiyenaTibbiy,
      teacher: teacherSyllabusNew,
      submittedAt: null,
    }),
    `"${TITLES.syllabusNew}"`,
    () => {
      console.log(
        `    egasi: ${teacherSyllabusNew.lastName} ${teacherSyllabusNew.firstName} (PIN ${teacherSyllabusNew.oneIdPin})\n` +
          `    fan: "${scienceGigiyenaTibbiy.title}"; status=new ("Yangi" tab, Tasdiqlashga yuborish tugmasi); approvalSteps=5x pending\n` +
          `    ⚠️ draft/new — faqat EGASI (yoki super_admin) ko'radi (_shared/draftVisibility.js)`,
      );
    },
  );

  console.log(
    "\n── C) scienceprograms — W (v259 / v142 zanjiri, CHAINS import) ─",
  );
  console.log(
    `  CHAINS.v259 = [${CHAINS.v259.join(", ")}]  (${CHAINS.v259.length} bosqich)\n` +
      `  CHAINS.v142 = [${CHAINS.v142.join(", ")}]  (${CHAINS.v142.length} bosqich)`,
  );

  function buildScienceProgram({ title, formVersion, science, user, directions }) {
    return {
      title,
      confirmation: {
        confirm: null,
        position: null,
        rector: null,
        desc: null,
        signature: null,
        date: null,
      },
      science: science._id,
      label: science.title,
      directions,
      studyPlan: null,
      workingPlan: null,
      knowledgeArea: [],
      educationArea: [],
      code: null,
      academicYear: academicYear._id,
      semester: "1",
      courseRef: null,
      credits: null,
      moduleType: null,
      language: null,
      weeklyHours: null,
      classroomHours: null,
      independentHours: null,
      totalHours: null,
      hourItems: [],
      lectureHours: null,
      seminarHours: null,
      labHours: null,
      practicalHours: null,
      scienceEssence: {
        title: null,
        sciencePurpose: { title: null, desc: null },
        scienceTasks: { title: null, desc: null },
      },
      theoretical: { title: null, desc: null, topics: [] },
      seminarRecommendation: null,
      independentTask: null,
      learningOutcome: { title: null, learningOutcome: null, desc: null },
      teachingMethods: null,
      creditRequirements: null,
      literatureGroups: [],
      guidanceLiterature: null,
      primaryLiterature: null,
      additionalLiterature: null,
      informationSource: null,
      approval_info: null,
      responsible: null,
      reviewer: null,
      formVersion,
      approvalSteps: pendingApprovalSteps(CHAINS[formVersion]),
      status: "draft",
      barcode: null,
      file: null,
      location: null,
      active: true,
      user: user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  await upsertFixture(
    "scienceprograms",
    buildScienceProgram({
      title: TITLES.scienceProgramV259,
      formVersion: "v259",
      science: scienceRadiatsion,
      user: teacherScienceProgramV259,
      directions: [direction._id],
    }),
    `"${TITLES.scienceProgramV259}"`,
    () => {
      console.log(
        `    egasi: ${teacherScienceProgramV259.lastName} ${teacherScienceProgramV259.firstName} (PIN ${teacherScienceProgramV259.oneIdPin})\n` +
          `    fan: "${scienceRadiatsion.title}"; formVersion=v259; status=draft; approvalSteps=${CHAINS.v259.length}x pending (${CHAINS.v259.join(" → ")})`,
      );
    },
  );

  await upsertFixture(
    "scienceprograms",
    buildScienceProgram({
      title: TITLES.scienceProgramV142,
      formVersion: "v142",
      science: scienceEkologiyaGigiyena,
      user: teacherScienceProgramV142,
      directions: [direction._id],
    }),
    `"${TITLES.scienceProgramV142}"`,
    () => {
      console.log(
        `    egasi: ${teacherScienceProgramV142.lastName} ${teacherScienceProgramV142.firstName} (PIN ${teacherScienceProgramV142.oneIdPin})\n` +
          `    fan: "${scienceEkologiyaGigiyena.title}"; formVersion=v142; status=draft; approvalSteps=${CHAINS.v142.length}x pending (${CHAINS.v142.join(" → ")})\n` +
          `    directions: ["${direction.title}"] (fakultet: "${faculty.title}")`,
      );
    },
  );

  console.log(
    "\n── D) personalworkplans — 4.03 shaxsiy ish reja (II–VI to'ldirilgan) ─",
  );
  {
    const sourcePlan = await db
      .collection("personalworkplans")
      .findOne(
        { name: { $ne: TITLES.personalWorkPlan }, academicYear: { $ne: null } },
        { projection: { academicYear: 1, name: 1 } },
      );
    const sourceLabel = sourcePlan
      ? sourcePlan.name || `_id=${sourcePlan._id}`
      : null;
    const planAcademicYearId = sourcePlan
      ? sourcePlan.academicYear
      : academicYear._id;
    if (!sourcePlan) {
      console.log(
        "  ⚠️ Mavjud (QA bo'lmagan) reja topilmadi — academicYear " +
          `"${academicYear.title}" (academicyears) dan olindi.`,
      );
    }

    const D = (iso) => new Date(`${iso}T00:00:00.000Z`);

    const planDoc = {
      teacher: teacherDist._id,
      name: TITLES.personalWorkPlan,
      academicYear: planAcademicYearId,
      semester: null,

      teachingLoad: {
        autoGenerated: false,
        generatedAt: null,
        plannedHour: 0,
        completedHour: 0,
        sciences: [],
      },

      status: "draft",
      approvedBy: null,
      approvalDate: null,
      approvalComment: null,
      fileUrl: null,
      active: true,

      methodicalWork: [
        workItem({
          title: "Kommunal gigiyena fanidan uslubiy qo'llanma tayyorlash",
          description:
            "Amaliy mashg'ulotlar uchun uslubiy qo'llanma matnini tayyorlash va kafedra muhokamasidan o'tkazish",
          deadline: D("2026-12-25"),
          plannedCount: 1,
          semester: [1],
        }),
        workItem({
          title: "Mehnat gigiyenasi fanidan ma'ruza matnlarini yangilash",
          description:
            "Amaldagi sanitariya normalari va yangi adabiyotlar asosida ma'ruza matnlarini qayta ko'rib chiqish",
          deadline: D("2027-03-20"),
          plannedCount: 12,
          semester: [2],
        }),
      ],

      researchWork: [
        workItem({
          title:
            "Scopus bazasiga kiruvchi jurnalda ilmiy maqola chop etish",
          description:
            "\"Suv manbalarining sanitariya holati\" mavzusida ilmiy maqola tayyorlash va nashrga topshirish",
          deadline: D("2027-04-30"),
          plannedCount: 1,
          semester: [2],
        }),
        workItem({
          title:
            "Respublika ilmiy-amaliy konferensiyasida ma'ruza bilan ishtirok etish",
          description:
            "Atrof-muhit omillarining aholi salomatligiga ta'siri bo'yicha ma'ruza",
          deadline: D("2026-11-13"),
          plannedCount: 1,
          semester: [1],
          venue: "Farg'ona jamoat salomatligi tibbiyot instituti",
        }),
      ],

      mentoringWork: [
        workItem({
          title: "\"Ustoz-shogird\": yosh o'qituvchiga ustozlik qilish",
          description:
            "Individual reja asosida oylik uchrashuvlar, dars tahlili va uslubiy yordam",
          deadline: D("2027-05-28"),
          plannedCount: 8,
          semester: [1, 2],
          studentName: "Rahimov Sardor Alisher o'g'li",
          topic: "Amaliy mashg'ulotni tashkil etish metodikasi",
          workType: "Ustozlik (individual reja)",
        }),
        workItem({
          title: "Shogird ishtirokida ochiq dars o'tkazish va tahlil qilish",
          description:
            "Kafedra a'zolari ishtirokida ochiq amaliy mashg'ulot va uning muhokamasi",
          deadline: D("2027-02-26"),
          plannedCount: 2,
          semester: [2],
          venue: "3-o'quv binosi, 214-auditoriya",
          studentName: "Rahimov Sardor Alisher o'g'li",
          workType: "Ochiq dars",
        }),
      ],

      organizationalWork: [
        workItem({
          title: "Kafedra yig'ilishlarida qatnashish va bayonnoma yuritish",
          description: "Oylik kafedra yig'ilishlari (o'quv yili davomida)",
          deadline: D("2027-06-18"),
          plannedCount: 9,
          semester: [1, 2],
        }),
        workItem({
          title:
            "Talabalar orasida sog'lom turmush tarzi targ'iboti tadbirini o'tkazish",
          description:
            "\"Toza suv — sog'lom hayot\" mavzusida ma'naviy-ma'rifiy tadbir",
          deadline: D("2026-10-30"),
          plannedCount: 1,
          semester: [1],
          venue: "Tibbiy profilaktika fakulteti majlislar zali",
        }),
      ],

      extraWork: [
        workItem({
          title: "Institut ekspert komissiyasi ishida ishtirok etish",
          description:
            "Kafedralararo ekspert komissiyasi a'zosi sifatida hujjatlarni ko'rib chiqish",
          deadline: D("2027-01-29"),
          plannedCount: 1,
          semester: [1],
          note: "Rejadan tashqari — buyruq asosida",
        }),
        workItem({
          title:
            "Fan olimpiadasi hakamlar hay'ati a'zosi sifatida ishtirok etish",
          description:
            "Gigiyena fanlari bo'yicha institut bosqichi olimpiadasi",
          deadline: D("2027-04-09"),
          plannedCount: 1,
          semester: [2],
          note: "Rejadan tashqari",
        }),
      ],

      approvals: pendingPlanApprovals(),

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await upsertFixture(
      "personalworkplans",
      planDoc,
      `"${TITLES.personalWorkPlan}"`,
      () => {
        const sectionCounts = [
          `methodicalWork=${planDoc.methodicalWork.length}`,
          `researchWork=${planDoc.researchWork.length}`,
          `mentoringWork=${planDoc.mentoringWork.length}`,
          `organizationalWork=${planDoc.organizationalWork.length}`,
          `extraWork=${planDoc.extraWork.length}`,
        ].join(", ");
        console.log(
          `    o'qituvchi: ${teacherDist.lastName} ${teacherDist.firstName} (PIN ${teacherDist.oneIdPin})\n` +
            `    academicYear: ${planAcademicYearId}` +
            `${sourceLabel ? ` (manba: mavjud reja ${sourceLabel})` : ""}\n` +
            `    status=draft; kalit maydon = name (title EMAS)\n` +
            `    I bo'lim (teachingLoad): BO'SH — sciences=0, plannedHour=0 (4.2→4.3 generate alohida sinaladi)\n` +
            `    II–VI bo'limlar: ${sectionCounts} (jami 10 element, hammasi status=planned, verification=pending)\n` +
            `    approvals = ${planDoc.approvals.length}x pending (${PWP_APPROVAL_STEPS.map((s) => s.step).join(" → ")})`,
        );
      },
    );
  }

  console.log("\nXULOSA:");
  console.log(`  yaratildi = ${stats.created}   allaqachon mavjud (SKIP) = ${stats.skipped}`);
  if (DRY) {
    console.log(
      "\nYozish uchun `--write` bilan qayta ishga tushiring (avval mongodump zaxira oling!).",
    );
  }
}
