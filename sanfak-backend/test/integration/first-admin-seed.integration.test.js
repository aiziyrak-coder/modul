"use strict";

const path = require("path");
const { execFile } = require("child_process");
const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");

const REPO_ROOT = path.join(__dirname, "../..");
const SEED_SCRIPT = path.join(REPO_ROOT, "seed/first-admin.seed.js");
const UNIQUE_INDEX_NAME = "oneIdPin_unique_partial";
const UNIQUE_INDEX_SPEC = { oneIdPin: 1 };
const UNIQUE_INDEX_OPTIONS = {
  unique: true,
  partialFilterExpression: { oneIdPin: { $type: "string" } },
  name: UNIQUE_INDEX_NAME,
};

function sharedMongoUri() {
  const { host, port, name } = mongoose.connection;
  return `mongodb://${host}:${port}/${name}`;
}

function runSeed(args) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SEED_SCRIPT, ...args],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, MONGO_HOST: sharedMongoUri() },
        timeout: 20000,
      },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

function runSeedWithInput(args, input) {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [SEED_SCRIPT, ...args],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, MONGO_HOST: sharedMongoUri() },
        timeout: 20000,
      },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
        resolve({ code, stdout, stderr });
      },
    );
    child.stdin.end(input);
  });
}

const usersColl = () => mongoose.connection.db.collection("users");
const rolesColl = () => mongoose.connection.db.collection("roles");

async function insertSuperAdminRole() {
  const { insertedId } = await rolesColl().insertOne({
    title: ROLES.SUPER_ADMIN,
    permissions: [],
    scopeLevel: "global",
    isSystem: true,
    active: true,
  });
  return insertedId;
}

async function createUniqueIndex() {
  await usersColl().createIndex(UNIQUE_INDEX_SPEC, UNIQUE_INDEX_OPTIONS);
}

async function dropUniqueIndexIfExists() {
  const indexes = await usersColl()
    .indexes()
    .catch(() => []);
  if (indexes.some((idx) => idx.name === UNIQUE_INDEX_NAME)) {
    await usersColl().dropIndex(UNIQUE_INDEX_NAME);
  }
}

