const request = require("supertest");
const { ROLES } = require("#config/constants");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildTestApp } = require("./helpers/app");
const { createAuthedUser } = require("./helpers/auth");
const { buildWorkloadFixture } = require("./helpers/workloadFixture");

const app = buildTestApp();

async function postAsUob() {
  const fixture = await buildWorkloadFixture();
  const { token } = await createAuthedUser(ROLES.OQUV_USLUBIY_BOSHQARMA);

  const res = await request(app)
    .post("/api/workloads")
    .set("Authorization", `Bearer ${token}`)
    .send({
      department: fixture.department._id.toString(),
      academicYear: fixture.academicYear._id.toString(),
    });

  return { fixture, res };
}

describe("Integration — POST /api/workloads (B-3 RBAC + B-1 calculateBlockTotal)", () => {
  test("oqituvchi roli -> 403 (workload:create huquqi yo'q) — regression guard", async () => {
    const fixture = await buildWorkloadFixture();
    const { token } = await createAuthedUser(ROLES.OQITUVCHI);

    const res = await request(app)
      .post("/api/workloads")
      .set("Authorization", `Bearer ${token}`)
      .send({
        department: fixture.department._id.toString(),
        academicYear: fixture.academicYear._id.toString(),
      });

    expect(res.status).toBe(403);
  });

  test("O'UB roli -> 201 (B-3: workload:create endi ishlaydi)", async () => {
    const { res } = await postAsUob();

    expect({ status: res.status, body: res.body }).toEqual(
      expect.objectContaining({ status: 201 }),
    );
    expect(res.body).toHaveProperty("_id");
    expect(res.body.directionsCount).toBe(1);
    expect(res.body.totalBlocks).toBe(1);
  });

  test("B-1: yaratilgan yuklamada totalHour > 0 (avval har doim 0 edi)", async () => {
    const { res } = await postAsUob();
    expect(res.status).toBe(201);

    const doc = await WorkloadModel.findById(res.body._id).lean();
    const block = doc.directions[0].blocks[0];

    expect(block.totalHour).toBeGreaterThan(0);
  });

  test("Ko'paytiruvchi qoidasi: ma'ruza -> oqim soni, amaliy/laboratoriya -> guruh soni", async () => {
    const { fixture, res } = await postAsUob();
    expect(res.status).toBe(201);

    const doc = await WorkloadModel.findById(res.body._id).lean();
    const block = doc.directions[0].blocks[0];

    expect(block.studyWork.stream).toBe(fixture.EXPECTED.streamCount);
    expect(block.studyWork.group).toBe(fixture.EXPECTED.groupCount);
    expect(block.student).toBe(fixture.EXPECTED.studentCount);
    expect(block.studyWork.thisSemester.auditoriumHour).toBe(
      fixture.EXPECTED.planAuditoriumHour,
    );
    expect(block.studyWork.thisSemester.teachingAuditoriumHour).toBe(
      fixture.EXPECTED.teachingAuditoriumHour,
    );

    const itemVal = (slug) =>
      block.studyWork.items.find((it) => it.slug === slug)?.value;
    expect(itemVal("on")).toBe(fixture.EXPECTED.onHours);
    expect(itemVal("yan")).toBe(fixture.EXPECTED.yanHours);
    expect(itemVal("qoldirilgan")).toBe(fixture.EXPECTED.qoldirilganHours);

    expect(block.totalHour).toBe(fixture.EXPECTED.totalHour);
  });

  test("staffPositions — jami shtat birligi Position.annualHours normasiga qarab hisoblangan", async () => {
    const { fixture, res } = await postAsUob();
    expect(res.status).toBe(201);

    const doc = await WorkloadModel.findById(res.body._id).lean();

    expect(doc.staffPositions.totalPositions).toBe(
      fixture.EXPECTED.totalPositions,
    );
    expect(doc.staffPositions.totalPositions).toBeGreaterThan(0);
    expect(doc.staffPositions.hourly).toBe(fixture.EXPECTED.hourly);
  });
});
