"use strict";

jest.mock("#shared/winston.logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(null),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getDepartmentHeadUserIds: jest.fn().mockResolvedValue([]),
}));
jest.mock("#references/science/science.model", () => ({ findById: jest.fn() }));
jest.mock("./workloadDistribution.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const winston = require("#shared/winston.logger");
const chainNotify = require("#modules/4.02-studyLoad/_shared/chainNotify");
const Science = require("#references/science/science.model");
const WorkloadDistribution = require("./workloadDistribution.model");
const {
  notifyTeacherAssigned,
  notifyHeadsTeacherResponded,
  personName,
} = require("./workloadDistribution.teacherNotify");
const Controller = require("./workloadDistribution.controller");

const flush = () => new Promise((r) => setImmediate(r));

const DIST_ID = "cccccccccccccccccccccccc";
const ENTRY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const HEAD_ID = "dddddddddddddddddddddddd";
const DEPT_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const SCI_ID = "ffffffffffffffffffffffff";

const mockScience = (doc) => {
  Science.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  chainNotify.getDepartmentHeadUserIds.mockResolvedValue([HEAD_ID]);
  mockScience({ _id: SCI_ID, title: "Klinik anatomiya", scienceCode: "KAN1504" });
});

describe("notifyTeacherAssigned — biriktirish → o'qituvchiga workload_assigned", () => {
  test("fan nomi + soat bilan, «O'quv yuklamalar»ga havola", async () => {
    await notifyTeacherAssigned({ teacherUserId: USER_ID, distributionId: DIST_ID, science: SCI_ID, hours: 129 });

    expect(chainNotify.safeDispatch).toHaveBeenCalledTimes(1);
    const p = chainNotify.safeDispatch.mock.calls[0][0];
    expect(p).toMatchObject({
      userId: USER_ID,
      eventType: "workload_assigned",
      link: "/study-load/my-workloads",
      metadata: { distributionId: DIST_ID, science: SCI_ID, hours: 129 },
    });
    expect(p.body).toContain("Klinik anatomiya");
    expect(p.body).toContain("129 soat");
  });

  test("vakant slot (teacher null) — xabar YO'Q, DB o'qilmaydi", async () => {
    await notifyTeacherAssigned({ teacherUserId: null, distributionId: DIST_ID, science: SCI_ID, hours: 10 });
    expect(chainNotify.safeDispatch).not.toHaveBeenCalled();
    expect(Science.findById).not.toHaveBeenCalled();
  });

  test("fan topilmasa ham xabar ketadi («Fan» zaxira nomi bilan)", async () => {
    mockScience(null);
    await notifyTeacherAssigned({ teacherUserId: USER_ID, distributionId: DIST_ID, science: SCI_ID, hours: 5 });
    expect(chainNotify.safeDispatch.mock.calls[0][0].body).toContain("«Fan»");
  });

  test("best-effort: Science o'qish yiqilsa — warn, throw YO'Q", async () => {
    Science.findById.mockImplementation(() => { throw new Error("db down"); });
    await expect(
      notifyTeacherAssigned({ teacherUserId: USER_ID, distributionId: DIST_ID, science: SCI_ID, hours: 5 }),
    ).resolves.toBeUndefined();
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("workload_assigned"));
    expect(chainNotify.safeDispatch).not.toHaveBeenCalled();
  });
});