describe("Integration — seed/first-admin.seed.js (bola-process)", () => {
  beforeEach(async () => {
    await usersColl()
      .deleteMany({})
      .catch(() => {});
    await rolesColl()
      .deleteMany({})
      .catch(() => {});
    await dropUniqueIndexIfExists();
  });

  test("1) super_admin roli YO'Q — exit 1, users bo'sh (rol yaratilmagan)", async () => {
    const { code, stderr } = await runSeed(["--pin", "11111111111111", "--name", "Test Adminov"]);

    expect(code).toBe(1);
    expect(stderr).toMatch(/super_admin.*topilmadi|topilmadi.*super_admin/i);
    expect(await usersColl().countDocuments()).toBe(0);
  });

  test("2) toza holat (rol bor + indeks bor) — exit 0, aynan 1 hujjat, maydonlar to'g'ri", async () => {
    const roleId = await insertSuperAdminRole();
    await createUniqueIndex();

    const { code } = await runSeed(["--pin", "22222222222222", "--name", "Aziz Karimov"]);

    expect(code).toBe(0);
    expect(await usersColl().countDocuments()).toBe(1);

    const doc = await usersColl().findOne({});
    expect(doc.role.toString()).toBe(roleId.toString());
    expect(doc.active).toBe(true);
    expect(doc.firstName).toBe("Aziz");
    expect(doc.lastName).toBe("Karimov");
    expect(doc.oneIdPin).toBe("22222222222222");
  });

  test("3) hisob ALLAQACHON mavjud — exit 0, hujjat O'ZGARMAGAN (jim almashtirish yo'q)", async () => {
    await insertSuperAdminRole();
    await createUniqueIndex();
    const otherRoleId = new mongoose.Types.ObjectId();
    const { insertedId } = await usersColl().insertOne({
      firstName: "Eski",
      lastName: "Foydalanuvchi",
      oneIdPin: "33333333333333",
      role: otherRoleId,
      active: true,
    });

    const { code } = await runSeed(["--pin", "33333333333333", "--name", "Yangi Ismov"]);

    expect(code).toBe(0);
    expect(await usersColl().countDocuments()).toBe(1);

    const doc = await usersColl().findOne({});
    expect(doc._id.toString()).toBe(insertedId.toString());
    expect(doc.firstName).toBe("Eski");
    expect(doc.lastName).toBe("Foydalanuvchi");
    expect(doc.role.toString()).toBe(otherRoleId.toString());
  });

  test("4) --dry — exit 0, users bo'sh (bazaga hech narsa yozilmaydi)", async () => {
    await insertSuperAdminRole();
    await createUniqueIndex();

    const { code, stdout } = await runSeed(["--pin", "44444444444444", "--name", "Dry Runov", "--dry"]);

    expect(code).toBe(0);
    expect(stdout).toMatch(/DRY-RUN/);
    expect(await usersColl().countDocuments()).toBe(0);
  });

  test("5) yaroqsiz PIN (13 raqam) — exit 1, chiqishda qiymat yo'q", async () => {
    const badPin = "1234567890123";
    const { code, stdout, stderr } = await runSeed(["--pin", badPin, "--name", "Xato Pinov"]);

    expect(code).toBe(1);
    expect(stdout + stderr).not.toContain(badPin);
    expect(await usersColl().countDocuments()).toBe(0);
  });

  test("6) 🔴 PIN SIZISHI — real E11000 poyga (race) sharoitida, chiqishda PIN qiymati YO'Q", async () => {
    await insertSuperAdminRole();
    await createUniqueIndex();
    const pin = "66666666666666";

    const [r1, r2] = await Promise.all([
      runSeed(["--pin", pin, "--name", "Poyga Birinchi"]),
      runSeed(["--pin", pin, "--name", "Poyga Ikkinchi"]),
    ]);

    const codes = [r1.code, r2.code].sort();
    expect(["0,0", "0,1"]).toContain(codes.join(","));
    expect(await usersColl().countDocuments()).toBe(1);

    const combinedOutput = r1.stdout + r1.stderr + r2.stdout + r2.stderr;
    expect(combinedOutput).not.toContain(pin);

    if (codes.join(",") === "0,1") {
      const loserStderr = r1.code === 1 ? r1.stderr : r2.stderr;
      expect(loserStderr).toMatch(/band \(unique index\)/);
    }
  });

  test("7a) unique indeks YO'Q + haqiqiy yozuv — exit 1, users bo'sh, tuzatish buyrug'i ko'rsatiladi", async () => {
    await insertSuperAdminRole();

    const { code, stderr } = await runSeed(["--pin", "77777777777777", "--name", "Indexsiz Odam"]);

    expect(code).toBe(1);
    expect(stderr).toMatch(/oneIdPin_unique_partial/);
    expect(stderr).toMatch(/migrate:oneidpin-index/);
    expect(await usersColl().countDocuments()).toBe(0);
  });

  test("7b) unique indeks YO'Q + --dry — exit 0 (faqat ogohlantiradi, to'xtatmaydi), users bo'sh", async () => {
    await insertSuperAdminRole();

    const { code, stdout } = await runSeed(["--pin", "77777777777778", "--name", "Dry Indexsiz", "--dry"]);

    expect(code).toBe(0);
    expect(stdout).toMatch(/OGOHLANTIRISH/);
    expect(stdout).toMatch(/migrate:oneidpin-index/);
    expect(stdout).toMatch(/DRY-RUN/);
    expect(await usersColl().countDocuments()).toBe(0);
  });

  test("8) --pin-stdin — PIN buyruq qatorida emas, stdin'dan o'qiladi; chiqishda PIN yo'q", async () => {
    const roleId = await insertSuperAdminRole();
    await createUniqueIndex();

    const { code, stdout, stderr } = await runSeedWithInput(["--pin-stdin", "--name", "Aziz Karimov"], "31234567890123\n");

    expect(code).toBe(0);
    const doc = await usersColl().findOne({});
    expect(doc.oneIdPin).toBe("31234567890123");
    expect(doc.role.toString()).toBe(roleId.toString());
    expect(doc.firstName).toBe("Aziz");
    expect(`${stdout}${stderr}`).not.toContain("31234567890123");
  });

  test("9) --pin va --pin-stdin birga — exit 1, hech narsa yozilmaydi", async () => {
    await insertSuperAdminRole();
    await createUniqueIndex();

    const { code, stderr } = await runSeedWithInput(
      ["--pin", "31234567890123", "--pin-stdin", "--name", "Aziz Karimov"],
      "31234567890123\n",
    );

    expect(code).toBe(1);
    expect(stderr).toMatch(/--pin-stdin/);
    expect(await usersColl().countDocuments()).toBe(0);
  });

  test("10) --pin-stdin + yaroqsiz qiymat — exit 1, qiymat chiqishda yo'q", async () => {
    await insertSuperAdminRole();
    await createUniqueIndex();

    const { code, stdout, stderr } = await runSeedWithInput(["--pin-stdin", "--name", "Aziz Karimov"], "3123456789012\n");

    expect(code).toBe(1);
    expect(`${stdout}${stderr}`).not.toContain("3123456789012");
    expect(await usersColl().countDocuments()).toBe(0);
  });
});
