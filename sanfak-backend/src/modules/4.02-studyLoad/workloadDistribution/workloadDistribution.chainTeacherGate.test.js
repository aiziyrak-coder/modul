jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");
const { ROLES } = require("#config/constants");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDist = (teachers) => ({
  _id: DIST_ID,
  status: "in_review",
  teachers,
  approvalSteps: [
    { step: "kafedra", status: "approved" },
    { step: "methodical", status: "pending" },
    { step: "financial", status: "pending" },
  ],
  save: jest.fn().mockResolvedValue(undefined),
});

const METHODICAL = 1;

let teacherSeq = 0;
const teacher = (acceptanceStatus, isVacant = false, blocks) => ({
  _id: { toString: () => `t-${acceptanceStatus}-${isVacant}-${teacherSeq++}` },
  isVacant,
  acceptanceStatus,
  totalHour: 100,
  blocks:
    blocks !== undefined
      ? blocks
      : [{ _id: "b1", acceptanceStatus }],
});

const run = async (dist, roleTitle) => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
  const next = jest.fn();
  const res = createRes();
  await Controller.approve(
    {
      params: { id: DIST_ID },
      body: {},
      query: {},
      scope: {},
      user: { _id: "507f1f77bcf86cd799439011", role: { title: roleTitle } },
    },
    res,
    next,
  );
  return { next, res, dist };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("O'UB (methodical) bosqichi — o'qituvchi javobi qulfi", () => {
  test("o'qituvchi hali `pending` bo'lsa 400 va bosqich YOPILMAYDI", async () => {
    const dist = makeDist([teacher("accepted"), teacher("pending")]);

    const { next } = await run(dist, ROLES.OQUV_USLUBIY_BOSHQARMA);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(String(err.message)).toMatch(/barcha o'qituvchilar taqsimotni qabul/i);
    expect(dist.approvalSteps[METHODICAL].status).toBe("pending");
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("`rejected` ham bloklaydi — rad etilgan ulush avval qayta taqsimlanishi kerak", async () => {
    const dist = makeDist([teacher("accepted"), teacher("rejected")]);

    const { next } = await run(dist, ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("hammasi `accepted` bo'lsa bosqich YOPILADI", async () => {
    const dist = makeDist([teacher("accepted"), teacher("accepted")]);

    await run(dist, ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(dist.approvalSteps[METHODICAL].status).toBe("approved");
    expect(dist.save).toHaveBeenCalled();
  });

  test("VAKANT o'rin hisobga olinmaydi (javob beradigan odam yo'q)", async () => {
    const dist = makeDist([teacher("accepted"), teacher("pending", true)]);

    await run(dist, ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(dist.approvalSteps[METHODICAL].status).toBe("approved");
    expect(dist.save).toHaveBeenCalled();
  });

  test("o'qituvchi umuman yo'q bo'lsa — qulf ishlamaydi (bo'sh taqsimot alohida holat)", async () => {
    const dist = makeDist([]);

    await run(dist, ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(dist.approvalSteps[METHODICAL].status).toBe("approved");
  });

  test("bloki YO'Q, vakant emas, `pending` entry — darvoza O'TADI (F-3 regressiya qulfi)", async () => {
    const dist = makeDist([teacher("pending", false, [])]);

    await run(dist, ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(dist.approvalSteps[METHODICAL].status).toBe("approved");
  });

  test("bloki BOR, `pending` entry — darvoza bloklaydi (mavjud xatti-harakat saqlanadi)", async () => {
    const dist = makeDist([teacher("pending", false, [{ _id: "b1", acceptanceStatus: "pending" }])]);

    const { next } = await run(dist, ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(dist.approvalSteps[METHODICAL].status).toBe("pending");
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("aralash: bloksiz `pending` + blokli `pending` — bloklaydi, xabarda FAQAT blokli o'qituvchi sanaladi", async () => {
    const dist = makeDist([
      teacher("pending", false, []),
      teacher("pending", false, [{ _id: "b1", acceptanceStatus: "pending" }]),
    ]);

    const { next } = await run(dist, ROLES.OQUV_USLUBIY_BOSHQARMA);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(String(err.message)).toMatch(/1 ta o'qituvchi hali qabul qilmagan/);
    expect(dist.approvalSteps[METHODICAL].status).toBe("pending");
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("hammasi blokli va `accepted` — darvoza O'TADI", async () => {
    const dist = makeDist([
      teacher("accepted", false, [{ _id: "b1", acceptanceStatus: "accepted" }]),
      teacher("accepted", false, [{ _id: "b1", acceptanceStatus: "accepted" }]),
    ]);

    await run(dist, ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(dist.approvalSteps[METHODICAL].status).toBe("approved");
    expect(dist.save).toHaveBeenCalled();
  });
});

describe("Qulf faqat O'UB bosqichida — keyingi bosqichlar takror tekshirmaydi", () => {
  test("`financial` bosqichida o'qituvchi javobi qayta tekshirilmaydi", async () => {
    const dist = makeDist([teacher("pending")]);
    dist.approvalSteps[METHODICAL].status = "approved";

    const { next } = await run(dist, ROLES.REJA_MOLIYA);

    const guardErr = next.mock.calls.find((c) =>
      /barcha o'qituvchilar/i.test(String(c[0]?.message)),
    );
    expect(guardErr).toBeUndefined();
  });
});
