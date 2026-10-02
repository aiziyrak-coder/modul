const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");

if (!mongoose.models.role) mongoose.model("role", new mongoose.Schema({}));
if (!mongoose.models.user) mongoose.model("user", new mongoose.Schema({}));

jest.mock("#modules/4.13-practice/medicalOrganization/medicalOrganization.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
  dispatchMany: jest.fn().mockResolvedValue({ total: 0, success: 0, failed: 0 }),
}));

const MedicalOrganization = require("#modules/4.13-practice/medicalOrganization/medicalOrganization.model");
const { dispatchMany } = require("#system/notification/notificationDispatcher");
const { notifyRoles, notifyOrgResponsibleUsers } = require("./practiceNotify");

const RoleModel = mongoose.model("role");
const UserModel = mongoose.model("user");

const mockChain = (model, method, resolved) => {
  model[method] = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(resolved) }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("notifyRoles — N-06 (dispatcher orqali, active:true filtri)", () => {
  test("rol topilmasa — dispatchMany chaqirilmaydi", async () => {
    mockChain(RoleModel, "findOne", null);
    await notifyRoles("rektor", { eventType: "contract_sent_to_rector", title: "T" });
    expect(dispatchMany).not.toHaveBeenCalled();
  });

  test("rol topildi, lekin aktiv user yo'q — dispatchMany chaqirilmaydi", async () => {
    mockChain(RoleModel, "findOne", { _id: "role1" });
    mockChain(UserModel, "find", []);
    await notifyRoles("rektor", { eventType: "contract_sent_to_rector", title: "T" });
    expect(UserModel.find).toHaveBeenCalledWith({ role: "role1", active: true });
    expect(dispatchMany).not.toHaveBeenCalled();
  });

  test("topilgan foydalanuvchilar dispatchMany'ga eventType/payload bilan uzatiladi", async () => {
    mockChain(RoleModel, "findOne", { _id: "role1" });
    mockChain(UserModel, "find", [{ _id: "u1" }, { _id: "u2" }]);

    await notifyRoles("rektor", {
      eventType: "contract_sent_to_rector",
      title: "Yangi shartnoma",
      body: "AM-0001",
      link: "/shartnomalar/1",
      metadata: { contractId: "1" },
    });

    expect(dispatchMany).toHaveBeenCalledWith({
      userIds: ["u1", "u2"],
      eventType: "contract_sent_to_rector",
      title: "Yangi shartnoma",
      body: "AM-0001",
      link: "/shartnomalar/1",
      metadata: { contractId: "1" },
    });
  });

  test("bir nechta rol (massiv) — ikkalasidan ham topilganlar birlashtiriladi", async () => {
    RoleModel.findOne = jest
      .fn()
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ _id: "roleA" }) }) })
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ _id: "roleB" }) }) });
    UserModel.find = jest
      .fn()
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve([{ _id: "uA" }]) }) })
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve([{ _id: "uB" }]) }) });

    await notifyRoles(["amaliyot_bolimi", "rektor"], {
      eventType: "contract_both_approved",
      title: "T",
    });

    expect(dispatchMany).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["uA", "uB"] }),
    );
  });

  test("dispatchMany xato bersa ham throw qilmaydi (best-effort)", async () => {
    mockChain(RoleModel, "findOne", { _id: "role1" });
    mockChain(UserModel, "find", [{ _id: "u1" }]);
    dispatchMany.mockRejectedValueOnce(new Error("dispatch xato"));

    await expect(
      notifyRoles("rektor", { eventType: "x", title: "T" }),
    ).resolves.toBeUndefined();
  });
});

describe("notifyRoles — N-20 (rektor ko'plik ogohlantirishi, observability-only)", () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(winston, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("2 ta aktiv 'rektor' akkaunti — winston.warn 1 marta chaqiriladi, HAMMASIGA yuboriladi (xulq o'zgarmaydi)", async () => {
    mockChain(RoleModel, "findOne", { _id: "role1" });
    mockChain(UserModel, "find", [{ _id: "u1" }, { _id: "u2" }]);

    await notifyRoles("rektor", { eventType: "contract_sent_to_rector", title: "T" });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/rektor/i);
    expect(dispatchMany).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["u1", "u2"] }),
    );
  });

  test("1 ta aktiv 'rektor' akkaunti — winston.warn chaqirilmaydi", async () => {
    mockChain(RoleModel, "findOne", { _id: "role1" });
    mockChain(UserModel, "find", [{ _id: "u1" }]);

    await notifyRoles("rektor", { eventType: "contract_sent_to_rector", title: "T" });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("'amaliyot_bolimi' rolida 2 ta xodim — warn chaqirilmaydi (bo'limda ko'plik NORMAL, shovqin emas)", async () => {
    mockChain(RoleModel, "findOne", { _id: "role2" });
    mockChain(UserModel, "find", [{ _id: "a1" }, { _id: "a2" }]);

    await notifyRoles("amaliyot_bolimi", { eventType: "contract_rejected", title: "T" });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("['amaliyot_bolimi','rektor'] massivida faqat rektor tomoni 2+ bo'lsa warn beradi (contract_both_approved shakli)", async () => {
    RoleModel.findOne = jest
      .fn()
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ _id: "roleAB" }) }) })
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ _id: "roleRektor" }) }) });
    UserModel.find = jest
      .fn()
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve([{ _id: "a1" }]) }) })
      .mockReturnValueOnce({
        select: () => ({ lean: () => Promise.resolve([{ _id: "r1" }, { _id: "r2" }]) }),
      });

    await notifyRoles(["amaliyot_bolimi", "rektor"], {
      eventType: "contract_both_approved",
      title: "T",
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/rektor/i);
  });
});

