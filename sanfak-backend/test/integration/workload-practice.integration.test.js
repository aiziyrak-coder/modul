const request = require("supertest");
const { ROLES } = require("#config/constants");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const DirectionModel = require("#references/direction/direction.model");
const DepartmentModel = require("#references/department/department.model");
const { buildTestApp } = require("./helpers/app");
const { createAuthedUser } = require("./helpers/auth");
const { buildWorkloadFixture } = require("./helpers/workloadFixture");

const app = buildTestApp();

const PRACTICE_HOURS = 40;
const PRACTICE_ENTRY = Object.freeze({
  title: "Malakaviy amaliyot",
  code: "MM2-520",
  particle: [
    {
      canonical: "hour",
      slug: "soat",
      title: "Umumiy yuklamaning hajmi soat",
      value: PRACTICE_HOURS,
    },
  ],
});

const ATTESTATION_HOURS = 120;
const ATTESTATION_ENTRY = Object.freeze({
  title: "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi",
  code: "BAKYDA604",
  particle: [
    {
      canonical: "hour",
      slug: "soat",
      title: "Umumiy yuklamaning hajmi soat",
      value: ATTESTATION_HOURS,
    },
  ],
});

async function buildPracticeFixture({ practiceDepartment, extraSciences = [] } = {}) {
  const fixture = await buildWorkloadFixture();

  const resolved =
    practiceDepartment === "self" ? fixture.department._id : practiceDepartment;
  if (resolved !== undefined) {
    await DirectionModel.findByIdAndUpdate(fixture.direction._id, {
      practiceDepartment: resolved,
    });
  }

  await WorkingPlanModel.deleteOne({ _id: fixture.workingPlan._id });

  const sem1 = fixture.workingPlan.semesters.get("1");
  const originalSciences = sem1.blocks[0].sciences.map((s) => s.toObject());

  const workingPlan = await WorkingPlanModel.create({
    workingSchedule: fixture.workingSchedule._id,
    semesters: {
      1: {
        semester: "1",
        blocks: [
          {
            blockCode: "BLK1",
            title: "Majburiy fanlar",
            sciences: [...originalSciences, PRACTICE_ENTRY, ...extraSciences],
          },
        ],
      },
    },
  });

  return { ...fixture, workingPlan };
}

async function buildPracticeOnlyFixture() {
  const fixture = await buildWorkloadFixture();
  await WorkingPlanModel.deleteOne({ _id: fixture.workingPlan._id });

  const workingPlan = await WorkingPlanModel.create({
    workingSchedule: fixture.workingSchedule._id,
    semesters: {
      1: {
        semester: "1",
        blocks: [
          {
            blockCode: "BLK1",
            title: "Majburiy fanlar",
            sciences: [PRACTICE_ENTRY],
          },
        ],
      },
    },
  });

  return { ...fixture, workingPlan };
}

async function postAsUob(fixture) {
  const { token } = await createAuthedUser(ROLES.OQUV_USLUBIY_BOSHQARMA);

  return request(app)
    .post("/api/workloads")
    .set("Authorization", `Bearer ${token}`)
    .send({
      department: fixture.department._id.toString(),
      academicYear: fixture.academicYear._id.toString(),
    });
}

describe("Integration — POST /api/workloads amaliyot soati (practiceDepartment)", () => {
  test("1) practiceDepartment = so'ralgan kafedra -> soat 'malakaviy' ustuniga qo'shiladi va totalHour ga kiradi", async () => {
    const fixture = await buildPracticeFixture({ practiceDepartment: "self" });

    const res = await postAsUob(fixture);
    expect(res.status).toBe(201);

    const doc = await WorkloadModel.findById(res.body._id).lean();
    const block = doc.directions[0].blocks[0];
    const malakaviy = block.studyWork.items.find((it) => it.slug === "malakaviy");

    expect(malakaviy.value).toBe(PRACTICE_HOURS);
    expect(block.totalHour).toBe(fixture.EXPECTED.totalHour + PRACTICE_HOURS);
  });

  test("2) practiceDepartment = BO'SH (null, default) -> amaliyot soati QO'SHILMAYDI (eski xatti-harakat)", async () => {
    const fixture = await buildPracticeFixture({});

    const res = await postAsUob(fixture);
    expect(res.status).toBe(201);

    const doc = await WorkloadModel.findById(res.body._id).lean();
    const block = doc.directions[0].blocks[0];
    const malakaviy = block.studyWork.items.find((it) => it.slug === "malakaviy");

    expect(malakaviy.value).toBe(0);
    expect(block.totalHour).toBe(fixture.EXPECTED.totalHour);
  });

  test("3) practiceDepartment = BOSHQA kafedra -> so'ralgan kafedra yuklamasiga QO'SHILMAYDI", async () => {
    const otherDepartment = await DepartmentModel.create({
      title: "Boshqa kafedra (amaliyotga mas'ul, sinov uchun)",
    });
    const fixture = await buildPracticeFixture({
      practiceDepartment: otherDepartment._id,
    });

    const res = await postAsUob(fixture);
    expect(res.status).toBe(201);

    const doc = await WorkloadModel.findById(res.body._id).lean();
    const block = doc.directions[0].blocks[0];
    const malakaviy = block.studyWork.items.find((it) => it.slug === "malakaviy");

    expect(malakaviy.value).toBe(0);
    expect(block.totalHour).toBe(fixture.EXPECTED.totalHour);
  });

  test("4) REGRESSIYA: faqat amaliyot qatoridan iborat reja -> unlinkedInPlan 0 qoladi, '14 ta bog'lanmagan' xabari chiqmaydi", async () => {
    const fixture = await buildPracticeOnlyFixture();

    const res = await postAsUob(fixture);

    expect(res.status).toBe(404);
    expect(res.body.message).not.toMatch(/bog'lanmagan/);
    expect(res.body.message).toContain("tegishli fanlar topilmadi");
  });
  test("5) ATTESTATSIYA (YADA) soati 'malakaviy' ustuniga TUSHMAYDI — amaliyot EMAS", async () => {
    const fixture = await buildPracticeFixture({
      practiceDepartment: "self",
      extraSciences: [ATTESTATION_ENTRY],
    });

    const res = await postAsUob(fixture);
    expect(res.status).toBe(201);

    const doc = await WorkloadModel.findById(res.body._id).lean();
    const block = doc.directions[0].blocks[0];
    const malakaviy = block.studyWork.items.find((it) => it.slug === "malakaviy");

    expect(malakaviy.value).toBe(PRACTICE_HOURS);
    expect(malakaviy.value).not.toBe(PRACTICE_HOURS + ATTESTATION_HOURS);
    expect(block.totalHour).toBe(fixture.EXPECTED.totalHour + PRACTICE_HOURS);

    expect(doc.directions[0].blocks).toHaveLength(1);
  });
});
