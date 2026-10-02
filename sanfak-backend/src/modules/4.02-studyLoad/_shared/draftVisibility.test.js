const {
  restrictUnsubmittedVisibility,
  UNSUBMITTED_STATUSES,
} = require("./draftVisibility");
const { ROLES } = require("#config/constants");

const reqAs = (title) => ({ user: { role: { title } } });

describe("restrictUnsubmittedVisibility", () => {
  test("EGA rol — filtr TEGILMAYDI (o'z qoralamasini ko'radi)", () => {
    const f = { department: "d1" };
    restrictUnsubmittedVisibility(f, reqAs(ROLES.OQUV_USLUBIY_BOSHQARMA), [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
    ]);
    expect(f).toEqual({ department: "d1" });
  });

  test("super_admin — filtr TEGILMAYDI", () => {
    const f = {};
    restrictUnsubmittedVisibility(f, reqAs(ROLES.SUPER_ADMIN), [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
    ]);
    expect(f).toEqual({});
  });

  test.each([
    ROLES.KAFEDRA_MUDIRI,
    ROLES.DEKAN,
    ROLES.PROREKTOR,
    ROLES.REKTOR,
    ROLES.REJA_MOLIYA,
  ])("ega bo'lmagan rol (%s) — draft/new YASHIRILADI", (role) => {
    const f = { department: "d1" };
    restrictUnsubmittedVisibility(f, reqAs(role), [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
    ]);
    expect(f.status).toEqual({ $nin: UNSUBMITTED_STATUSES });
    expect(f.department).toBe("d1");
  });

  test("?status=draft bilan chetlab o'tishga urinish — BO'SH natija", () => {
    const f = { status: "draft" };
    restrictUnsubmittedVisibility(f, reqAs(ROLES.DEKAN), [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
    ]);
    expect(f.status).toEqual({ $in: [] });
  });

  test("?status=new bilan urinish ham BO'SH natija", () => {
    const f = { status: "new" };
    restrictUnsubmittedVisibility(f, reqAs(ROLES.KAFEDRA_MUDIRI), [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
    ]);
    expect(f.status).toEqual({ $in: [] });
  });

  test("ruxsat etilgan statusni so'rash — TEGILMAYDI", () => {
    const f = { status: "approved" };
    restrictUnsubmittedVisibility(f, reqAs(ROLES.DEKAN), [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
    ]);
    expect(f.status).toBe("approved");
  });

  test("bir nechta ega rol berilsa — har biri o'tadi", () => {
    for (const r of [ROLES.OQITUVCHI, ROLES.KAFEDRA_MUDIRI]) {
      const f = {};
      restrictUnsubmittedVisibility(f, reqAs(r), [
        ROLES.OQITUVCHI,
        ROLES.KAFEDRA_MUDIRI,
      ]);
      expect(f.status).toBeUndefined();
    }
  });

  test("roli yo'q (autentifikatsiyasiz/nomalum) — draft/new YASHIRILADI", () => {
    const f = {};
    restrictUnsubmittedVisibility(f, { user: {} }, [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
    ]);
    expect(f.status).toEqual({ $nin: UNSUBMITTED_STATUSES });
  });
});
