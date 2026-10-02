const {
  withPortalRead,
  grantAction,
  SECTION,
  ACTION,
  DASHBOARD_ACTION,
  DASHBOARD_ROLES,
} = require("./scientific-stats-access.seed");

describe("Statistika huquqi seedi — withPortalRead", () => {
  it("bo'lim yo'q bo'lsa qo'shadi", () => {
    const res = withPortalRead([{ section: "article", actionKeys: ["read"] }]);
    expect(res.changed).toBe(true);
    expect(res.permissions).toContainEqual({ section: SECTION, actionKeys: [ACTION] });
  });

  it("boshqa bo'limlarga tegmaydi", () => {
    const before = [
      { section: "article", actionKeys: ["read", "create"] },
      { section: "thesis", actionKeys: ["readAll"] },
    ];
    const res = withPortalRead(before);
    expect(res.permissions).toContainEqual({ section: "article", actionKeys: ["read", "create"] });
    expect(res.permissions).toContainEqual({ section: "thesis", actionKeys: ["readAll"] });
    expect(res.permissions).toHaveLength(3);
  });

  it("allaqachon bor bo'lsa o'zgartirmaydi (idempotent)", () => {
    const res = withPortalRead([{ section: SECTION, actionKeys: [ACTION] }]);
    expect(res.changed).toBe(false);
    expect(res.permissions).toEqual([{ section: SECTION, actionKeys: [ACTION] }]);
  });

  it("bo'lim bor, lekin `read` yo'q bo'lsa — faqat read qo'shiladi", () => {
    const res = withPortalRead([{ section: SECTION, actionKeys: ["export"] }]);
    expect(res.changed).toBe(true);
    expect(res.permissions[0].actionKeys).toEqual(["export", ACTION]);
  });

  it("kirish massivini o'zgartirmaydi (nusxa qaytaradi)", () => {
    const before = [{ section: "article", actionKeys: ["read"] }];
    withPortalRead(before);
    expect(before).toEqual([{ section: "article", actionKeys: ["read"] }]);
  });

  it("bo'sh ro'yxatda ham ishlaydi", () => {
    expect(withPortalRead().permissions).toEqual([{ section: SECTION, actionKeys: [ACTION] }]);
  });
});

describe("Boshqaruv paneli huquqi — grantAction(dashboard)", () => {
  it("`dashboard` amalini mavjud bo'limga qo'shadi, `readAll`ga tegmaydi", () => {
    const res = grantAction([{ section: SECTION, actionKeys: ["read"] }], SECTION, DASHBOARD_ACTION);
    expect(res.changed).toBe(true);
    expect(res.permissions[0].actionKeys).toEqual(["read", DASHBOARD_ACTION]);
  });

  it("ikkala amal birga tura oladi (Statistika + Boshqaruv paneli)", () => {
    const a = grantAction([{ section: SECTION, actionKeys: ["read"] }], SECTION, ACTION);
    const b = grantAction(a.permissions, SECTION, DASHBOARD_ACTION);
    expect(b.permissions[0].actionKeys).toEqual(["read", ACTION, DASHBOARD_ACTION]);
  });

  it("takror berilsa o'zgarmaydi (idempotent)", () => {
    const res = grantAction(
      [{ section: SECTION, actionKeys: ["read", DASHBOARD_ACTION] }],
      SECTION,
      DASHBOARD_ACTION,
    );
    expect(res.changed).toBe(false);
  });

  it("Ilmiy bo'lim ro'yxatda YO'Q — unda 'Statistika' chiqadi", () => {
    expect(DASHBOARD_ROLES).not.toContain("ilmiy_bolim");
  });

  it("4.10 ning qolgan 6 roli ro'yxatda", () => {
    expect([...DASHBOARD_ROLES].sort()).toEqual(
      ["dekan", "ilmiy_kengash_kotibi", "kafedra_mudiri", "oqituvchi", "prorektor", "rektor"],
    );
  });

  it("`withPortalRead` eski xulqini saqlaydi (readAll)", () => {
    expect(withPortalRead().permissions).toEqual([{ section: SECTION, actionKeys: [ACTION] }]);
  });
});
