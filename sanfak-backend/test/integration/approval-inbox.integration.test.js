const request = require("supertest");
const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const DepartmentModel = require("#references/department/department.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { buildTestApp } = require("./helpers/app");
const { createAuthedUser } = require("./helpers/auth");

const app = buildTestApp();

const inbox = (token, query = "") =>
  request(app)
    .get(`/api/approval-inbox${query}`)
    .set("Authorization", `Bearer ${token}`);

async function buildInboxFixture() {
  const academicYear = await AcademicYearModel.create({ title: "2025/2026" });
  const [ownDept, otherDept] = await Promise.all([
    DepartmentModel.create({ title: "Ichki kasalliklar kafedrasi" }),
    DepartmentModel.create({ title: "Stomatologiya kafedrasi" }),
  ]);

  const base = {
    workload: new mongoose.Types.ObjectId(),
    academicYear: academicYear._id,
    status: "in_review",
    active: true,
    date: "2025-09-01",
  };

  const steps = (approvedUpTo) =>
    ["kafedra", "methodical", "financial", "dean", "prorektor"].map((step, i) => ({
      step,
      status: i < approvedUpTo ? "approved" : "pending",
      date: i < approvedUpTo ? new Date("2026-07-01T00:00:00.000Z") : null,
    }));

  const docA = await WorkloadDistributionModel.create({
    ...base,
    department: ownDept._id,
    title: "A — joriy qadam: kafedra",
    approvalSteps: steps(0),
  });

  const docB = await WorkloadDistributionModel.create({
    ...base,
    department: ownDept._id,
    title: "B — joriy qadam: methodical",
    approvalSteps: steps(1),
  });

  const docC = await WorkloadDistributionModel.create({
    ...base,
    department: otherDept._id,
    title: "C — begona kafedra, joriy qadam: kafedra",
    approvalSteps: steps(0),
  });

  return { academicYear, ownDept, otherDept, docA, docB, docC };
}

const titles = (body) => body.map((r) => r.title);

describe("TZ 4.2.7 / P-7 — GET /api/approval-inbox", () => {
  describe("Kirish nazorati (permit() YO'Q — shuning uchun alohida sinaladi)", () => {
    test("tokensiz -> 401", async () => {
      const res = await request(app).get("/api/approval-inbox");

      expect(res.status).toBe(401);
    });

    test("noma'lum entity -> 400", async () => {
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI);

      const res = await inbox(token, "?entity=hacker");

      expect(res.status).toBe(400);
    });
  });

  describe("ROL filtri — bu `permit()` o'rnini bosadi", () => {
    test("kafedra mudiri: FAQAT joriy qadami 'kafedra' bo'lgan hujjatni ko'radi", async () => {
      const { ownDept } = await buildInboxFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await inbox(token);

      expect(res.status).toBe(200);
      expect(titles(res.body)).toEqual(["A — joriy qadam: kafedra"]);
    });

    test("ENG MUHIM: rolga mos qadam BOR, lekin JORIY emas → qaytmaydi", async () => {
      const { ownDept } = await buildInboxFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await inbox(token);

      expect(titles(res.body)).not.toContain("B — joriy qadam: methodical");
    });

    test("O'UB: 'methodical' qadamidagi hujjatni ko'radi, 'kafedra' dagini ko'rmaydi", async () => {
      await buildInboxFixture();
      const { token } = await createAuthedUser(ROLES.OQUV_USLUBIY_BOSHQARMA);

      const res = await inbox(token);

      expect(res.status).toBe(200);
      expect(titles(res.body)).toContain("B — joriy qadam: methodical");
      expect(titles(res.body)).not.toContain("A — joriy qadam: kafedra");
    });

    test("zanjirda umuman roli yo'q foydalanuvchi → bo'sh massiv (403 emas)", async () => {
      await buildInboxFixture();
      const { token } = await createAuthedUser(ROLES.OQITUVCHI);

      const res = await inbox(token);

      expect(res.status).toBe(200);
      expect(titles(res.body)).not.toContain("A — joriy qadam: kafedra");
      expect(titles(res.body)).not.toContain("B — joriy qadam: methodical");
    });
  });

  describe("SCOPE filtri — kafedralararo oqish bo'lmasin", () => {
    test("kafedra mudiri BEGONA kafedraning hujjatini ko'rmaydi", async () => {
      const { ownDept } = await buildInboxFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await inbox(token);

      expect(titles(res.body)).not.toContain(
        "C — begona kafedra, joriy qadam: kafedra",
      );
    });

    test("O'UB (global scope) har ikkala kafedrani ko'radi", async () => {
      await buildInboxFixture();
      const otherDept = await DepartmentModel.findOne({
        title: "Stomatologiya kafedrasi",
      });
      const ay = await AcademicYearModel.findOne({});
      await WorkloadDistributionModel.create({
        workload: new mongoose.Types.ObjectId(),
        academicYear: ay._id,
        department: otherDept._id,
        status: "in_review",
        active: true,
        date: "2025-09-01",
        title: "D — begona kafedra, joriy qadam: methodical",
        approvalSteps: [
          { step: "kafedra", status: "approved", date: new Date() },
          { step: "methodical", status: "pending" },
        ],
      });

      const { token } = await createAuthedUser(ROLES.OQUV_USLUBIY_BOSHQARMA);
      const res = await inbox(token);

      expect(titles(res.body)).toEqual(
        expect.arrayContaining([
          "B — joriy qadam: methodical",
          "D — begona kafedra, joriy qadam: methodical",
        ]),
      );
    });
  });

  describe("Javob kontrakti va holat filtri", () => {
    test("`in_review` bo'lmagan hujjat inbox'ga TUSHMAYDI", async () => {
      const { ownDept, docA } = await buildInboxFixture();
      docA.status = "approved";
      await docA.save();

      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });
      const res = await inbox(token);

      expect(titles(res.body)).not.toContain("A — joriy qadam: kafedra");
    });

    test("yozuv shakli: entity/id/step/department/academicYear qaytadi", async () => {
      const { ownDept, academicYear } = await buildInboxFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await inbox(token);
      const row = res.body[0];

      expect(row.entity).toBe("distribution");
      expect(row.step).toBe("kafedra");
      expect(row.id).toBeTruthy();
      expect(row.department).toEqual({
        _id: ownDept._id.toString(),
        title: "Ichki kasalliklar kafedrasi",
      });
      expect(row.academicYear).toEqual({
        _id: academicYear._id.toString(),
        title: academicYear.title,
      });
    });

    test("`entity=` filtri ishlaydi", async () => {
      const { ownDept } = await buildInboxFixture();
      const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
        department: ownDept._id,
      });

      const res = await inbox(token, "?entity=syllabus");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
