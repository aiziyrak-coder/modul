"use strict";

const {
  ROLE_PERMISSIONS: STUDYLOAD_MATRIX,
} = require("../src/modules/4.02-studyLoad/studyLoad.permissions");
const {
  ROLE_PERMISSIONS: TEACHER_MATRIX,
} = require("../src/modules/4.03-teacher/teacher.permissions");

const councilRoles = require("./council-roles.seed");
const scienceCouncilRoles = require("./science-council-roles.seed");
const scientificRoles = require("./scientific-roles.seed");
const practiceRoles = require("./practice-roles.seed");
const qualRoles = require("./qual-roles.seed");
const residencyRoles = require("./residency-roles.seed");
const giftedRoles = require("./gifted-roles.seed");
const taskRoles = require("./task-roles.seed");
const qualityAssuranceRoles = require("./quality-assurance-roles.seed");
const moderatorRole = require("./moderator-role.seed");
const admission48 = require("./admission-4.8.seed");
const admissionRektor = require("./admission-rektor.seed");
const oqituvchiTestRbac = require("./oqituvchi-test-rbac.seed");
const listenerRbac = require("./listener-rbac.seed");
const dashboardRbac = require("./dashboard-rbac.seed");

function fromRolePermissionsMatrix(source, matrix) {
  const grants = [];
  const titles = new Set();
  for (const [title, def] of Object.entries(matrix || {})) {
    titles.add(title);
    for (const [section, actions] of Object.entries(def.sections || {})) {
      if (!actions || !actions.length) continue;
      grants.push({ source, title, section, actions: [...actions] });
    }
  }
  return { grants, titles };
}

function fromRolesDef(source, rolesDef) {
  const grants = [];
  const titles = new Set();
  for (const r of rolesDef || []) {
    titles.add(r.title);
    for (const p of r.permissions || []) {
      if (!p.actionKeys || !p.actionKeys.length) continue;
      grants.push({ source, title: r.title, section: p.section, actions: [...p.actionKeys] });
    }
  }
  return { grants, titles };
}

function fromGrants(source, GRANTS, extraTitleSources = []) {
  const grants = [];
  const titles = new Set();
  for (const [title, sections] of Object.entries(GRANTS || {})) {
    titles.add(title);
    for (const [section, actions] of Object.entries(sections || {})) {
      if (!actions || !actions.length) continue;
      grants.push({ source, title, section, actions: [...actions] });
    }
  }
  for (const extra of extraTitleSources) {
    for (const t of extra || []) titles.add(typeof t === "string" ? t : t.title);
  }
  return { grants, titles };
}

function fromSectionsMap(source, title, SECTIONS) {
  const grants = Object.entries(SECTIONS || {}).map(([section, actions]) => ({
    source,
    title,
    section,
    actions: [...actions],
  }));
  return { grants, titles: new Set([title]) };
}

function fromSectionList(source, title, sections) {
  return {
    grants: (sections || []).map((s) => ({ source, title, section: s.section, actions: [...s.actionKeys] })),
    titles: new Set([title]),
  };
}

function fromSingleSection(source, title, singleSection) {
  return fromSectionList(source, title, [singleSection]);
}

function fromTargetRoles(source, TARGET_ROLES, section) {
  const grants = (TARGET_ROLES || []).map((title) => ({
    source,
    title,
    section: section.section,
    actions: [...section.actionKeys],
  }));
  return { grants, titles: new Set(TARGET_ROLES || []) };
}

const SOURCES = [
  fromRolePermissionsMatrix("studyload-roles (4.02 matrix)", STUDYLOAD_MATRIX),
  fromRolePermissionsMatrix("teacher-roles (4.03 matrix)", TEACHER_MATRIX),
  fromRolesDef("council-roles.seed", councilRoles.rolesDef),
  fromRolesDef("science-council-roles.seed", scienceCouncilRoles.rolesDef),
  fromRolesDef("scientific-roles.seed", scientificRoles.rolesDef),
  fromRolesDef("practice-roles.seed", practiceRoles.rolesDef),
  fromRolesDef("qual-roles.seed", qualRoles.rolesDef),
  fromGrants("residency-roles.seed", residencyRoles.GRANTS, [residencyRoles.NEW_ROLES]),
  fromGrants("gifted-roles.seed", giftedRoles.GRANTS, [giftedRoles.NEW_ROLES]),
  fromGrants("task-roles.seed", taskRoles.GRANTS, [Object.keys(taskRoles.REVOKES || {})]),
  fromGrants("quality-assurance-roles.seed", qualityAssuranceRoles.GRANTS),
  fromSectionsMap("moderator-role.seed", "moderator", moderatorRole.SECTIONS),
  fromSectionList("admission-4.8.seed", "qabul_bolimi", [
    ...admission48.ADMISSION_SECTIONS,
    ...admission48.SUPPORT_SECTIONS,
  ]),
  fromSingleSection("admission-rektor.seed", "rektor", admissionRektor.REKTOR_SECTION),
  fromSectionList("oqituvchi-test-rbac.seed", oqituvchiTestRbac.OQITUVCHI_ROLE, oqituvchiTestRbac.ADD),
  fromSectionList("listener-rbac.seed", listenerRbac.ROLE_TITLE, listenerRbac.ADD),
  fromTargetRoles("dashboard-rbac.seed", dashboardRbac.TARGET_ROLES, dashboardRbac.DASHBOARD_SECTION),
];

function loadAll() {
  const grants = [];
  const titles = new Set();
  for (const { grants: g, titles: t } of SOURCES) {
    grants.push(...g);
    t.forEach((x) => titles.add(x));
  }
  return { grants, titles };
}

module.exports = { loadAll };
