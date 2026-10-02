"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const { ROLES } = require("../src/config/constants");

const PIN_PATTERN = /^\d{14}$/;

const NO_ROLE_MESSAGE =
  '"super_admin" roli bazada topilmadi. Avval `yarn seed:super-admin` ni ' +
  "ishga tushiring — bu skript rol yaratmaydi.";

const REQUIRED_UNIQUE_INDEX = "oneIdPin_unique_partial";
const INDEX_MISSING_MESSAGE =
  `"${REQUIRED_UNIQUE_INDEX}" unique indeksi topilmadi (users kolleksiyasi). ` +
  "Bu indekssiz dublikat PIN'ga qarshi hech qanday himoya yo'q — yozish " +
  "to'xtatildi. Avval ishga tushiring: `yarn migrate:oneidpin-index` " +
  "(yoki `yarn migrate:oneidpin-index:dry` bilan avval tekshiring), so'ng " +
  "bu skriptni qayta ishga tushiring.";

function readFlag(argv, flag) {
  const at = argv.indexOf(`--${flag}`);
  if (at !== -1) return argv[at + 1];
  const inline = argv.find((a) => a.startsWith(`--${flag}=`));
  return inline === undefined ? undefined : inline.slice(flag.length + 3);
}

function parseArgs(argv) {
  return {
    pin: readFlag(argv, "pin"),
    pinStdin: argv.includes("--pin-stdin"),
    name: readFlag(argv, "name"),
    dry: argv.includes("--dry"),
  };
}

function readPinFromStdin(stream = process.stdin) {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      data += chunk;
      if (data.length > 256) {
        stream.destroy();
        reject(new Error("stdin qiymati juda uzun"));
      }
    });
    stream.on("end", () => resolve(data.split(/\r?\n/)[0].trim()));
    stream.on("error", reject);
  });
}

function validatePin(value) {
  if (value === undefined || value === null || value === "") {
    return "--pin argumenti majburiy: --pin <14 raqam>";
  }
  if (typeof value !== "string") {
    return "--pin qiymati matn (string) bo'lishi shart.";
  }
  if (!PIN_PATTERN.test(value)) {
    return "--pin aynan 14 ta raqamdan iborat bo'lishi shart (JSHSHIR). Qiymat rad etildi.";
  }
  return null;
}

function parseName(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error('--name argumenti majburiy: --name "Ism Familiya"');
  }
  if (String(value).startsWith("--")) {
    throw new Error('--name qiymati berilmagan (bayroq keldi): --name "Ism Familiya"');
  }
  const parts = String(value).trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error("--name kamida ikki so'z bo'lishi shart: --name \"Ism Familiya\"");
  }
  return {
    firstName: parts[0],
    lastName: parts[1],
    middleName: parts.length > 2 ? parts.slice(2).join(" ") : null,
  };
}

function planAction({ role, existingUser }) {
  if (!role) return { action: "abort", reason: "role-missing" };
  if (existingUser) return { action: "skip", reason: "already-exists" };
  return { action: "create", reason: "clean" };
}

function redact(text) {
  const raw = text === undefined || text === null ? "" : String(text);
  return raw.replace(/\d{14}/g, "«yashirildi»");
}

async function hasRequiredIndex() {
  try {
    const indexes = await mongoose.connection.db.collection("users").indexes();
    return indexes.some((idx) => idx.name === REQUIRED_UNIQUE_INDEX);
  } catch (err) {
    return false;
  }
}

function fail(message) {
  console.error("✗", message);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.pinStdin && args.pin !== undefined) {
    return fail("--pin va --pin-stdin birga ishlatilmaydi.");
  }
  const pin = args.pinStdin ? await readPinFromStdin() : args.pin;
  const { name, dry } = args;

  const pinError = validatePin(pin);
  if (pinError) return fail(pinError);

  let person;
  try {
    person = parseName(name);
  } catch (err) {
    return fail(err.message);
  }

  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  console.log("[FirstAdmin] MongoDB ga ulandi");

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const UserModel = require("../src/modules/4.01-auth/user/user.model");

  const role = await RoleModel.findOne({ title: ROLES.SUPER_ADMIN }).select("_id title").lean();
  const existingUser = await UserModel.findOne({ oneIdPin: pin }).select("firstName lastName role").lean();

  const plan = planAction({ role, existingUser });

  if (plan.action === "abort") {
    console.error("✗", NO_ROLE_MESSAGE);
    await mongoose.disconnect();
    return process.exit(1);
  }

  if (plan.action === "skip") {
    console.log("");
    console.log("~ Bu identifikator bilan hisob ALLAQACHON mavjud — TEGILMADI.");
    console.log(`  _id   : ${existingUser._id}`);
    console.log(`  Ism   : ${existingUser.firstName} ${existingUser.lastName}`);
    console.log("  Hisob qayta yozilmadi (rol/holat o'zgartirilmadi).");
    console.log("");
    await mongoose.disconnect();
    return process.exit(0);
  }

  const fullName = `${person.firstName} ${person.lastName}${person.middleName ? " " + person.middleName : ""}`;

  const indexPresent = await hasRequiredIndex();
  if (!indexPresent) {
    if (dry) {
      console.log("");
      console.log(`⚠ OGOHLANTIRISH: "${REQUIRED_UNIQUE_INDEX}" unique indeksi topilmadi.`);
      console.log("  Haqiqiy yozishdan oldin ishga tushiring: yarn migrate:oneidpin-index");
      console.log("  (--dry rejimi shunchaki rejani ko'rsatadi — davom etilmoqda)");
    } else {
      console.error("✗", INDEX_MISSING_MESSAGE);
      await mongoose.disconnect();
      return process.exit(1);
    }
  }

  if (dry) {
    console.log("");
    console.log("── DRY-RUN — bazaga HECH NARSA yozilmadi ──");
    console.log("  Amal  : yangi foydalanuvchi YARATILGAN bo'lardi");
    console.log(`  Ism   : ${fullName}`);
    console.log(`  Rol   : ${role.title} (${role._id})`);
    console.log("  Holat : active = true");
    console.log("  Yozish uchun `--dry` siz qayta ishga tushiring.");
    console.log("");
    await mongoose.disconnect();
    return process.exit(0);
  }

  const created = await UserModel.create({
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName,
    oneIdPin: pin,
    role: role._id,
    active: true,
  });

  console.log("");
  console.log("+ Birinchi administrator YARATILDI.");
  console.log(`  _id   : ${created._id}`);
  console.log(`  Ism   : ${fullName}`);
  console.log(`  Rol   : ${role.title}`);
  console.log("  Holat : active = true");
  console.log("  Kirish: POST /api/auth — identifikator siz kiritgan qiymat (bu yerda chop etilmaydi).");
  console.log("");

  await mongoose.disconnect();
  return process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    if (err && err.code === 11000) {
      console.error("✗", "Bu identifikator band (unique index) — hech narsa o'zgartirilmadi.");
    } else {
      console.error("✗", "[FirstAdmin] XATO:", redact(err && err.message));
    }
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = {
  PIN_PATTERN,
  NO_ROLE_MESSAGE,
  REQUIRED_UNIQUE_INDEX,
  INDEX_MISSING_MESSAGE,
  readFlag,
  parseArgs,
  readPinFromStdin,
  validatePin,
  parseName,
  planAction,
  redact,
  hasRequiredIndex,
};
