"use strict";

const PHASES = {
  catalog: "Ruxsatlar katalogi",
  roles: "Rol huquqlari",
  index: "Indeks",
};

const STEPS = [
  { id: "permission-groups", phase: "catalog", file: "seed/permissionGroups.seed.js", script: "seed:permission-groups", args: [], dryArgs: null, title: "Ruxsat guruhlari" },
  { id: "permissions", phase: "catalog", file: "seed/permissions.seed.js", script: "seed:permissions", args: [], dryArgs: null, title: "Umumiy ruxsatlar katalogi" },
  { id: "permissions-qual", phase: "catalog", file: "seed/permissions-qual.seed.js", script: "seed:permissions:qual", args: [], dryArgs: null, title: "4.4 Malaka oshirish katalogi" },
  { id: "permissions-studyload", phase: "catalog", file: "seed/permissions-studyload.seed.js", script: "seed:permissions:studyload", args: [], dryArgs: ["--dry"], title: "4.2 O'quv yuklamalari katalogi" },
  { id: "permissions-science-council", phase: "catalog", file: "seed/permissions-science-council.seed.js", script: "seed:permissions:science-council", args: [], dryArgs: ["--dry"], title: "4.6 Ilmiy kengash katalogi" },
  { id: "permissions-task", phase: "catalog", file: "seed/permissions-task.seed.js", script: "seed:permissions:task", args: [], dryArgs: ["--dry"], title: "4.7 Topshiriqlar katalogi" },
  { id: "permissions-council", phase: "catalog", file: "seed/permissions-council.seed.js", script: "seed:permissions:council", args: [], dryArgs: ["--dry"], title: "4.9 Institut kengashi katalogi" },
  { id: "permissions-gifted", phase: "catalog", file: "seed/permissions-gifted.seed.js", script: "seed:permissions:gifted", args: [], dryArgs: ["--dry"], title: "4.11 Iqtidorli yoshlar katalogi" },
  { id: "permissions-practice", phase: "catalog", file: "seed/permissions-practice.seed.js", script: "seed:permissions:practice", args: [], dryArgs: ["--dry"], title: "4.13 Amaliyot katalogi" },
  { id: "permissions-admission", phase: "catalog", file: "seed/permissions-admission.seed.js", script: "seed:permissions:admission", args: [], dryArgs: ["--dry"], title: "4.8 Xalqaro qabul katalogi" },
  { id: "permissions-residency", phase: "catalog", file: "seed/permissions-residency.seed.js", script: "seed:permissions:residency", args: [], dryArgs: ["--dry"], title: "4.5 Magistratura va ordinatura katalogi" },
  { id: "permissions-scientific", phase: "catalog", file: "seed/permissions-scientific.seed.js", script: "seed:permissions:scientific", args: [], dryArgs: null, title: "4.10 Ilmiy bo'lim katalogi" },

  { id: "super-admin", phase: "roles", file: "seed/super-admin.seed.js", script: "seed:super-admin", args: [], dryArgs: null, title: "super_admin — barcha huquqlar" },
  { id: "moderator", phase: "roles", file: "seed/moderator-role.seed.js", script: "seed:moderator", args: [], dryArgs: ["--dry"], title: "moderator (bo'lim admini)" },
  { id: "studyload-roles", phase: "roles", file: "seed/studyload-roles.seed.js", script: "seed:studyload-roles", args: [], dryArgs: ["--dry"], title: "4.2 O'quv yuklamalari rollari" },
  { id: "teacher-roles", phase: "roles", file: "seed/teacher-roles.seed.js", script: "seed:teacher-roles", args: [], dryArgs: ["--dry"], title: "4.3 Shaxsiy ish reja rollari" },
  { id: "council-roles", phase: "roles", file: "seed/council-roles.seed.js", script: "seed:council-roles", args: [], dryArgs: null, title: "4.9 Institut kengashi rollari" },
  { id: "science-council-roles", phase: "roles", file: "seed/science-council-roles.seed.js", script: "seed:science-council-roles", args: [], dryArgs: ["--dry"], title: "4.6 Ilmiy kengash rollari" },
  { id: "quality-assurance-roles", phase: "roles", file: "seed/quality-assurance-roles.seed.js", script: "seed:quality-assurance-roles", args: [], dryArgs: null, title: "4.12 Sifat bo'limi huquqlari" },
  { id: "quality-role-access", phase: "roles", file: "seed/quality-role-access.seed.js", script: "seed:quality-role-access", args: ["--write"], dryArgs: [], title: "4.12 Sifat bo'limi menyusi" },
  { id: "task-roles", phase: "roles", file: "seed/task-roles.seed.js", script: "seed:task-roles", args: [], dryArgs: ["--dry"], title: "4.7 Topshiriqlar rollari" },
  { id: "practice-roles", phase: "roles", file: "seed/practice-roles.seed.js", script: "seed:practice-roles", args: [], dryArgs: null, title: "4.13 Amaliyot rollari" },
  { id: "residency-roles", phase: "roles", file: "seed/residency-roles.seed.js", script: "seed:residency-roles", args: [], dryArgs: ["--dry"], title: "4.5 Magistratura va ordinatura rollari" },
  { id: "scientific-roles", phase: "roles", file: "seed/scientific-roles.seed.js", script: "seed:scientific-roles", args: [], dryArgs: null, title: "4.10 Ilmiy bo'lim rollari" },
  { id: "rektor-kengash", phase: "roles", file: "seed/rektor-kengash-roles.seed.js", script: "seed:rektor-kengash", args: ["--write"], dryArgs: [], title: "Rektor va kengash kotibi — modullararo o'qish" },
  { id: "gifted-roles", phase: "roles", file: "seed/gifted-roles.seed.js", script: "seed:gifted-roles", args: [], dryArgs: null, title: "4.11 Iqtidorli yoshlar rollari" },
  { id: "admission-4.8", phase: "roles", file: "seed/admission-4.8.seed.js", script: "seed:admission-4.8", args: [], dryArgs: null, title: "4.8 Xalqaro qabul bo'limi roli" },
  { id: "admission-rektor", phase: "roles", file: "seed/admission-rektor.seed.js", script: "seed:admission-rektor", args: [], dryArgs: null, title: "4.8 Rektor monitoringi" },
  { id: "dashboard-rbac", phase: "roles", file: "seed/dashboard-rbac.seed.js", script: null, args: [], dryArgs: ["--dry"], title: "Rektor boshqaruv paneli" },
  { id: "qual-roles", phase: "roles", file: "seed/qual-roles.seed.js", script: "seed:qual-roles", args: [], dryArgs: ["--dry"], title: "4.4 Malaka oshirish rollari" },

  { id: "oneidpin-index", phase: "index", file: "scripts/migrate-oneidpin-unique-index.js", script: "migrate:oneidpin-index", args: ["--write"], dryArgs: ["--dry"], title: "Foydalanuvchi PIN'i uchun unikal indeks" },
];