describe("notifyHeadsTeacherResponded — qabul/rad → kafedra mudiriga", () => {
  const dist = { _id: DIST_ID, department: DEPT_ID, title: "Normal anatomiya taqsimoti" };
  const entry = { _id: ENTRY_ID };
  const actor = { _id: USER_ID, firstName: "Ikkinchi", lastName: "O'qituvchi" };

  test("rad → workload_rejected, sarlavhada ism, tanada sabab, taqsimot havolasi", async () => {
    await notifyHeadsTeacherResponded({ dist, entry, action: "rejected", reason: "mutaxassisligimga mos emas", actor });

    expect(chainNotify.getDepartmentHeadUserIds).toHaveBeenCalledWith(DEPT_ID);
    expect(chainNotify.safeDispatchMany).toHaveBeenCalledTimes(1);
    const [ids, p] = chainNotify.safeDispatchMany.mock.calls[0];
    expect(ids).toEqual([HEAD_ID]);
    expect(p).toMatchObject({
      eventType: "workload_rejected",
      body: "mutaxassisligimga mos emas",
      link: `/study-load/distributions/${DIST_ID}`,
      metadata: { distributionId: DIST_ID, entryId: ENTRY_ID, teacher: USER_ID, action: "rejected" },
    });
    expect(p.title).toContain("rad etdi");
    expect(p.title).toContain("O'qituvchi Ikkinchi");
  });

  test("qabul → workload_approved, taqsimot nomi tanada", async () => {
    await notifyHeadsTeacherResponded({ dist, entry, action: "accepted", reason: undefined, actor });
    const [, p] = chainNotify.safeDispatchMany.mock.calls[0];
    expect(p.eventType).toBe("workload_approved");
    expect(p.title).toContain("qabul qildi");
    expect(p.body).toContain("Normal anatomiya taqsimoti");
  });

  test("rad sababsiz — «Sabab ko'rsatilmagan»", async () => {
    await notifyHeadsTeacherResponded({ dist, entry, action: "rejected", reason: "", actor });
    expect(chainNotify.safeDispatchMany.mock.calls[0][1].body).toBe("Sabab ko'rsatilmagan");
  });

  test("kafedrada mudir yo'q — dispatch chaqirilmaydi", async () => {
    chainNotify.getDepartmentHeadUserIds.mockResolvedValue([]);
    await notifyHeadsTeacherResponded({ dist, entry, action: "accepted", actor });
    expect(chainNotify.safeDispatchMany).not.toHaveBeenCalled();
  });

  test("best-effort: mudir qidiruvi yiqilsa — warn, throw YO'Q", async () => {
    chainNotify.getDepartmentHeadUserIds.mockRejectedValue(new Error("db down"));
    await expect(notifyHeadsTeacherResponded({ dist, entry, action: "accepted", actor })).resolves.toBeUndefined();
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("teacher respond"));
  });

  test("personName: familiya + ism; bo'sh bo'lsa zaxira", () => {
    expect(personName({ firstName: "Anvar", lastName: "Anatomov" })).toBe("Anatomov Anvar");
    expect(personName({})).toBe("O'qituvchi");
    expect(personName(null)).toBe("O'qituvchi");
  });
});

describe("Controller.teacherRespond — javobdan keyin mudirga xabar (integratsiya, mock model)", () => {
  const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  const BLOCK_ID = "111111111111111111111111";

  const runRespond = async (action, reason) => {
    const doc = {
      _id: DIST_ID,
      department: DEPT_ID,
      title: "Taqsimot",
      teachers: [
        {
          _id: ENTRY_ID,
          teacher: USER_ID,
          acceptanceStatus: "pending",
          blocks: [{ _id: BLOCK_ID, acceptanceStatus: action, rejectionReason: reason || null }],
        },
      ],
    };
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
    WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();
    await Controller.teacherRespond(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
        body: { action, reason },
        user: { _id: USER_ID, firstName: "Ikkinchi", lastName: "O'qituvchi" },
      },
      res,
      next,
    );
    await flush();
    return { res, next };
  };

  test("rad etish → 200 va mudirga workload_rejected (sabab bilan)", async () => {
    const { res, next } = await runRespond("rejected", "R3 sinov sababi");
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(chainNotify.safeDispatchMany).toHaveBeenCalledTimes(1);
    const [ids, p] = chainNotify.safeDispatchMany.mock.calls[0];
    expect(ids).toEqual([HEAD_ID]);
    expect(p.eventType).toBe("workload_rejected");
    expect(p.body).toBe("R3 sinov sababi");
    expect(p.metadata).toMatchObject({ distributionId: DIST_ID, entryId: ENTRY_ID, teacher: USER_ID });
  });

  test("qabul → 200 va mudirga workload_approved", async () => {
    const { res } = await runRespond("accepted");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(chainNotify.safeDispatchMany.mock.calls[0][1].eventType).toBe("workload_approved");
  });

  test("egalik mos kelmasa (404) — xabar YO'Q", async () => {
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
    WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue(null);
    const res = createRes();
    await Controller.teacherRespond(
      { params: { id: DIST_ID, teacherEntryId: ENTRY_ID }, body: { action: "accepted" }, user: { _id: USER_ID } },
      res,
      jest.fn(),
    );
    await flush();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(chainNotify.safeDispatchMany).not.toHaveBeenCalled();
  });
});
