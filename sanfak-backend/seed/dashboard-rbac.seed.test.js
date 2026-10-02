const { MODULES, ACTIONS, ROLES } = require("../src/config/constants");
const {
  DASHBOARD_ACTIONS,
  DASHBOARD_TITLE,
  TARGET_ROLES,
} = require("./dashboard-rbac.seed");

const fs = require("fs");
const path = require("path");

const permissionsSeedSrc = fs.readFileSync(
  path.join(__dirname, "permissions.seed.js"),
  "utf8",
);

const sorted = (arr) => [...arr].sort();

describe("dashboard:read — vakolat katalogi", () => {
  test("`dashboard` section constants.MODULES da mavjud", () => {
    expect(MODULES.DASHBOARD).toBe("dashboard");
  });

  test("grant seedi FAQAT `read` action e'lon qiladi", () => {
    expect(sorted(DASHBOARD_ACTIONS)).toEqual([ACTIONS.READ]);
  });

  test("global permissions.seed.js `dashboard` ni [ACTIONS.READ] bilan e'lon qiladi", () => {
    expect(permissionsSeedSrc).toContain(
      "[MODULES.DASHBOARD]: [ACTIONS.READ],",
    );
  });

  test("global permissions.seed.js `dashboard` ni `system` guruhiga bog'laydi", () => {
    expect(permissionsSeedSrc).toContain('[MODULES.DASHBOARD]: ["system"],');
  });

  test("ikki seed bir xil title ishlatadi (drift yo'q)", () => {
    expect(permissionsSeedSrc).toContain(
      `[MODULES.DASHBOARD]: "${DASHBOARD_TITLE}",`,
    );
  });
});

describe("dashboard:read — rol biriktirmasi", () => {
  test("grant hozircha FAQAT `rektor` roliga beriladi", () => {
    expect(TARGET_ROLES).toEqual([ROLES.REKTOR]);
  });

  test("`super_admin` ro'yxatda YO'Q — u permit() bypass + super-admin.seed.js orqali qoplangan", () => {
    expect(TARGET_ROLES).not.toContain(ROLES.SUPER_ADMIN);
  });
});
