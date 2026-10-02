"use strict";

const mockFindById = jest.fn();
const mockFindByIdAndUpdate = jest.fn();

jest.mock("./residentApplication.model", () => ({
  find: jest.fn(),
  paginate: jest.fn(),
  aggregate: jest.fn(),
  findById: (...a) => mockFindById(...a),
  findByIdAndUpdate: (...a) => mockFindByIdAndUpdate(...a),
  updateMany: jest.fn(),
}));
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));
jest.mock("#modules/4.05-residency/attendance/attendance.model", () => ({
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  find: jest.fn(),
}));

const mockScope = jest.fn();
jest.mock("#modules/4.05-residency/_services/residentScope", () => ({
  buildResidentScope: (...a) => mockScope(...a),
  denyActForResident: jest.fn(),
}));

const mockNotify = jest.fn();
jest.mock("#modules/4.05-residency/_services/residentNotify", () => ({
  notifyResident: (...a) => mockNotify(...a),
  notifyUser: jest.fn(),
  EVENTS: { APPLICATION_REVIEWED: "residency_application_reviewed" },
  LINKS: { APPLICATIONS: "/residency/arizalar" },
}));

const C = require("./residentApplication.controller");

const RESIDENT = "6a5a0acbd34b3c21a575d111";
const APP_ID = "6a5a0acbd34b3c21a575d222";

const resFor = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

const review = async (body, doc = {}) => {
  mockFindById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ resident: RESIDENT }),
  });
  mockFindByIdAndUpdate.mockResolvedValue({
    _id: APP_ID,
    resident: RESIDENT,
    reason: "Akademik ta'til",
    ...doc,
    ...body,
  });
  const next = jest.fn();
  const res = resFor();
  await C.reviewApplication(
    { params: { id: APP_ID }, body, user: { _id: "u1" } },
    res,
    next,
  );
  expect(next).not.toHaveBeenCalled();
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockScope.mockResolvedValue({ filter: {}, denied: false });
});

describe("D-29 — ariza qarori bildirishnomasi", () => {
  test("tasdiqlanganda talabaga xabar ketadi", async () => {
    await review({ status: "tasdiqlangan" });

    expect(mockNotify).toHaveBeenCalledTimes(1);
    const [residentId, payload] = mockNotify.mock.calls[0];
    expect(String(residentId)).toBe(RESIDENT);
    expect(payload.eventType).toBe("residency_application_reviewed");
    expect(payload.title).toBe("Arizangiz tasdiqlandi");
    expect(payload.link).toBe("/residency/arizalar");
  });

  test("rad etilganda ham ketadi, sarlavha BOSHQA", async () => {
    await review({ status: "rad_etilgan" });

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify.mock.calls[0][1].title).toBe("Arizangiz rad etildi");
  });

  test("🔴 oraliq qadamda xabar KETMAYDI", async () => {
    await review({ status: "korib_chiqilmoqda" });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  test("xodim izohi bo'lsa matnga qo'shiladi", async () => {
    await review({ status: "rad_etilgan", comment: "Hujjat yetarli emas" });
    expect(mockNotify.mock.calls[0][1].body).toBe(
      "Akademik ta'til — Hujjat yetarli emas",
    );
  });

  test("izohsiz qaror ham to'g'ri matn beradi", async () => {
    await review({ status: "tasdiqlangan" });
    expect(mockNotify.mock.calls[0][1].body).toBe("Akademik ta'til");
  });

  test("sababsiz eski yozuvda ham matn bo'sh qolmaydi", async () => {
    await review({ status: "tasdiqlangan" }, { reason: undefined });
    expect(mockNotify.mock.calls[0][1].body).toBe("Ariza");
  });

  test("doira rad etsa qaror ham, xabar ham YO'Q", async () => {
    mockScope.mockResolvedValue({ filter: {}, denied: true });
    mockFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ resident: RESIDENT }),
    });
    const res = resFor();
    const next = jest.fn();
    await C.reviewApplication(
      { params: { id: APP_ID }, body: { status: "tasdiqlangan" }, user: { _id: "u1" } },
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
