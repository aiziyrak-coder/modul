const request = require("supertest");
const { ROLES } = require("#config/constants");
const DepartmentModel = require("#references/department/department.model");
const { buildTestApp } = require("./helpers/app");
const { createAuthedUser } = require("./helpers/auth");

const app = buildTestApp();

describe("Smoke — GET /api/distributions/paginate", () => {
  test("autentifikatsiyasiz so'rov -> 401", async () => {
    const res = await request(app).get("/api/distributions/paginate");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token topilmadi");
  });

  test("oqituvchi roli -> 403 (readAll huquqi yo'q)", async () => {
    const { token } = await createAuthedUser(ROLES.OQITUVCHI);

    const res = await request(app)
      .get("/api/distributions/paginate")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test("kafedra_mudiri roli -> 200 (readAll bor, department-scope o'tadi)", async () => {
    const department = await DepartmentModel.create({ title: "Test kafedra" });
    const { token } = await createAuthedUser(ROLES.KAFEDRA_MUDIRI, {
      department: department._id,
    });

    const res = await request(app)
      .get("/api/distributions/paginate?page=1&limit=20")
      .set("Authorization", `Bearer ${token}`);

    expect({ status: res.status, body: res.body }).toEqual(
      expect.objectContaining({ status: 200 }),
    );
    expect(res.body).toHaveProperty("docs");
    expect(Array.isArray(res.body.docs)).toBe(true);
  });
});
