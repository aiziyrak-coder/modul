const request = require("supertest");
const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const DepartmentModel = require("#references/department/department.model");
const ScienceModel = require("#references/science/science.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { buildTestApp } = require("./helpers/app");
const { createAuthedUser } = require("./helpers/auth");

const app = buildTestApp();

const VACANT_HOUR = 320;
const ASSIGNED_HOUR = 180;

async function buildVacancyFixture() {
  const academicYear = await AcademicYearModel.create({ title: "2025/2026" });

  const [ownDept, otherDept] = await Promise.all([
    DepartmentModel.create({ title: "Ichki kasalliklar kafedrasi" }),
    DepartmentModel.create({ title: "Stomatologiya kafedrasi" }),
  ]);

  const [scienceA, scienceB] = await Promise.all([
    ScienceModel.create({ title: "Kardiologiya", department: ownDept._id }),
    ScienceModel.create({ title: "Nefrologiya", department: ownDept._id }),
  ]);

  const fakeWorkloadId = new mongoose.Types.ObjectId();

  const ownDistribution = await WorkloadDistributionModel.create({
    workload: fakeWorkloadId,
    academicYear: academicYear._id,
    department: ownDept._id,
    title: "Ichki kasalliklar — 2025/2026 taqsimoti",
    status: "approved",
    date: "2025-09-01",
    course: 3,
    active: true,
    teachers: [
      {
        isVacant: true,
        vacantLabel: "Vakant-1",
        vacancyReason: "O'qituvchi ta'tilga chiqdi",
        vacantSince: new Date("2026-07-01T00:00:00.000Z"),
        totalHour: VACANT_HOUR,
        vacancy: {
          requiredPosition: "dotsent",
          requiredSpecialization: "Kardiologiya",
          requiredAcademicTitle: "phd",
          deadline: new Date("2026-09-01T00:00:00.000Z"),
        },
        blocks: [
          { science: scienceA._id, course: 3, semester: 1, totalHour: 200 },
          { science: scienceB._id, course: 3, semester: 2, totalHour: 120 },
        ],
      },
      {
        isVacant: false,
        teacher: new mongoose.Types.ObjectId(),
        totalHour: ASSIGNED_HOUR,
        blocks: [{ science: scienceA._id, course: 3, semester: 1, totalHour: ASSIGNED_HOUR }],
      },
    ],
  });

  await WorkloadDistributionModel.create({
    workload: fakeWorkloadId,
    academicYear: academicYear._id,
    department: otherDept._id,
    title: "Stomatologiya — 2025/2026 taqsimoti",
    status: "approved",
    date: "2025-09-01",
    course: 2,
    active: true,
    teachers: [
      {
        isVacant: true,
        vacantLabel: "Begona-Vakant",
        totalHour: 999,
        blocks: [],
      },
    ],
  });

  return { academicYear, ownDept, otherDept, scienceA, scienceB, ownDistribution };
}

const authedGet = (token) =>
  request(app).get("/api/distributions/vacancies").set("Authorization", `Bearer ${token}`);

describe("TZ 4.2.4 — GET /api/distributions/vacancies (vakant reestri)", () => {
  describe("Kirish nazorati", () => {
    test("tokensiz -> 401", async () => {
      const res = await request(app).get("/api/distributions/vacancies");

      expect(res.status).toBe(401);
    });

    test("oqituvchi roli -> 403 (readAll huquqi yo'q)", async () => {
      const { token } = await createAuthedUser(ROLES.OQITUVCHI);

      const res = await authedGet(token);

      expect(res.status).toBe(403);
    });
  });

  describe("Ma'lumot to'g'riligi", () => {
    test("faqat VAKANT yozuvlar qaytadi — biriktirilgani chiqmaydi", async () => {
      const { ownDept } = await buildVacancyFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await authedGet(token);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].totalHour).toBe(VACANT_HOUR);
      expect(res.body.map((r) => r.totalHour)).not.toContain(ASSIGNED_HOUR);
    });

    test("SCOPE: kafedra mudiri boshqa kafedraning vakantini KO'RMAYDI", async () => {
      const { ownDept } = await buildVacancyFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await authedGet(token);

      expect(res.status).toBe(200);
      const labels = res.body.map((r) => r.vacantLabel);
      expect(labels).toContain("Vakant-1");
      expect(labels).not.toContain("Begona-Vakant");
    });

    test("O'UB (global scope) HAR IKKALA kafedraning vakantini ko'radi", async () => {
      await buildVacancyFixture();
      const { token } = await createAuthedUser(ROLES.OQUV_USLUBIY_BOSHQARMA);

      const res = await authedGet(token);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((r) => r.vacantLabel).sort()).toEqual([
        "Begona-Vakant",
        "Vakant-1",
      ]);
    });
  });

  describe("Javob KONTRAKTI (frontend shu nomlarga tayanadi)", () => {
    test("department/academicYear `title` bilan qaytadi (`name` EMAS)", async () => {
      const { ownDept, academicYear } = await buildVacancyFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await authedGet(token);
      const row = res.body[0];

      expect(row.department).toEqual({
        _id: ownDept._id.toString(),
        title: "Ichki kasalliklar kafedrasi",
      });
      expect(row.academicYear).toEqual({
        _id: academicYear._id.toString(),
        title: academicYear.title,
      });
      expect(row.department.name).toBeUndefined();
    });

    test("blocks[].scienceTitle to'ldirilgan — xom ObjectId qolmaydi", async () => {
      const { ownDept } = await buildVacancyFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await authedGet(token);
      const { blocks } = res.body[0];

      expect(blocks).toHaveLength(2);
      const bySemester = Object.fromEntries(blocks.map((b) => [b.semester, b]));
      expect(bySemester[1].scienceTitle).toBe("Kardiologiya");
      expect(bySemester[2].scienceTitle).toBe("Nefrologiya");
      expect(bySemester[1].totalHour).toBe(200);
    });

    test("fan o'chirilgan bo'lsa scienceTitle=null (sahifa yiqilmasin)", async () => {
      const { ownDept, academicYear } = await buildVacancyFixture();
      await WorkloadDistributionModel.create({
        workload: new mongoose.Types.ObjectId(),
        academicYear: academicYear._id,
        department: ownDept._id,
        title: "Dangling ref testi",
        status: "draft",
        date: "2025-09-01",
        active: true,
        teachers: [
          {
            isVacant: true,
            vacantLabel: "Vakant-dangling",
            totalHour: 40,
            blocks: [
              {
                science: new mongoose.Types.ObjectId(),
                course: 1,
                semester: 1,
                totalHour: 40,
              },
            ],
          },
        ],
      });

      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await authedGet(token);
      const dangling = res.body.find((r) => r.vacantLabel === "Vakant-dangling");

      expect(res.status).toBe(200);
      expect(dangling).toBeDefined();
      expect(dangling.blocks[0].scienceTitle).toBeNull();
    });

    test("vakant metama'lumotlari (talab/muddat) to'liq qaytadi", async () => {
      const { ownDept, ownDistribution } = await buildVacancyFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await authedGet(token);
      const row = res.body[0];

      expect(row.distributionId).toBe(ownDistribution._id.toString());
      expect(row.distributionTitle).toBe("Ichki kasalliklar — 2025/2026 taqsimoti");
      expect(row.distributionStatus).toBe("approved");
      expect(row.course).toBe(3);
      expect(row.requiredPosition).toBe("dotsent");
      expect(row.requiredSpecialization).toBe("Kardiologiya");
      expect(row.requiredAcademicTitle).toBe("phd");
      expect(row.deadline).toBeTruthy();
      expect(row.vacancyReason).toBe("O'qituvchi ta'tilga chiqdi");
      expect(row.teacherEntryId).toBeTruthy();
      expect(row.vacancyNumber).toBe(1);
      expect(row.postedAt).toBeTruthy();
    });
  });
});
