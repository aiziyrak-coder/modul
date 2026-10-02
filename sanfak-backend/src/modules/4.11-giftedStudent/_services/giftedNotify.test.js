"use strict";

const mockDispatch = jest.fn();
jest.mock(
  "#system/notification/notificationDispatcher",
  () => ({ dispatch: (...a) => mockDispatch(...a) }),
  { virtual: true },
);

const mockFindById = jest.fn();
jest.mock("mongoose", () => ({
  model: () => ({ findById: (...a) => mockFindById(...a) }),
}));

const { notifyUser, notifyStudent, EVENTS, LINKS } = require("./giftedNotify");

const studentReturns = (doc) =>
  mockFindById.mockReturnValue({ select: () => ({ lean: async () => doc }) });

const PAYLOAD = {
  eventType: EVENTS.ACHIEVEMENT_REVIEWED,
  title: "Faoliyatingiz rad etildi",
  body: '"Mahalliy jurnalda maqola" — hujjat o‘qilmadi',
  link: LINKS.STUDENT_ACTIVITIES,
};

beforeEach(() => {
  mockDispatch.mockReset();
  mockFindById.mockReset();
});

describe("notifyUser", () => {
  test("yuboradi va payloadni O'ZGARTIRMAYDI", async () => {
    await notifyUser("u1", PAYLOAD);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({ userId: "u1", ...PAYLOAD, metadata: undefined });
  });

  test.each([[null], [undefined], [""]])(
    "userId %p — dispatch UMUMAN chaqirilmaydi (throw ham yo'q)",
    async (userId) => {
      await expect(notifyUser(userId, PAYLOAD)).resolves.toBeUndefined();
      expect(mockDispatch).not.toHaveBeenCalled();
    },
  );

  test("dispatch yiqilsa — CHAQIRUVCHI yiqilmaydi (best-effort)", async () => {
    mockDispatch.mockRejectedValue(new Error("redis down"));
    await expect(notifyUser("u1", PAYLOAD)).resolves.toBeUndefined();
  });
});

describe("notifyStudent", () => {
  test("yozuvdan akkauntni topib yuboradi", async () => {
    studentReturns({ user: "acct-1" });
    await notifyStudent("gs-1", PAYLOAD);
    expect(mockFindById).toHaveBeenCalledWith("gs-1");
    expect(mockDispatch).toHaveBeenCalledWith({ userId: "acct-1", ...PAYLOAD, metadata: undefined });
  });

  test("akkauntsiz talaba — JIM o'tadi", async () => {
    studentReturns({ user: null });
    await expect(notifyStudent("gs-1", PAYLOAD)).resolves.toBeUndefined();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test("talaba yozuvi topilmadi — JIM o'tadi", async () => {
    studentReturns(null);
    await expect(notifyStudent("gs-1", PAYLOAD)).resolves.toBeUndefined();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test("id bo'sh — bazaga UMUMAN bormaydi", async () => {
    await notifyStudent(null, PAYLOAD);
    expect(mockFindById).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test("so'rov yiqilsa — CHAQIRUVCHI yiqilmaydi", async () => {
    mockFindById.mockImplementation(() => {
      throw new Error("db down");
    });
    await expect(notifyStudent("gs-1", PAYLOAD)).resolves.toBeUndefined();
  });
});

describe("shartnoma (kontrakt) qulflari", () => {
  test("eventType'lar `gifted_` bilan boshlanadi", () => {
    for (const v of Object.values(EVENTS)) expect(v.startsWith("gifted_")).toBe(true);
  });

  test("havolalar modul namespace'i bilan boshlanadi", () => {
    for (const v of Object.values(LINKS)) expect(v.startsWith("/gifted-students/")).toBe(true);
  });
});
