"use strict";

const ROLE_IDS = {
  superAdmin: "aaaaaaaaaaaaaaaaaaaaaaaa",
  admin: "bbbbbbbbbbbbbbbbbbbbbbbb",
  moderator: "cccccccccccccccccccccccc",
  moderatorOwn: "dddddddddddddddddddddddd",
};

const USER_IDS = {
  superAdminTarget: "eeeeeeeeeeeeeeeeeeeeeeee",
  adminTarget: "ffffffffffffffffffffffff",
  ordinaryTarget: "111111111111111111111111",
  noRoleTarget: "222222222222222222222222",
  missingTarget: "333333333333333333333333",
};

jest.mock("#modules/4.01-auth/role/role.model", () => ({
  findById: jest.fn((id) => ({
    select: () => ({
      lean: async () => {
        if (id === "aaaaaaaaaaaaaaaaaaaaaaaa") return { title: "super_admin" };
        if (id === "bbbbbbbbbbbbbbbbbbbbbbbb") return { title: "admin" };
        if (id === "cccccccccccccccccccccccc") return { title: "moderator" };
        if (id === "dddddddddddddddddddddddd") return { title: "moderator" };
        return null;
      },
    }),
  })),
}), { virtual: true });

jest.mock("#modules/4.01-auth/user/user.model", () => ({
  findById: jest.fn((id) => ({
    select: () => ({
      lean: async () => null,
      populate: () => ({
        lean: async () => {
          if (id === "eeeeeeeeeeeeeeeeeeeeeeee") return { role: { title: "super_admin" } };
          if (id === "ffffffffffffffffffffffff") return { role: { title: "admin" } };
          if (id === "111111111111111111111111") return { role: { title: "moderator" } };
          if (id === "222222222222222222222222") return { role: null };
          return null;
        },
      }),
    }),
  })),
}), { virtual: true });

const {
  assertCanAssignRole,
  assertTitleAllowed,
  assertCanGrant,
  assertCanSetScope,
  assertRoleEditable,
  assertUserEditable,
} = require("./escalationGuard");

const moderator = {
  _id: "cafecafecafecafecafecafe",
  role: {
    _id: ROLE_IDS.moderatorOwn,
    title: "moderator",
    scopeLevel: "faculty",
    permissions: [
      { section: "user", actionKeys: ["create", "read", "readAll", "update", "delete"] },
      { section: "role", actionKeys: ["create", "read", "readAll", "update", "delete"] },
      { section: "faculty", actionKeys: ["create", "read", "readAll", "update", "delete"] },
      { section: "course", actionKeys: ["read", "readAll"] },
    ],
  },
};

const superAdmin = {
  _id: "5c5c5c5c5c5c5c5c5c5c5c5c",
  role: { _id: "6d6d6d6d6d6d6d6d6d6d6d6d", title: "super_admin", permissions: [] },
};

const grantAnyActor = {
  _id: "7e7e7e7e7e7e7e7e7e7e7e7e",
  role: {
    _id: "8f8f8f8f8f8f8f8f8f8f8f8f",
    title: "bolim_admin",
    scopeLevel: "department",
    permissions: [{ section: "role", actionKeys: ["grantAny"] }],
  },
};

const departmentActor = {
  _id: "9a9a9a9a9a9a9a9a9a9a9a9a",
  role: {
    _id: "0b0b0b0b0b0b0b0b0b0b0b0b",
    title: "kafedra_mudiri",
    scopeLevel: "department",
    permissions: [{ section: "faculty", actionKeys: ["read"] }],
  },
};

const expectForbidden = async (fn) => {
  await expect(fn()).rejects.toMatchObject({ statusCode: 403 });
};

