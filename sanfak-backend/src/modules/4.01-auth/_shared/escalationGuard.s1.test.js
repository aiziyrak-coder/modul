"use strict";

const ROLES = {
  rektor: "1a1a1a1a1a1a1a1a1a1a1a1a",
  oqituvchi: "2b2b2b2b2b2b2b2b2b2b2b2b",
  grantAdmin: "3c3c3c3c3c3c3c3c3c3c3c3c",
  dekan: "4d4d4d4d4d4d4d4d4d4d4d4d",
};

const mockRoleDocs = {
  [ROLES.rektor]: {
    title: "rektor",
    scopeLevel: "global",
    permissions: [{ section: "workload", actionKeys: ["read", "approve"] }],
  },
  [ROLES.oqituvchi]: {
    title: "oqituvchi",
    scopeLevel: "self",
    permissions: [{ section: "user", actionKeys: ["read"] }],
  },
  [ROLES.grantAdmin]: {
    title: "moderator",
    scopeLevel: "faculty",
    permissions: [{ section: "role", actionKeys: ["grantAny"] }],
  },
  [ROLES.dekan]: {
    title: "dekan",
    scopeLevel: "faculty",
    permissions: [{ section: "user", actionKeys: ["read"] }],
  },
};

const USERS = {
  rektor: "5e5e5e5e5e5e5e5e5e5e5e5e",
  teacher: "6f6f6f6f6f6f6f6f6f6f6f6f",
  grantAdmin: "7a7a7a7a7a7a7a7a7a7a7a7a",
};

const mockUserDocs = {
  [USERS.rektor]: { role: ROLES.rektor, oneIdPin: "11111111111111" },
  [USERS.teacher]: { role: ROLES.oqituvchi, oneIdPin: "22222222222222" },
  [USERS.grantAdmin]: { role: ROLES.grantAdmin, oneIdPin: "33333333333333" },
};

jest.mock("#modules/4.01-auth/role/role.model", () => ({
  findById: jest.fn((id) => ({
    select: () => ({ lean: async () => mockRoleDocs[id] || null }),
  })),
}), { virtual: true });

jest.mock("#modules/4.01-auth/user/user.model", () => ({
  findById: jest.fn((id) => ({
    select: () => ({
      lean: async () => mockUserDocs[id] || null,
      populate: () => ({
        lean: async () => (mockUserDocs[id] ? { role: mockRoleDocs[mockUserDocs[id].role] } : null),
      }),
    }),
  })),
}), { virtual: true });

const {
  assertCanAssignRole,
  assertUserEditable,
  assertCanChangePin,
} = require("./escalationGuard");

const kadrlar = {
  _id: "8b8b8b8b8b8b8b8b8b8b8b8b",
  role: {
    _id: "9c9c9c9c9c9c9c9c9c9c9c9c",
    title: "kadrlar",
    scopeLevel: "department",
    permissions: [{ section: "user", actionKeys: ["create", "read", "update", "changeStatus"] }],
  },
};

const grantAnyActor = {
  _id: "0d0d0d0d0d0d0d0d0d0d0d0d",
  role: {
    _id: "0e0e0e0e0e0e0e0e0e0e0e0e",
    title: "moderator",
    scopeLevel: "faculty",
    permissions: [
      { section: "role", actionKeys: ["grantAny"] },
      { section: "user", actionKeys: ["create", "read", "update"] },
    ],
  },
};

const superAdmin = {
  _id: "0f0f0f0f0f0f0f0f0f0f0f0f",
  role: { _id: "0a0a0a0a0a0a0a0a0a0a0a0a", title: "super_admin", permissions: [] },
};

const forbidden = (p) => expect(p).rejects.toMatchObject({ statusCode: 403 });
const allowed = (p) => expect(p).resolves.toBeUndefined();