const EXCLUDED = new Map();

const { MODULE_PIN_PREFIX, modulePin } = require("./_module-pins");

const range = (prefix, from, to) => {
  const out = [];
  for (let n = from; n <= to; n++) out.push(prefix + String(n).padStart(14 - prefix.length, "0"));
  return out;
};

const TEST_ACCOUNT_SLOTS = 299;

const TEST_ACCOUNT_PINS = [
  ...new Set([
    "qabul_xodim",
    "admin",
    "rahbar",
    "test_super_admin",
    "test_dekan",
    "test_kafedra_mudiri",
    "test_oub",
    "test_prorektor",
    "test_rektor",
    "00000000000000",
    "00000000000001",
    "00000000000002",
    "11111111111111",
    "22222222222222",
    "33333333333333",
    ...range("1000000000000", 1, 4),
    ...range("2000000000000", 1, 4),
    ...range("222222222222", 1, 4),
    ...range("333333333333", 1, 4),
    ...range("401", 1, 1),
    ...range("402", 1, 12),
    ...range("403", 1, 2),
    ...range("404", 1, 8),
    ...range("405", 1, 11),
    ...range("410", 1, 7),
    ...range("412", 12, 12),
    ...Object.values(MODULE_PIN_PREFIX).flatMap((prefix) =>
      Array.from({ length: TEST_ACCOUNT_SLOTS }, (_, i) => modulePin(prefix, i + 1)),
    ),
  ]),
];

module.exports = { PHASES, STEPS, EXCLUDED, TEST_ACCOUNT_PINS };