describe("escalationGuard — rol biriktirish", () => {
  it("moderator o'ziga/boshqaga super_admin rolini BERA OLMAYDI", async () => {
    await expectForbidden(() => assertCanAssignRole(moderator, ROLE_IDS.superAdmin));
  });

  it("moderator `admin` rolini ham bera olmaydi (nom-asosli bypass yo'li)", async () => {
    await expectForbidden(() => assertCanAssignRole(moderator, ROLE_IDS.admin));
  });

  it("oddiy rolni biriktirish RUXSAT", async () => {
    await expect(assertCanAssignRole(moderator, ROLE_IDS.moderator)).resolves.toBeUndefined();
  });

  it("super_admin uchun cheklov yo'q", async () => {
    await expect(assertCanAssignRole(superAdmin, ROLE_IDS.superAdmin)).resolves.toBeUndefined();
  });

  it("rol berilmasa (undefined) — o'tadi", async () => {
    await expect(assertCanAssignRole(moderator, undefined)).resolves.toBeUndefined();
  });
});

describe("escalationGuard — rol nomi", () => {
  it("moderator rol nomini `admin` qila olmaydi", () => {
    expect(() => assertTitleAllowed(moderator, "admin")).toThrow(/imtiyozli rol nomi/);
  });

  it("moderator rol nomini `super_admin` qila olmaydi", () => {
    expect(() => assertTitleAllowed(moderator, "super_admin")).toThrow();
  });

  it("oddiy nom RUXSAT", () => {
    expect(() => assertTitleAllowed(moderator, "kotib")).not.toThrow();
  });
});

