jest.mock("#modules/4.07-task/taskAssigneeGrant/taskAssigneeGrant.service", () => ({
  isPlatformAdmin: () => false,
  isStrictMode: () => false,
  grantedAssigneeIds: jest.fn().mockResolvedValue(new Set()),
}));

const mongoose = require("mongoose");
const service = require("./task.service");
const { ROLES } = require("#config/constants");

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

const fakeModels = () => {
  const User = { paginate: jest.fn().mockResolvedValue({ docs: [], totalDocs: 0 }) };
  const Department = { distinct: jest.fn().mockResolvedValue(["dep-in-faculty"]) };
  jest.spyOn(mongoose, "model").mockImplementation((name) => {
    if (name === "user") return User;
    if (name === "department") return Department;
    throw new Error("kutilmagan model: " + name);
  });
  return { User, Department };
};

afterEach(() => jest.restoreAllMocks());

const dekan = (extra = {}) => ({
  _id: "6a7da70157df92f4847a95a5",
  role: { title: ROLES.DEKAN, scopeLevel: "faculty" },
  ...extra,
});

describe("assignableUsers — dekan fakulteti (ADR-030 Faza 2)", () => {
  test("(c) users.faculty ≠ department.faculty → kafedralar users.faculty bo'yicha qidiriladi", async () => {
    const { User, Department } = fakeModels();
    await service.assignableUsers(dekan({ faculty: F_OWN, department: { _id: "d1", faculty: F_DEP } }), {});
    expect(Department.distinct).toHaveBeenCalledWith("_id", { faculty: F_OWN });
    expect(User.paginate.mock.calls[0][0]).toEqual(expect.objectContaining({ department: { $in: ["dep-in-faculty"] } }));
  });

  test("(a) kafedrasiz dekan, faqat users.faculty → bo'sh sahifa EMAS, fakultet bo'yicha", async () => {
    const { User, Department } = fakeModels();
    await service.assignableUsers(dekan({ faculty: F_OWN, department: null }), {});
    expect(Department.distinct).toHaveBeenCalledWith("_id", { faculty: F_OWN });
    expect(User.paginate).toHaveBeenCalled();
  });

  test("(b) faqat department.faculty → zaxira (avvalgi xulq)", async () => {
    const { Department } = fakeModels();
    await service.assignableUsers(dekan({ department: { _id: "d1", faculty: F_DEP } }), {});
    expect(Department.distinct).toHaveBeenCalledWith("_id", { faculty: F_DEP });
  });

  test("fakultetsiz va kafedrasiz dekan → bo'sh sahifa (DB so'rovisiz)", async () => {
    const { User, Department } = fakeModels();
    const out = await service.assignableUsers(dekan({ faculty: null, department: null }), {});
    expect(out.docs).toEqual([]);
    expect(Department.distinct).not.toHaveBeenCalled();
    expect(User.paginate).not.toHaveBeenCalled();
  });

  test("kafedra mudiri (department): users.faculty e'tiborsiz — kafedra bo'yicha", async () => {
    const { User, Department } = fakeModels();
    await service.assignableUsers(
      { _id: "6a7da70157df92f4847a95a7", role: { title: ROLES.KAFEDRA_MUDIRI, scopeLevel: "department" }, faculty: F_OWN, department: { _id: "d1", faculty: F_DEP } },
      {},
    );
    expect(Department.distinct).not.toHaveBeenCalled();
    expect(User.paginate.mock.calls[0][0]).toEqual(expect.objectContaining({ department: "d1" }));
  });
});
