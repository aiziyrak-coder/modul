const Task = require("#modules/4.07-task/task/task.model");
const controller = require("./taskStatistics.controller");

const REKTOR = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: { scopeLevel: "global" } };

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

const capturePipeline = async () => {
  const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([{}]);
  await controller.overview({ user: REKTOR, query: {} }, makeRes(), jest.fn());
  return spy.mock.calls[0][0];
};

const facet = (pipeline) => pipeline.find((s) => s.$facet).$facet;

const runTail = (branch, rows) => {
  const tail = branch.slice(branch.findIndex((s) => s.$group) + 1);
  let out = [...rows];
  for (const stage of tail) {
    if (stage.$sort) {
      const [[key, dir]] = Object.entries(stage.$sort);
      out = [...out].sort((a, b) => (a[key] - b[key]) * dir);
    } else if (stage.$limit) {
      out = out.slice(0, stage.$limit);
    } else {
      throw new Error(`fake-db: qo'llab-quvvatlanmaydigan bosqich: ${Object.keys(stage)[0]}`);
    }
  }
  return out;
};

const engKechikkanUchtasi = (rows) =>
  [...rows].sort((a, b) => b.overdue - a.overdue).filter((d) => d.overdue > 0).slice(0, 3);

const ROWS = [
  ...Array.from({ length: 12 }, (_, i) => ({
    _id: `kafedra-${i + 1}`,
    total: 20,
    completed: 19,
    overdue: 1,
    onTime: 19,
  })),
  { _id: "kichik-bolim", total: 8, completed: 0, overdue: 8, onTime: 0 },
];

afterEach(() => jest.restoreAllMocks());

describe("taskStatistics.overview — byDepartment kesilmaydi", () => {
  test("pipeline'da `$limit` YO'Q", async () => {
    const branch = facet(await capturePipeline()).byDepartment;
    expect(branch.some((s) => s.$limit)).toBe(false);
  });

  test("barcha bo'linmalar javobga tushadi (13 tadan 13 tasi)", async () => {
    const branch = facet(await capturePipeline()).byDepartment;
    expect(runTail(branch, ROWS)).toHaveLength(ROWS.length);
  });

  test("eng ko'p kechiktirgan kichik bo'lim iste'molchining top-3 ida bo'ladi", async () => {
    const branch = facet(await capturePipeline()).byDepartment;

    const top3 = engKechikkanUchtasi(runTail(branch, ROWS));

    expect(top3[0]._id).toBe("kichik-bolim");
    expect(top3[0].overdue).toBe(8);
  });

  test("`$sort: { total: -1 }` saqlanadi (sim ustida barqaror tartib)", async () => {
    const branch = facet(await capturePipeline()).byDepartment;
    expect(branch).toContainEqual({ $sort: { total: -1 } });
  });

  test("`byCategory` ning o'z chegarasi TEGILMAGAN (ko'r-ko'rona olib tashlash emas)", async () => {
    const branch = facet(await capturePipeline()).byCategory;
    expect(branch).toContainEqual({ $limit: 10 });
  });
});