describe("escalationGuard — grant berish", () => {
  it("o'zida BOR huquqni berish RUXSAT", () => {
    expect(() =>
      assertCanGrant(moderator, [{ section: "faculty", actionKeys: ["create", "read"] }]),
    ).not.toThrow();
  });

  it("o'zida YO'Q section'ni bera olmaydi", () => {
    expect(() =>
      assertCanGrant(moderator, [{ section: "workload", actionKeys: ["approve"] }]),
    ).toThrow(/bo'lmagan huquqni bera olmaysiz/);
  });

  it("o'zida faqat o'qish bo'lgan section'ga `create` bera olmaydi", () => {
    expect(() =>
      assertCanGrant(moderator, [{ section: "course", actionKeys: ["create"] }]),
    ).toThrow();
  });

  it("super_admin istalgan grantni beradi", () => {
    expect(() =>
      assertCanGrant(superAdmin, [{ section: "workload", actionKeys: ["approve"] }]),
    ).not.toThrow();
  });
});

describe("escalationGuard — imtiyozli rolni tahrirlash", () => {
  it("moderator super_admin rolini tahrirlay/o'chira olmaydi", async () => {
    await expectForbidden(() => assertRoleEditable(moderator, ROLE_IDS.superAdmin));
  });

  it("moderator oddiy rolni tahrirlashi mumkin", async () => {
    await expect(assertRoleEditable(moderator, ROLE_IDS.moderator)).resolves.toBeUndefined();
  });
});

describe("escalationGuard — grant-admin kapability (hasGrantAny)", () => {
  it("`role:grantAny` ushlagan aktor o'zida YO'Q huquqni (workload:approve) bera OLADI", () => {
    expect(() =>
      assertCanGrant(grantAnyActor, [{ section: "workload", actionKeys: ["approve"] }]),
    ).not.toThrow();
  });

  it("kapabilitysiz aktor uchun subset qoidasi o'zgarmagan — o'zida yo'q huquqni bera olmaydi", () => {
    expect(() =>
      assertCanGrant(moderator, [{ section: "workload", actionKeys: ["approve"] }]),
    ).toThrow(/bo'lmagan huquqni bera olmaysiz/);
  });
});

describe("escalationGuard — role:grantAny NON-DELEGABLE", () => {
  it("grantAny egasi `role:grantAny` kalitini boshqa rolga bera OLMAYDI", () => {
    expect(() =>
      assertCanGrant(grantAnyActor, [{ section: "role", actionKeys: ["grantAny"] }]),
    ).toThrow(/faqat super_admin bera oladi/);
  });

  it("super_admin `role:grantAny` ni bera OLADI", () => {
    expect(() =>
      assertCanGrant(superAdmin, [{ section: "role", actionKeys: ["grantAny"] }]),
    ).not.toThrow();
  });

  it("kapabilitysiz oddiy aktor ham `role:grantAny` bera olmaydi (2-qadam 3-qadamdan OLDIN ishlaydi)", () => {
    expect(() =>
      assertCanGrant(moderator, [{ section: "role", actionKeys: ["grantAny"] }]),
    ).toThrow(/vakolat berish kapabilitysi/);
  });
});

describe("escalationGuard — o'z rolini tahrirlash bloki (self-role)", () => {
  it("aktor O'Z rolini tahrirlay olmaydi", async () => {
    await expectForbidden(() => assertRoleEditable(moderator, moderator.role._id));
  });

  it("o'zinikidan farqli oddiy rolni tahrirlash — o'tadi", async () => {
    await expect(assertRoleEditable(moderator, ROLE_IDS.moderator)).resolves.toBeUndefined();
  });

  it("super_admin uchun o'z rolini tahrirlashda ham cheklov yo'q", async () => {
    await expect(assertRoleEditable(superAdmin, superAdmin.role._id)).resolves.toBeUndefined();
  });
});

describe("escalationGuard — o'ziga boshqa rol biriktirish bloki (self-assign)", () => {
  it("aktor O'ZIGA (targetUserId = actor._id) boshqa rol biriktira OLMAYDI", async () => {
    await expectForbidden(() =>
      assertCanAssignRole(moderator, ROLE_IDS.moderator, { targetUserId: moderator._id }),
    );
  });

  it("aktor o'ziga O'Z joriy rolini qayta yuborsa — o'tadi (frontend har safar `role` yuboradi, soxta 403 bo'lmasin)", async () => {
    await expect(
      assertCanAssignRole(moderator, moderator.role._id, { targetUserId: moderator._id }),
    ).resolves.toBeUndefined();
  });

  it("`opts` berilmasa — self-assign tekshiruvi ishlamaydi (eski ikki-argumentli xulq)", async () => {
    await expect(assertCanAssignRole(moderator, ROLE_IDS.moderator)).resolves.toBeUndefined();
  });
});

describe("escalationGuard — assertCanSetScope", () => {
  it("`department` doiradagi aktor `global` berishga urinsa — 403", () => {
    expect(() => assertCanSetScope(departmentActor, "global")).toThrow(/keng — bera olmaysiz/);
  });

  it("teng doira (`department` → `department`) berish — o'tadi", () => {
    expect(() => assertCanSetScope(departmentActor, "department")).not.toThrow();
  });

  it("torroq doira (`department` → `self`) berish — o'tadi", () => {
    expect(() => assertCanSetScope(departmentActor, "self")).not.toThrow();
  });

  it("`grantAny` egasi istalgan doirani (`global`) beradi", () => {
    expect(() => assertCanSetScope(grantAnyActor, "global")).not.toThrow();
  });

  it("noma'lum `scopeLevel` qiymati — throw QILMAYDI (Joi o'z xatosini beradi)", () => {
    expect(() => assertCanSetScope(departmentActor, "notARealScope")).not.toThrow();
  });
});

describe("escalationGuard — assertUserEditable (break-glass DoS himoyasi)", () => {
  it("target foydalanuvchi roli `super_admin` bo'lsa — 403", async () => {
    await expectForbidden(() => assertUserEditable(moderator, USER_IDS.superAdminTarget));
  });

  it("target foydalanuvchi roli `admin` bo'lsa — 403", async () => {
    await expectForbidden(() => assertUserEditable(moderator, USER_IDS.adminTarget));
  });

  it("target foydalanuvchi oddiy rolli bo'lsa — o'tadi", async () => {
    await expect(assertUserEditable(moderator, USER_IDS.ordinaryTarget)).resolves.toBeUndefined();
  });

  it("super_admin aktor uchun cheklov yo'q", async () => {
    await expect(assertUserEditable(superAdmin, USER_IDS.superAdminTarget)).resolves.toBeUndefined();
  });

  it("target foydalanuvchi topilmasa — throw QILMAYDI", async () => {
    await expect(assertUserEditable(moderator, USER_IDS.missingTarget)).resolves.toBeUndefined();
  });

  it("target foydalanuvchining roli bo'lmasa — throw QILMAYDI", async () => {
    await expect(assertUserEditable(moderator, USER_IDS.noRoleTarget)).resolves.toBeUndefined();
  });
});
