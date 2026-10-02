"use strict";

jest.mock("../src/modules/4.01-auth/role/role.model", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

const mongoose = require("mongoose");
const Role = require("../src/modules/4.01-auth/role/role.model");
const { run, GRANTS } = require("./residency-roles.seed");

const ARGV = process.argv;
const HOST = process.env.MONGO_HOST;
let logs;

const roleDoc = (title, permissions) => ({ title, permissions, save: jest.fn().mockResolvedValue(undefined) });
const full = (title) =>
  Object.entries(GRANTS[title]).map(([section, actionKeys]) => ({ section, actionKeys: [...actionKeys] }));

function world() {
  const office = full("magistratura_bolim").map((p) =>
    p.section === "residentAttendance" ? { ...p, actionKeys: p.actionKeys.filter((a) => a !== "approve") } : p);
  const docs = { magistratura_bolim: roleDoc("magistratura_bolim", office) };
  for (const t of ["rezident", "klinik_ustoz", "ilmiy_rahbar", "rektor"]) docs[t] = roleDoc(t, full(t));
  Role.findOne.mockImplementation(async ({ title }) => docs[title] ?? null);
  Role.create.mockImplementation(async (d) => (docs[d.title] = roleDoc(d.title, [...d.permissions])));
  return docs;
}

beforeEach(() => {
  logs = [];
  process.env.MONGO_HOST = "mongodb://mock-only";
  jest.spyOn(mongoose, "connect").mockResolvedValue(undefined);
  jest.spyOn(mongoose, "disconnect").mockResolvedValue(undefined);
  jest.spyOn(console, "log").mockImplementation((m) => logs.push(String(m)));
  jest.spyOn(console, "warn").mockImplementation((m) => logs.push(String(m)));
});

afterEach(() => {
  jest.restoreAllMocks();
  Role.findOne.mockReset();
  Role.create.mockReset();
  process.argv = ARGV;
  if (HOST === undefined) delete process.env.MONGO_HOST;
  else process.env.MONGO_HOST = HOST;
});

describe("residency-roles.seed --dry (EXC-Q8=A)", () => {
  test("hech narsa yozilmaydi; diff, yaratilajak rol va yakuniy qator chiqadi", async () => {
    const docs = world();
    process.argv = [...ARGV, "--dry"];
    await run();

    expect(Role.create).not.toHaveBeenCalled();
    for (const doc of Object.values(docs)) expect(doc.save).not.toHaveBeenCalled();
    expect(logs).toContain('  [dry +role] "magistrant" yaratilardi (scopeLevel=self)');
    expect(logs).toContain("  [magistratura_bolim] residentAttendance+[approve]");
    expect(logs.some((l) => l.startsWith("  [magistrant] +academicYear"))).toBe(true);
    expect(logs).toContain('  [SKIP] rol topilmadi: "kafedra_mudiri"');
    expect(logs).toContain("  [klinik_ustoz] o'zgarishsiz (allaqachon to'liq)");
    expect(logs.at(-1)).toBe("DRY-RUN — DB o'zgarmadi");
  });

  test("bayroqsiz — avvalgidek yozadi (DEPLOY §3 buyruqlari o'zgarmaydi)", async () => {
    const docs = world();
    await run();

    expect(Role.create).toHaveBeenCalledWith(expect.objectContaining({ title: "magistrant", permissions: [] }));
    expect(docs.magistratura_bolim.save).toHaveBeenCalledTimes(1);
    expect(docs.magistrant.save).toHaveBeenCalledTimes(1);
    expect(docs.klinik_ustoz.save).not.toHaveBeenCalled();
    const att = docs.magistratura_bolim.permissions.find((p) => p.section === "residentAttendance");
    expect(att.actionKeys).toContain("approve");
    expect(logs.some((l) => l.includes("DRY-RUN"))).toBe(false);
  });
});
