const { NOTIFICATION_ACTIONS } = require("./_module-permission-lib");
const { MODULES } = require("../src/config/constants");

const { rolesDef: practiceRolesDef } = require("./practice-roles.seed");
const { rolesDef: scientificRolesDef } = require("./scientific-roles.seed");
const { rolesDef: councilRolesDef } = require("./council-roles.seed");

function notificationGrantsOf(rolesDef) {
  return rolesDef
    .map((role) => {
      const perm = (role.permissions || []).find(
        (p) => p.section === MODULES.NOTIFICATION,
      );
      return perm ? [role.title, perm.actionKeys] : null;
    })
    .filter(Boolean);
}

function sorted(arr) {
  return [...arr].sort();
}

describe("D-082: notification grant kanonik konstantaga teng (3 seed)", () => {
  const seeds = {
    "practice-roles.seed.js": practiceRolesDef,
    "scientific-roles.seed.js": scientificRolesDef,
    "council-roles.seed.js": councilRolesDef,
  };

  for (const [seedName, rolesDef] of Object.entries(seeds)) {
    const grants = notificationGrantsOf(rolesDef);

    test(`${seedName} da kamida bitta rol notification grant e'lon qiladi`, () => {
      expect(grants.length).toBeGreaterThan(0);
    });

    test.each(grants)(
      `${seedName}: "%s" roli — notification actionKeys === NOTIFICATION_ACTIONS`,
      (_title, actionKeys) => {
        expect(sorted(actionKeys)).toEqual(sorted(NOTIFICATION_ACTIONS));
      },
    );
  }

  test("kanonik to'plam 4 ta action: READ, READ_ALL, UPDATE, DELETE", () => {
    expect(sorted(NOTIFICATION_ACTIONS)).toEqual(
      sorted(["read", "readAll", "update", "delete"]),
    );
  });
});
