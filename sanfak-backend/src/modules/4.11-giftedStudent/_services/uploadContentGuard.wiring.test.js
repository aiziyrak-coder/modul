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

const EXPECTED_ENTITIES = ["studentAchievement"];

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

const allChains = () => uploadRouteEntities().flatMap(writeChains);

describe("guardUploadContent — 4.11 zanjiriga ulanganmi", () => {
  it("yuklash yo'li bo'lgan entity'lar ro'yxati kutilganidek", () => {
    expect(uploadRouteEntities()).toEqual(EXPECTED_ENTITIES);
  });

  it("diskka yozadigan yo'llar topildi (bo'sh sikl yashil qolmasin)", () => {
    expect(allChains()).toHaveLength(4);
  });

  it.each(allChains())(
    "$entity $method $route — guard bor va `resizeImages` dan OLDIN",
    ({ guardAt, writeAt }) => {
      expect(guardAt).toBeGreaterThan(-1);
      expect(guardAt).toBeLessThan(writeAt);
    },
  );
});

describe("4.05 dan qayta ishlatish seami", () => {
  it("adapter 4.05 dagi AYNI middleware'ni beradi (ikkinchi imzo jadvali yo'q)", () => {
    const local = require("./uploadContentGuard");
    const source = require("#modules/4.05-residency/_services/uploadContentGuard");
    expect(local.uploadContentGuardMw).toBe(source.uploadContentGuardMw);
    expect(local.HEADER_BYTES).toBe(source.HEADER_BYTES);
  });
});
