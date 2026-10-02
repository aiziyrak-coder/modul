"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const RoleModel = require("../src/modules/4.01-auth/role/role.model");
const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const DRY = process.argv.includes("--dry");

const CRUD = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
  ACTIONS.SEARCH,
  ACTIONS.FILTER,
];
const READ_ONLY = [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.SEARCH, ACTIONS.FILTER];

const REFERENCE_SECTIONS = [
  MODULES.FACULTY,
  MODULES.COURSE,
  MODULES.ACADEMIC_YEAR,
  MODULES.POSITION,
  MODULES.SPECIALIZATION,
  MODULES.STUDY_PERIOD,
  MODULES.ACADEMIC_LEVEL,
  MODULES.EDUCATION_FORM,
  MODULES.LANGUAGE_OF_INSTRUCTION,
  MODULES.AUDITORIUM_HOUR,
  MODULES.EDUCATION_ACTIVITY_TYPE,
  MODULES.DEPARTMENT,
  MODULES.DIVISION,
  MODULES.SCIENCE,
  MODULES.ACADEMIC_TITLE,
  MODULES.DIRECTION,
];

const SECTIONS = {
  [MODULES.AUTH]: READ_ONLY,
  [MODULES.USER]: [...CRUD, ACTIONS.CHANGE_STATUS, ACTIONS.EXPORT],
  [MODULES.ROLE]: [...CRUD, ACTIONS.GRANT_ANY],
  [MODULES.AUDIT_LOG]: [...READ_ONLY, ACTIONS.EXPORT],
};
REFERENCE_SECTIONS.forEach((s) => {
  if (s) SECTIONS[s] = CRUD;
});

const toPermissionsArray = (sections) =>
  Object.entries(sections)
    .filter(([section]) => Boolean(section))
    .map(([section, actionKeys]) => ({ section, actionKeys }));

const REVOKED_SECTIONS = [
  MODULES.GROUP,
  MODULES.PERMISSION,
  MODULES.PERMISSION_GROUP,
].filter(Boolean);

const mergePermissions = (existing, next) => {
  const managed = new Set(next.map((p) => p.section));
  const revoked = new Set(REVOKED_SECTIONS);
  const preserved = (existing || []).filter(
    (p) => !managed.has(p.section) && !revoked.has(p.section),
  );
  return [...preserved, ...next];
};

const ROLE_DESC =
  "Bo'lim admini / grant-administrator — foydalanuvchilar, ma'lumotnomalar va " +
  "BARCHA rollarning vakolatlari (role:grantAny). Modul ma'lumotlariga kirmaydi.";

const toKeySet = (perms = []) => {
  const s = new Set();
  (perms || []).forEach((p) => {
    if (!p || !p.section) return;
    (p.actionKeys || []).forEach((a) => s.add(`${p.section}:${a}`));
  });
  return s;
};

const printDiff = (before, after) => {
  const oldKeys = toKeySet(before);
  const newKeys = toKeySet(after);
  const added = [...newKeys].filter((k) => !oldKeys.has(k)).sort();
  const removed = [...oldKeys].filter((k) => !newKeys.has(k)).sort();

  if (!added.length && !removed.length) {
    console.log("      = grantlar o'zgarmaydi");
    return;
  }
  if (added.length) {
    console.log(`      + qo'shiladi (${added.length}):`);
    added.forEach((k) => console.log(`          + ${k}`));
  }
  if (removed.length) {
    console.log(`      - olib tashlanadi (${removed.length}):`);
    removed.forEach((k) => console.log(`          - ${k}`));
  }
};

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `\n[Moderator Seed] MongoDB ga ulandi${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi)" : ""}\n`,
  );

  const permissions = toPermissionsArray(SECTIONS);
  const unknown = permissions.filter((p) => !p.section);
  if (unknown.length) {
    console.error("  ✖ TO'XTATILDI: constants.MODULES da topilmagan section bor.");
    process.exit(1);
  }

  let role = await RoleModel.findOne({ title: ROLES.MODERATOR });

  if (!role) {
    console.log(`  + ${DRY ? "YARATILARDI" : "YARATILDI  "} rol: "${ROLES.MODERATOR}"`);
    console.log(`      ${permissions.length} ta section:`);
    permissions.forEach((p) =>
      console.log(`        ${p.section}: [${p.actionKeys.join(", ")}]`),
    );
    if (!DRY) {
      role = await RoleModel.create({
        title: ROLES.MODERATOR,
        desc: ROLE_DESC,
        scopeLevel: "global",
        permissions,
        active: true,
      });
    }
  } else {
    const merged = mergePermissions(role.permissions, permissions);
    const preservedCount = merged.length - permissions.length;
    console.log(
      `  ↻ ${DRY ? "YANGILANARDI" : "YANGILANDI "} rol: "${ROLES.MODERATOR}" — ` +
        `${permissions.length} ta section, ${preservedCount} ta begona section saqlanadi`,
    );
    printDiff(role.permissions, merged);
    if (role.scopeLevel !== "global") {
      console.log(`      ↻ scopeLevel: "${role.scopeLevel}" → "global"`);
    }
    if (!DRY) {
      role.permissions = merged;
      role.scopeLevel = "global";
      role.desc = ROLE_DESC;
      role.active = true;
      await role.save();
    }
  }

  console.log(
    `\n[Moderator Seed] ${DRY ? "DRY-RUN tugadi — hech narsa yozilmadi." : "Tayyor."}\n` +
      `  super_admin ga TEGILMADI.\n` +
      `  Test foydalanuvchisi kerak bo'lsa (faqat dev/qa): node seed/moderator-users.seed.js\n`,
  );

  await mongoose.disconnect();
}

module.exports = {
  SECTIONS,
  REFERENCE_SECTIONS,
  REVOKED_SECTIONS,
  ROLE_DESC,
  toPermissionsArray,
  mergePermissions,
};

if (require.main === module) {
  main().catch(async (err) => {
    console.error("[Moderator Seed] XATO:", err.message);
    await mongoose.disconnect();
    process.exit(1);
  });
}
