jest.mock("#references/position/position.model", () => ({
  schema: { path: () => ({ defaultValue: 720 }) },
  findOne: jest.fn(),
}));

const {
  buildStaffPositions,
  sumWorkloadHours,
} = require("./staffPositionsCalculator");

describe("staffPositionsCalculator — buildStaffPositions", () => {
  test("totalHours=1000, base=720 → totalPositions=1, hourly=280", async () => {
    const workload = {
      directions: [
        { blocks: [{ totalHour: 600 }, { totalHour: 400 }] },
      ],
    };
    const result = await buildStaffPositions(workload, 720);
    expect(result.totalPositions).toBe(1);
    expect(result.hourly).toBe(280);
    expect(result.items).toEqual([]);
  });

  test("totalHours=0 → {totalPositions:0, hourly:0}", async () => {
    const workload = { directions: [] };
    const result = await buildStaffPositions(workload, 720);
    expect(result.totalPositions).toBe(0);
    expect(result.hourly).toBe(0);
  });

  test("bir necha stavkaga yetadigan jami soat to'g'ri bo'linadi", async () => {
    const workload = {
      directions: [{ blocks: [{ totalHour: 1500 }] }],
    };
    const result = await buildStaffPositions(workload, 720);
    expect(result.totalPositions).toBe(2);
    expect(result.hourly).toBe(1500 - 2 * 720);
  });

  test("norma berilmasa DB'dagi (mock) faol Position.annualHours ishlatiladi", async () => {
    const Position = require("#references/position/position.model");
    Position.findOne.mockReturnValue({
      sort: () => ({
        select: () => ({ lean: () => Promise.resolve({ annualHours: 500 }) }),
      }),
    });
    const workload = { directions: [{ blocks: [{ totalHour: 1000 }] }] };
    const result = await buildStaffPositions(workload);
    expect(result.totalPositions).toBe(2);
    expect(result.hourly).toBe(0);
  });

  test("sumWorkloadHours — bir nechta yo'nalish/blok bo'yicha yig'indi", () => {
    const workload = {
      directions: [
        { blocks: [{ totalHour: 10 }, { totalHour: 20 }] },
        { blocks: [{ totalHour: 5 }] },
      ],
    };
    expect(sumWorkloadHours(workload)).toBe(35);
  });

  test("sumWorkloadHours — bo'sh/undefined workload uchun 0", () => {
    expect(sumWorkloadHours(undefined)).toBe(0);
    expect(sumWorkloadHours({})).toBe(0);
  });

  test("workload.staffPositions.items MAVJUD bo'lsa — SAQLANADI (o'chirilmaydi)", async () => {
    const existingItems = [
      { category: "teachingStaff", slug: "professor", positions: 2, load: 300, totalHours: 600 },
    ];
    const workload = {
      directions: [{ blocks: [{ totalHour: 600 }] }],
      staffPositions: { items: existingItems, totalPositions: 0, hourly: 0 },
    };
    const result = await buildStaffPositions(workload, 720);
    expect(result.items).toBe(existingItems);
    expect(result.totalPositions).toBe(0);
    expect(result.hourly).toBe(600);
  });

  test("workload.staffPositions YO'Q (yangi hujjat) — items hamon []", async () => {
    const workload = { directions: [{ blocks: [{ totalHour: 100 }] }] };
    const result = await buildStaffPositions(workload, 720);
    expect(result.items).toEqual([]);
  });
});
