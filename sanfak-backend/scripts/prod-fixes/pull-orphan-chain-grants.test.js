const mongoose = require("mongoose");
const {
  CHAIN_SECTIONS,
  BYPASS_ROLES,
  findOrphanChainGrants,
  scanRoles,
  applyPulls,
  parseArgs,
  needsConfirmation,
} = require("./pull-orphan-chain-grants");

const oid = () => new mongoose.Types.ObjectId();

const TEST_MATRIX = {
  dekan: {
    sections: {
      workloadDistribution: ["read", "readAll", "approve", "reject", "export"],
      workingSchedule: ["read", "readAll", "approve", "reject", "export"],
    },
  },
  kafedra_mudiri: {
    sections: {
      workload: ["read", "readAll", "approve", "reject"],
      workingSchedule: ["read", "readAll"],
      workloadDistribution: ["create", "read", "readAll", "update", "delete", "approve", "reject"],
    },
  },
};

describe("findOrphanChainGrants — sof funksiya", () => {
  test("(a) dekan.workload — matritsada yo'q — YETIM", () => {
    const roleDoc = {
      _id: oid(),
      title: "dekan",
      permissions: [
        { section: "workload", actionKeys: ["read", "readAll", "approve", "reject", "export"] },
        { section: "workloadDistribution", actionKeys: ["read", "readAll", "approve", "reject", "export"] },
      ],
    };
    const r = findOrphanChainGrants(roleDoc, TEST_MATRIX);
    expect(r.skipped).toBe(false);
    expect(r.orphans).toHaveLength(1);
    expect(r.orphans[0].section).toBe("workload");
    expect(r.orphans[0].actionKeys).toEqual(["read", "readAll", "approve", "reject", "export"]);
  });

  test("(b) kuzatuvchi bo'lim (matritsada READ/READ_ALL bilan bor) — YETIM EMAS", () => {
    const roleDoc = {
      _id: oid(),
      title: "kafedra_mudiri",
      permissions: [
        { section: "workingSchedule", actionKeys: ["read", "readAll"] },
        { section: "workload", actionKeys: ["read", "readAll", "approve", "reject"] },
      ],
    };
    const r = findOrphanChainGrants(roleDoc, TEST_MATRIX);
    expect(r.skipped).toBe(false);
    expect(r.orphans).toHaveLength(0);
  });

  test("(c) 4.02 zanjiridan TASHQARI section — matritsada yo'q bo'lsa ham ro'yxatga TUSHMAYDI", () => {
    const roleDoc = {
      _id: oid(),
      title: "dekan",
      permissions: [
        { section: "internationalAdmission", actionKeys: ["read", "readAll"] },
        { section: "auth", actionKeys: ["read"] },
      ],
    };
    const r = findOrphanChainGrants(roleDoc, TEST_MATRIX);
    expect(r.orphans).toHaveLength(0);
  });

  test("(d) matritsada UMUMAN yo'q rol — skipped=true, yetim emas", () => {
    const roleDoc = {
      _id: oid(),
      title: "talaba",
      permissions: [{ section: "workload", actionKeys: ["read"] }],
    };
    const r = findOrphanChainGrants(roleDoc, TEST_MATRIX);
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toMatch(/matritsada yo'q/);
    expect(r.orphans).toHaveLength(0);
  });

  test("bypass rollar (super_admin/moderator) — skipped=true, matritsada bo'lsa ham tekshirilmaydi", () => {
    for (const title of BYPASS_ROLES) {
      const roleDoc = { _id: oid(), title, permissions: [{ section: "workload", actionKeys: ["read"] }] };
      const r = findOrphanChainGrants(roleDoc, { [title]: { sections: {} } });
      expect(r.skipped).toBe(true);
      expect(r.skipReason).toMatch(/bypass/);
      expect(r.orphans).toHaveLength(0);
    }
  });

  test("CHAIN_SECTIONS — 5 ta 4.02 bo'limini o'z ichiga oladi", () => {
    expect(CHAIN_SECTIONS.sort()).toEqual(
      ["workload", "workingSchedule", "workloadDistribution", "scienceProgram", "syllabus"].sort(),
    );
  });
});

const makeDb = (roleRows) => {
  const rows = roleRows;
  const calls = { updateOne: 0 };
  return {
    calls,
    collection(name) {
      if (name !== "roles") throw new Error(`kutilmagan kolleksiya: ${name}`);
      return {
        find: (filter) => {
          let filtered = rows;
          if (filter && filter._id && filter._id.$in) {
            filtered = rows.filter((r) => filter._id.$in.some((i) => String(i) === String(r._id)));
          }
          return { toArray: async () => filtered.map((r) => ({ ...r, permissions: r.permissions.map((p) => ({ ...p })) })) };
        },
        updateOne: async (filter, update) => {
          calls.updateOne += 1;
          const doc = rows.find((r) => String(r._id) === String(filter._id));
          if (!doc) return { modifiedCount: 0 };
          const pullSections = new Set(update.$pull.permissions.section.$in);
          const before = doc.permissions.length;
          doc.permissions = doc.permissions.filter((p) => !pullSections.has(p.section));
          return { modifiedCount: doc.permissions.length < before ? 1 : 0 };
        },
      };
    },
  };
};

describe("scanRoles — DB skanerlash (soxta db)", () => {
  test("dekan yetim topiladi, kafedra_mudiri topilmaydi, talaba skipped", async () => {
    const db = makeDb([
      {
        _id: oid(),
        title: "dekan",
        permissions: [
          { section: "workload", actionKeys: ["read", "readAll", "approve", "reject", "export"] },
          { section: "workloadDistribution", actionKeys: ["read", "readAll"] },
        ],
      },
      {
        _id: oid(),
        title: "kafedra_mudiri",
        permissions: [{ section: "workingSchedule", actionKeys: ["read", "readAll"] }],
      },
      { _id: oid(), title: "talaba", permissions: [] },
    ]);

    const { totalRoles, withOrphans, totalOrphanSections } = await scanRoles({ db, matrix: TEST_MATRIX });
    expect(totalRoles).toBe(3);
    expect(withOrphans).toHaveLength(1);
    expect(withOrphans[0].title).toBe("dekan");
    expect(totalOrphanSections).toBe(1);
  });
});

describe("applyPulls — DRY vs APPLY (soxta db)", () => {
  test("(e) write=false (DRY) — DB'ga yozmaydi, updateOne chaqirilmaydi", async () => {
    const roleId = oid();
    const db = makeDb([
      { _id: roleId, title: "dekan", permissions: [{ section: "workload", actionKeys: ["read"] }] },
    ]);
    const withOrphans = [{ title: "dekan", roleId, orphans: [{ section: "workload", actionKeys: ["read"] }] }];

    const result = await applyPulls({ db, withOrphans, write: false });

    expect(result.written).toBe(false);
    expect(result.updated).toBe(0);
    expect(db.calls.updateOne).toBe(0);
  });

  test("write=true — $pull qo'llanadi, faqat yetim section olib tashlanadi", async () => {
    const roleId = oid();
    const db = makeDb([
      {
        _id: roleId,
        title: "dekan",
        permissions: [
          { section: "workload", actionKeys: ["read", "readAll"] },
          { section: "workloadDistribution", actionKeys: ["read", "readAll"] },
        ],
      },
    ]);
    const withOrphans = [{ title: "dekan", roleId, orphans: [{ section: "workload", actionKeys: ["read", "readAll"] }] }];

    const result = await applyPulls({ db, withOrphans, write: true, backup: false });

    expect(result.written).toBe(true);
    expect(result.updated).toBe(1);
    const [updatedRole] = await db.collection("roles").find({}).toArray();
    expect(updatedRole.permissions).toHaveLength(1);
    expect(updatedRole.permissions[0].section).toBe("workloadDistribution");
  });

  test("write=true, withOrphans bo'sh — hech narsa qilinmaydi", async () => {
    const db = makeDb([]);
    const result = await applyPulls({ db, withOrphans: [], write: true });
    expect(result.written).toBe(false);
    expect(db.calls.updateOne).toBe(0);
  });
});

describe("parseArgs — P2-7 (`--mongo` qiymatida ko'p `=` bo'lsa ham to'liq olinadi)", () => {
  test("oddiy Mongo URI (authSource'siz) — to'g'ri parslanadi", () => {
    const { mongoOverride } = parseArgs([
      "--mongo=mongodb://127.0.0.1:27017/institute-chain",
    ]);
    expect(mongoOverride).toBe("mongodb://127.0.0.1:27017/institute-chain");
  });

  test("`?authSource=admin` bilan — eski split(\"=\")[1] kesib qo'yardigan qism ham saqlanadi", () => {
    const { mongoOverride } = parseArgs([
      "--mongo=mongodb://user:pass@127.0.0.1:27017/prod?authSource=admin",
    ]);
    expect(mongoOverride).toBe(
      "mongodb://user:pass@127.0.0.1:27017/prod?authSource=admin",
    );
  });

  test("--mongo berilmasa — null, .env standart bazasi ishlatiladi", () => {
    const { mongoOverride } = parseArgs(["--apply"]);
    expect(mongoOverride).toBeNull();
  });

  test("--apply va --yes bayroqlari to'g'ri o'qiladi", () => {
    expect(parseArgs(["--apply"]).apply).toBe(true);
    expect(parseArgs([]).apply).toBe(false);
    expect(parseArgs(["--yes"]).confirmed).toBe(true);
    expect(parseArgs([]).confirmed).toBe(false);
  });

  test("--backup-dir ham `=` bilan to'liq olinadi", () => {
    const { backupDir } = parseArgs(["--backup-dir=/tmp/my=backups"]);
    expect(backupDir).toBe("/tmp/my=backups");
  });
});

describe("needsConfirmation — P2-8 (`--apply` + `--mongo` uchun `--yes` shart)", () => {
  test("--apply + --mongo, --yes YO'Q — tasdiq talab qilinadi", () => {
    expect(
      needsConfirmation({ apply: true, mongoOverride: "mongodb://x/prod", confirmed: false }),
    ).toBe(true);
  });

  test("--apply + --mongo + --yes — tasdiq bor, o'tkaziladi", () => {
    expect(
      needsConfirmation({ apply: true, mongoOverride: "mongodb://x/prod", confirmed: true }),
    ).toBe(false);
  });

  test("--apply, --mongo YO'Q (.env standart bazasi) — tasdiq shart emas (eski xatti-harakat)", () => {
    expect(
      needsConfirmation({ apply: true, mongoOverride: null, confirmed: false }),
    ).toBe(false);
  });

  test("--apply YO'Q (dry-run) — --mongo bilan ham tasdiq shart emas", () => {
    expect(
      needsConfirmation({ apply: false, mongoOverride: "mongodb://x/prod", confirmed: false }),
    ).toBe(false);
  });
});
