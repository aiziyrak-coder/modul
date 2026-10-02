jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const Controller = require("./workloadDistribution.controller");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ENTRY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const BLOCK_ID = "cccccccccccccccccccccccc";
const WL_BLOCK_ID = "dddddddddddddddddddddddd";
const OTHER_BLOCK_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (totalHour) => ({
  params: { id: DIST_ID, teacherEntryId: ENTRY_ID, blockId: BLOCK_ID },
  body: { totalHour },
  query: {},
  scope: {},
  user: { _id: "507f1f77bcf86cd799439011", role: { title: "kafedra_mudiri" } },
});

const makeDist = ({
  status = "draft",
  residueHour = 100,
  blockHour = 90,
  extraBlocks = [],
} = {}) => ({
  _id: DIST_ID,
  status,
  residueHour,
  totalHour: 1000,
  workload: "ffffffffffffffffffffff11",
  teachers: [
    {
      _id: { toString: () => ENTRY_ID },
      totalHour: blockHour,
      blocks: [
        {
          _id: { toString: () => BLOCK_ID },
          workloadBlockId: WL_BLOCK_ID,
          totalHour: blockHour,
        },
        ...extraBlocks,
      ],
    },
  ],
  save: jest.fn().mockResolvedValue(undefined),
});

const mockWorkload = (sourceHour) => {
  Workload.findById = jest.fn().mockResolvedValue({
    directions: [
      {
        blocks: [
          { _id: { toString: () => WL_BLOCK_ID }, totalHour: sourceHour },
        ],
      },
    ],
  });
};

const run = async (dist, totalHour) => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
  const next = jest.fn();
  const res = createRes();
  await Controller.updateBlockHours(createReq(totalHour), res, next);
  return { next, res };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Blok soatini tuzatish — asosiy oqim", () => {
  test("soat kamaytirilsa: blok, o'qituvchi jami va qoldiq QAYTA HISOBLANADI", async () => {
    mockWorkload(90);
    const dist = makeDist({ residueHour: 100, blockHour: 90 });

    const { res } = await run(dist, 40);

    expect(dist.teachers[0].blocks[0].totalHour).toBe(40);
    expect(dist.teachers[0].totalHour).toBe(40);
    expect(dist.residueHour).toBe(150);
    expect(dist.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("o'qituvchi jami — BARCHA bloklar yig'indisidan qayta hisoblanadi", async () => {
    mockWorkload(90);
    const dist = makeDist({
      blockHour: 90,
      extraBlocks: [
        {
          _id: { toString: () => OTHER_BLOCK_ID },
          workloadBlockId: "ffffffffffffffffffffff22",
          totalHour: 30,
        },
      ],
    });
    dist.teachers[0].totalHour = 120;

    await run(dist, 50);

    expect(dist.teachers[0].totalHour).toBe(80);
  });
});

describe("Invariant 1 — yuklama blokidagi soat yuqori chegara", () => {
  test("yuklamadagi soatdan oshsa 400 va hujjat SAQLANMAYDI", async () => {
    mockWorkload(90);
    const dist = makeDist({ blockHour: 90, residueHour: 500 });

    const { next } = await run(dist, 120);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(String(err.message)).toMatch(/yuklamadagi soatdan oshib/i);
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("bir blok IKKI o'qituvchiga bo'linganda boshqa ulush hisobga olinadi", async () => {
    mockWorkload(90);
    const dist = makeDist({ blockHour: 30, residueHour: 500 });
    dist.teachers.push({
      _id: { toString: () => "ffffffffffffffffffffff33" },
      totalHour: 60,
      blocks: [
        {
          _id: { toString: () => "ffffffffffffffffffffff44" },
          workloadBlockId: WL_BLOCK_ID,
          totalHour: 60,
        },
      ],
    });

    const { next } = await run(dist, 40);

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("chegaraga TENG qiymat o'tadi (90 = 90)", async () => {
    mockWorkload(90);
    const dist = makeDist({ blockHour: 40, residueHour: 500 });

    const { res } = await run(dist, 90);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dist.teachers[0].blocks[0].totalHour).toBe(90);
  });
});

describe("Invariant 2 — qoldiq manfiy bo'lmaydi", () => {
  test("qoldiq yetmasa 400 (soat oshirilganda)", async () => {
    mockWorkload(500);
    const dist = makeDist({ blockHour: 40, residueHour: 10 });

    const { next } = await run(dist, 100);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(String(err.message)).toMatch(/qoldiq soat/i);
    expect(dist.save).not.toHaveBeenCalled();
  });
});

describe("Guard'lar", () => {
  test("tasdiqlash/imzolash bosqichida tahrirlash BLOKLANADI", async () => {
    mockWorkload(90);
    const dist = makeDist({ status: "in_review" });

    const { res } = await run(dist, 40);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("begona kafedra taqsimoti — 404 (scope bilan topilmaydi)", async () => {
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
    const res = createRes();
    await Controller.updateBlockHours(createReq(40), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("blok topilmasa 404", async () => {
    mockWorkload(90);
    const dist = makeDist();
    dist.teachers[0].blocks = [];

    const { res } = await run(dist, 40);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("eski yozuv (`workloadBlockId` yo'q) — chegara tekshiruvi o'tkazib yuboriladi, qoldiq baribir qo'riqlanadi", async () => {
    const dist = makeDist({ blockHour: 40, residueHour: 500 });
    dist.teachers[0].blocks[0].workloadBlockId = null;

    const { res } = await run(dist, 100);

    expect(Workload.findById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(dist.residueHour).toBe(440);
  });
});