describe("S-1 — rol biriktirish: faqat o'z vakolatlari doirasida", () => {
  it("kadrlar yangi hisobga REKTOR rolini bera olmaydi (grantlar kadrlarda yo'q)", async () => {
    await forbidden(assertCanAssignRole(kadrlar, ROLES.rektor));
  });

  it("kadrlar o'z doirasidagi rolni (oqituvchi) bera oladi", async () => {
    await allowed(assertCanAssignRole(kadrlar, ROLES.oqituvchi));
  });

  it("grantlari ichida, lekin DOIRASI keng rol (dekan: faculty > department) — 403", async () => {
    await forbidden(assertCanAssignRole(kadrlar, ROLES.dekan));
  });

  it("kadrlar `role:grantAny` li rolni (moderator) bera olmaydi", async () => {
    await forbidden(assertCanAssignRole(kadrlar, ROLES.grantAdmin));
  });

  it("tahrirda rol O'ZGARMASA — biriktirish emas, o'tadi (modal rolni qayta yuboradi)", async () => {
    await allowed(assertCanAssignRole(kadrlar, ROLES.rektor, { targetUserId: USERS.rektor }));
  });

  it("tahrirda rolni rektorga O'ZGARTIRISH — 403", async () => {
    await forbidden(assertCanAssignRole(kadrlar, ROLES.rektor, { targetUserId: USERS.teacher }));
  });
});

describe("S-1 — grant-admin (ADR-002) va super_admin", () => {
  it("grant-admin subset'dan ozod — rektor rolini bera oladi (qabul qilingan SoD)", async () => {
    await allowed(assertCanAssignRole(grantAnyActor, ROLES.rektor));
  });

  it("grant-admin ham `role:grantAny` li rolni bera OLMAYDI (NON-DELEGABLE, rail #2)", async () => {
    await forbidden(assertCanAssignRole(grantAnyActor, ROLES.grantAdmin));
  });

  it("super_admin — cheklovsiz", async () => {
    await allowed(assertCanAssignRole(superAdmin, ROLES.grantAdmin));
  });
});

describe("S-1 — assertUserEditable: aktordan keng vakolatli foydalanuvchi", () => {
  it("kadrlar REKTOR hisobini tahrirlay/bloklay olmaydi", async () => {
    await forbidden(assertUserEditable(kadrlar, USERS.rektor));
  });

  it("kadrlar grant-admin hisobini tahrirlay olmaydi", async () => {
    await forbidden(assertUserEditable(kadrlar, USERS.grantAdmin));
  });

  it("kadrlar o'z doirasidagi foydalanuvchini (oqituvchi) tahrirlay oladi", async () => {
    await allowed(assertUserEditable(kadrlar, USERS.teacher));
  });

  it("grant-admin rektor hisobini tahrirlay oladi (ADR-002)", async () => {
    await allowed(assertUserEditable(grantAnyActor, USERS.rektor));
  });
});

describe("S-1 / A1 — assertCanChangePin: PIN'ni faqat super_admin almashtiradi", () => {
  it("kadrlar rektorning PIN'ini almashtira olmaydi", async () => {
    await forbidden(assertCanChangePin(kadrlar, USERS.rektor, "99999999999999"));
  });

  it("grant-admin ham boshqa hisob PIN'ini almashtira olmaydi", async () => {
    await forbidden(assertCanChangePin(grantAnyActor, USERS.teacher, "99999999999999"));
  });

  it("bir xil PIN qayta yuborilsa — o'zgarish yo'q, o'tadi", async () => {
    await allowed(assertCanChangePin(kadrlar, USERS.teacher, " 22222222222222 "));
  });

  it("PIN yuborilmasa — tekshiruv yo'q", async () => {
    await allowed(assertCanChangePin(kadrlar, USERS.rektor, undefined));
  });

  it("super_admin PIN'ni almashtira oladi", async () => {
    await allowed(assertCanChangePin(superAdmin, USERS.rektor, "99999999999999"));
  });
});