describe("notifyOrgResponsibleUsers — N-02 SECURITY (tashkilot doirasi)", () => {
  const ORG_A = "org-A";
  const ORG_B = "org-B";
  const LEADER_A = "leader-A";
  const LEADER_B = "leader-B";

  const ORG_STORE = {
    [ORG_A]: { responsibleUsers: [LEADER_A] },
    [ORG_B]: { responsibleUsers: [LEADER_B] },
  };
  const mockOrgStore = () => {
    MedicalOrganization.findById = jest.fn().mockImplementation((id) => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(ORG_STORE[id] ?? null),
      }),
    }));
  };
  const mockAllUsersActive = () => {
    UserModel.find = jest.fn().mockImplementation((q) => ({
      select: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue((q?._id?.$in || []).map((id) => ({ _id: id }))),
      }),
    }));
  };

  test("org-A hodisasi ⇒ FAQAT org-A rahbari(lari) chaqiriladi", async () => {
    mockOrgStore();
    mockAllUsersActive();

    await notifyOrgResponsibleUsers(ORG_A, {
      eventType: "contract_rektor_approved",
      title: "Rektor tasdiqladi",
      body: "AM-0001",
      link: "/shartnomalar/1",
      metadata: { contractId: "1" },
    });

    expect(MedicalOrganization.findById).toHaveBeenCalledWith(ORG_A);
    expect(dispatchMany).toHaveBeenCalledWith({
      userIds: [LEADER_A],
      eventType: "contract_rektor_approved",
      title: "Rektor tasdiqladi",
      body: "AM-0001",
      link: "/shartnomalar/1",
      metadata: { contractId: "1" },
    });
  });

  test("org-A hodisasi ⇒ org-B rahbari BILDIRISHNOMA OLMAYDI", async () => {
    mockOrgStore();
    mockAllUsersActive();

    await notifyOrgResponsibleUsers(ORG_A, {
      eventType: "contract_rektor_approved",
      title: "T",
    });

    expect(dispatchMany).toHaveBeenCalledTimes(1);
    const allRecipients = dispatchMany.mock.calls.flatMap((c) => c[0].userIds);
    expect(allRecipients).not.toContain(LEADER_B);
    expect(allRecipients).toEqual([LEADER_A]);
  });

  test("nofaol mas'ul filtrlanadi (active:true)", async () => {
    MedicalOrganization.findById = jest.fn().mockImplementation((id) => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(
          id === ORG_A ? { responsibleUsers: [LEADER_A, "inactive-user"] } : null,
        ),
      }),
    }));
    mockChain(UserModel, "find", [{ _id: LEADER_A }]);

    await notifyOrgResponsibleUsers(ORG_A, {
      eventType: "contract_rektor_approved",
      title: "T",
    });

    expect(UserModel.find).toHaveBeenCalledWith({
      _id: { $in: [LEADER_A, "inactive-user"] },
      active: true,
    });
    expect(dispatchMany).toHaveBeenCalledTimes(1);
    expect(dispatchMany.mock.calls[0][0].userIds).toEqual([LEADER_A]);
  });

  test("tashkilot topilmasa yoki responsibleUsers bo'sh — dispatchMany chaqirilmaydi", async () => {
    MedicalOrganization.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    await notifyOrgResponsibleUsers(ORG_A, { eventType: "x", title: "T" });
    expect(dispatchMany).not.toHaveBeenCalled();
  });

  test("organizationId berilmasa — DB so'rovisiz qaytadi", async () => {
    await notifyOrgResponsibleUsers(null, { eventType: "x", title: "T" });
    expect(MedicalOrganization.findById).not.toHaveBeenCalled();
    expect(dispatchMany).not.toHaveBeenCalled();
  });

  test("dispatchMany xato bersa ham throw qilmaydi (best-effort)", async () => {
    MedicalOrganization.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ responsibleUsers: [LEADER_A] }),
      }),
    });
    dispatchMany.mockRejectedValueOnce(new Error("dispatch xato"));

    await expect(
      notifyOrgResponsibleUsers(ORG_A, { eventType: "x", title: "T" }),
    ).resolves.toBeUndefined();
  });
});
