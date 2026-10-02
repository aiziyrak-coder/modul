"use strict";

const fs = require("fs");
const path = require("path");
const { resizeImages } = require("#shared/uploadFiles");

const MODULE_DIR = path.join(__dirname, "..");

const uploadRouteEntities = () =>
  fs
    .readdirSync(MODULE_DIR)
    .filter((entity) => {
      const file = path.join(MODULE_DIR, entity, `${entity}.routes.js`);
      return (
        fs.existsSync(file) &&
        fs.readFileSync(file, "utf8").includes('require("#shared/uploadFiles")')
      );
    })
    .sort();

const EXPECTED_ENTITIES = [
  "activityPlan",
  "dissertationPlan",
  "residencyCurriculum",
  "residencyTest",
  "residentApplication",
  "resource",
];

const routerOf = (entity) =>
  require(path.join(MODULE_DIR, entity, `${entity}.routes.js`));

const writeChains = (entity) => {
  const out = [];
  for (const layer of routerOf(entity).stack) {
    if (!layer.route) continue;
    const byMethod = new Map();
    layer.route.stack.forEach((h) => {
      if (!byMethod.has(h.method)) byMethod.set(h.method, []);
      byMethod.get(h.method).push(h.handle);
    });
    for (const [method, handles] of byMethod) {
      const writeAt = handles.indexOf(resizeImages);
      if (writeAt === -1) continue;
      out.push({
        entity,
        method,
        route: layer.route.path,
        writeAt,
        guardAt: handles.findIndex((h) => h.name === "uploadContentGuardMw"),
      });
    }
  }
  return out;
};

describe("guardUploadContent — zanjirga ulanganmi", () => {
  it("yuklash yo'li bo'lgan entity'lar ro'yxati kutilganidek", () => {
    expect(uploadRouteEntities()).toEqual(EXPECTED_ENTITIES);
  });

  const chains = EXPECTED_ENTITIES.flatMap(writeChains);

  it("diskka yozadigan zanjir topildi (test bo'sh emas)", () => {
    expect(chains.length).toBeGreaterThan(0);
  });

  it.each(chains)(
    "$entity: $method $route → guard bor va diskka yozishdan OLDIN",
    ({ guardAt, writeAt }) => {
      expect(guardAt).toBeGreaterThanOrEqual(0);
      expect(guardAt).toBeLessThan(writeAt);
    },
  );
});
