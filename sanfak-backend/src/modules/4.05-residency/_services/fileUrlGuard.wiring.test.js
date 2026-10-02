"use strict";

const fs = require("fs");
const path = require("path");

const MODULE_DIR = path.join(__dirname, "..");

const EXPECTED = [
  { entity: "residentApplication", method: "post", route: "/", field: "fileUrl", mode: "own-file" },
  { entity: "dailyLog", method: "post", route: "/", field: "fileUrl", mode: "own-file" },
  { entity: "dailyLog", method: "put", route: "/:id", field: "fileUrl", mode: "own-file" },
  { entity: "resource", method: "post", route: "/", field: "fileUrl", mode: "own-file" },
  { entity: "resource", method: "put", route: "/:id", field: "fileUrl", mode: "own-file" },
  { entity: "residencyTest", method: "post", route: "/", field: "fileUrl", mode: "own-file" },
  { entity: "residencyTest", method: "put", route: "/:id", field: "fileUrl", mode: "own-file" },
  { entity: "resident", method: "post", route: "/", field: "diplomaFileUrl", mode: "own-file" },
  { entity: "resident", method: "put", route: "/:id", field: "diplomaFileUrl", mode: "own-file" },
  {
    entity: "residencyCurriculum",
    method: "post",
    route: "/",
    field: "processFile.url",
    mode: "own-file",
  },
  {
    entity: "residencyCurriculum",
    method: "post",
    route: "/",
    field: "planFile.url",
    mode: "own-file",
  },
  {
    entity: "residencyCurriculum",
    method: "put",
    route: "/:id",
    field: "processFile.url",
    mode: "own-file",
  },
  {
    entity: "residencyCurriculum",
    method: "put",
    route: "/:id",
    field: "planFile.url",
    mode: "own-file",
  },
  {
    entity: "activityPlan",
    method: "post",
    route: "/:id/tasks/:taskIndex/proofs",
    field: "fileUrl",
    mode: "own-file",
  },
  {
    entity: "activityPlan",
    method: "post",
    route: "/:id/tasks/:taskIndex/proofs",
    field: "url",
    mode: "scheme",
  },
  {
    entity: "dissertationPlan",
    method: "post",
    route: "/:id/tasks/:taskIndex/proofs",
    field: "fileUrl",
    mode: "own-file",
  },
  {
    entity: "dissertationPlan",
    method: "post",
    route: "/:id/tasks/:taskIndex/proofs",
    field: "url",
    mode: "scheme",
  },
];

const guardsOf = (router, method, routePath) => {
  const layer = router.stack.find((l) => l.route && l.route.path === routePath);
  if (!layer) return null;
  const stack = layer.route.stack.filter((h) => h.method === method);
  return stack
    .map((h, index) => ({ handle: h.handle, index }))
    .filter(({ handle }) => handle.name === "fileUrlGuardMw")
    .map(({ handle, index }) => ({
      field: handle.guardedField,
      mode: handle.guardedMode,
      index,
      last: stack.length - 1,
    }));
};

const routerCache = new Map();
const routerOf = (entity) => {
  if (!routerCache.has(entity)) {
    routerCache.set(entity, require(path.join(MODULE_DIR, entity, `${entity}.routes.js`)));
  }
  return routerCache.get(entity);
};

describe("guardFileUrl — route zanjiriga ulanganmi", () => {
  it.each(EXPECTED)(
    "$entity: $method $route → `$field` ($mode)",
    ({ entity, method, route, field, mode }) => {
      const found = guardsOf(routerOf(entity), method, route);
      expect(found).not.toBeNull();
      const hit = found.find((g) => g.field === field);
      expect(hit).toBeDefined();
      expect(hit.mode).toBe(mode);
    },
  );

  it.each(EXPECTED)(
    "$entity: $method $route → guard controller'dan OLDIN turadi",
    ({ entity, method, route, field }) => {
      const hit = guardsOf(routerOf(entity), method, route).find((g) => g.field === field);
      expect(hit.index).toBeLessThan(hit.last);
    },
  );
});

describe("TRIPWIRE — validatorlarda qo'riqlanmagan `*url` maydoni yo'qmi", () => {
  const DELIBERATELY_UNGUARDED = {
  };

  const urlKeys = () => {
    const out = [];
    for (const entity of fs.readdirSync(MODULE_DIR)) {
      const file = path.join(MODULE_DIR, entity, `${entity}.validation.js`);
      if (!fs.existsSync(file)) continue;
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        const m = /^\s*([a-zA-Z]*([uU]rl|[lL]ink|[hH]ref|[pP]hoto|[sS]rc|[pP]ath))\s*:/.exec(line);
        if (m) out.push({ entity, key: m[1], at: `${entity}.validation.js:${i + 1}` });
      });
    }
    return out;
  };

  it("har bir `*url` maydoni yo qo'riqlangan, yo ataylab ro'yxatda", () => {
    const guarded = new Set(
      EXPECTED.map((e) => `${e.entity}.${e.field.split(".").pop()}`),
    );
    const orphans = urlKeys()
      .filter((k) => !guarded.has(`${k.entity}.${k.key}`))
      .filter((k) => !DELIBERATELY_UNGUARDED[`${k.entity}.${k.key}`])
      .map((k) => `${k.at} → ${k.key}`);

    expect(orphans).toEqual([]);
  });

  it("`fileSchema` slotlari kutilganidan oshmagan", () => {
    const file = path.join(
      MODULE_DIR,
      "residencyCurriculum",
      "residencyCurriculum.validation.js",
    );
    const slots = [...fs.readFileSync(file, "utf8").matchAll(/^\s*(\w+):\s*fileSchema/gm)].map(
      (m) => m[1],
    );
    expect(new Set(slots)).toEqual(new Set(["processFile", "planFile"]));
  });
});
