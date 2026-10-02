"use strict";

const { CHAIN_REGISTRY } = require("./chainRegistry");
const { ROLES } = require("#config/constants");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const ROLE_VALUES = Object.values(ROLES);
const EXPECTED_ENTITY_KEYS = [
  "workload",
  "workingSchedule",
  "workloadDistribution",
  "syllabus",
  "scienceProgram",
  "workloadSummary",
  "contingentReport",
].sort();

describe("CHAIN_REGISTRY — 7 entity ham ro'yxatda", () => {
  test("kalitlar aynan 7 ta kutilgan entity", () => {
    expect(Object.keys(CHAIN_REGISTRY).sort()).toEqual(EXPECTED_ENTITY_KEYS);
  });
});

describe.each(Object.keys(CHAIN_REGISTRY))("CHAIN_REGISTRY.%s", (entityKey) => {
  const entry = CHAIN_REGISTRY[entityKey];

  test("stepsField, chains, stepRoles, observerRoles, draftStatuses mavjud", () => {
    expect(typeof entry.stepsField).toBe("string");
    expect(typeof entry.chains).toBe("object");
    expect(typeof entry.stepRoles).toBe("object");
    expect(Array.isArray(entry.observerRoles)).toBe(true);
    expect(Array.isArray(entry.draftStatuses)).toBe(true);
  });

  test("har chain'dagi har step stepRoles jadvalida bor", () => {
    for (const chain of Object.values(entry.chains)) {
      for (const step of chain) {
        expect(entry.stepRoles).toHaveProperty(step);
      }
    }
  });

  test("stepRoles qiymatlari ROLES konstantasidan", () => {
    for (const role of Object.values(entry.stepRoles)) {
      expect(ROLE_VALUES).toContain(role);
    }
  });

  test("observerRoles va FAOL zanjir bosqichlarining rollari kesishmaydi", () => {
    const activeSteps = new Set(Object.values(entry.chains).flat());
    const activeRoles = new Set(
      Object.entries(entry.stepRoles)
        .filter(([step]) => activeSteps.has(step))
        .map(([, role]) => role),
    );
    for (const observer of entry.observerRoles) {
      expect(activeRoles.has(observer)).toBe(false);
    }
  });
});

describe("scienceProgram — bitta manba (drift yo'q)", () => {
  test("CHAIN_REGISTRY.scienceProgram.chains model CHAINS bilan deepEqual", () => {
    expect(CHAIN_REGISTRY.scienceProgram.chains).toEqual(
      ScienceProgramModel.CHAINS,
    );
  });

  test("variantField = 'formVersion'", () => {
    expect(CHAIN_REGISTRY.scienceProgram.variantField).toBe("formVersion");
  });

  test("defaultVariant = 'v259' va u chains'ning haqiqiy kaliti", () => {
    expect(CHAIN_REGISTRY.scienceProgram.defaultVariant).toBe("v259");
    expect(Object.keys(CHAIN_REGISTRY.scienceProgram.chains)).toContain(
      CHAIN_REGISTRY.scienceProgram.defaultVariant,
    );
  });
});

describe("ownerRoles — faqat syllabus'da, boshqa entity'larda YO'Q", () => {
  test("syllabus.ownerRoles = { oqituvchi: 'author.teacher' }", () => {
    expect(CHAIN_REGISTRY.syllabus.ownerRoles).toEqual({
      [ROLES.OQITUVCHI]: "author.teacher",
    });
  });

  test("scienceProgram'da ownerRoles YO'Q (oqituvchi allaqachon 1-bosqich `teacher`)", () => {
    expect(CHAIN_REGISTRY.scienceProgram.ownerRoles).toBeUndefined();
  });

  test("ownerRoles kalitlari stepRoles/observerRoles bilan kesishmaydi (syllabus)", () => {
    const entry = CHAIN_REGISTRY.syllabus;
    const stepRoleValues = new Set(Object.values(entry.stepRoles));
    for (const owner of Object.keys(entry.ownerRoles)) {
      expect(stepRoleValues.has(owner)).toBe(false);
      expect(entry.observerRoles.includes(owner)).toBe(false);
    }
  });
});

describe("submitterRoles — faqat contingentReport'da, boshqa toifalar bilan kesishmaydi", () => {
  test("contingentReport.submitterRoles = [fakultet_kengash_kotibi]", () => {
    expect(CHAIN_REGISTRY.contingentReport.submitterRoles).toEqual([
      ROLES.FAKULTET_KENGASH_KOTIBI,
    ]);
  });

  test("boshqa 6 entity'da submitterRoles YO'Q (xulq o'zgarmagan)", () => {
    for (const key of Object.keys(CHAIN_REGISTRY)) {
      if (key === "contingentReport") continue;
      expect(CHAIN_REGISTRY[key].submitterRoles).toBeUndefined();
    }
  });

  test.each(Object.keys(CHAIN_REGISTRY))(
    "%s — submitterRoles stepRoles/observerRoles/ownerRoles bilan kesishmaydi",
    (entityKey) => {
      const entry = CHAIN_REGISTRY[entityKey];
      const submitters = entry.submitterRoles || [];
      expect(Array.isArray(submitters)).toBe(true);
      const stepRoleValues = new Set(Object.values(entry.stepRoles));
      for (const role of submitters) {
        expect(ROLE_VALUES).toContain(role);
        expect(stepRoleValues.has(role)).toBe(false);
        expect(entry.observerRoles.includes(role)).toBe(false);
        expect(Object.keys(entry.ownerRoles || {})).not.toContain(role);
      }
    },
  );

  test("contingentReport: dekan 1-bosqich, kuzatuvchilar O'UB/rektor/prorektor", () => {
    const entry = CHAIN_REGISTRY.contingentReport;
    expect(entry.chains.default).toEqual(["dean"]);
    expect(entry.stepRoles).toEqual({ dean: ROLES.DEKAN });
    expect(entry.observerRoles).toEqual([
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.REKTOR,
      ROLES.PROREKTOR,
    ]);
    expect(entry.draftStatuses).toEqual(["draft"]);
  });
});

describe("buildChainVisibilityFilter — registrdagi HAR entity × HAR rol throw qilmaydi", () => {
  const { buildChainVisibilityFilter } = require("./chainVisibility");

  for (const entityKey of Object.keys(CHAIN_REGISTRY)) {
    for (const role of [...ROLE_VALUES, "kelgusi_yangi_rol"]) {
      test(`${entityKey} × ${role}`, () => {
        expect(() => buildChainVisibilityFilter(entityKey, role)).not.toThrow();
      });
    }
  }
});
