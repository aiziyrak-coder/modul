"use strict";

const service = require("./residencyAnnouncement.service");
const C = require("./residencyAnnouncement.controller");
const router = require("./residencyAnnouncement.routes");
const { receiveFiles } = require("./residencyAnnouncement.upload");

const resOf = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("requireVisibleAnnouncement — qoida", () => {
  afterEach(() => jest.restoreAllMocks());

  it("e'lon ko'rinsa — next() chaqiriladi, javob yozilmaydi", async () => {
    jest.spyOn(service, "findVisible").mockResolvedValue({ _id: "a1" });
    const res = resOf();
    const next = jest.fn();

    await C.requireVisibleAnnouncement({ params: { id: "a1" }, user: {} }, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("e'lon ko'rinmasa — 404 va next() CHAQIRILMAYDI", async () => {
    jest.spyOn(service, "findVisible").mockResolvedValue(null);
    const res = resOf();
    const next = jest.fn();

    await C.requireVisibleAnnouncement({ params: { id: "begona" }, user: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("404 — 403 EMAS: javob kodi begona e'lonning mavjudligini oshkor qilmaydi", async () => {
    jest.spyOn(service, "findVisible").mockResolvedValue(null);
    const res = resOf();

    await C.requireVisibleAnnouncement({ params: { id: "yoq" }, user: {} }, res, jest.fn());

    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("qo'riq foydalanuvchining O'ZINI uzatadi (scope shundan quriladi)", async () => {
    const spy = jest.spyOn(service, "findVisible").mockResolvedValue({ _id: "a1" });
    const user = { _id: "u1", role: { title: "rezident" } };

    await C.requireVisibleAnnouncement({ params: { id: "a1" }, user }, resOf(), jest.fn());

    expect(spy).toHaveBeenCalledWith("a1", user);
  });

  it("xato yuz bersa fail-closed: next(err), handler ishlamaydi", async () => {
    jest.spyOn(service, "findVisible").mockRejectedValue(new Error("db down"));
    const res = resOf();
    const next = jest.fn();

    await C.requireVisibleAnnouncement({ params: { id: "a1" }, user: {} }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(res.status).not.toHaveBeenCalled();
  });
});

const chainOf = (path, method) => {
  for (const layer of router.stack) {
    if (!layer.route || layer.route.path !== path) continue;
    const handles = layer.route.stack
      .filter((h) => h.method === method)
      .map((h) => h.handle);
    if (handles.length) return handles;
  }
  return null;
};

const GUARDED = [
  ["/:id", "put"],
  ["/:id", "delete"],
  ["/:id/attachments", "post"],
  ["/:id/attachments/:attachmentId", "delete"],
  ["/:id/read-stats", "get"],
];

describe("requireVisibleAnnouncement — zanjirga ulanganmi", () => {
  it.each(GUARDED)("%s [%s] zanjirida qo'riq bor", (path, method) => {
    const chain = chainOf(path, method);
    expect(chain).not.toBeNull();
    expect(chain).toContain(C.requireVisibleAnnouncement);
  });

  it("biriktirma qo'shishda qo'riq multer'dan OLDIN turadi", () => {
    const chain = chainOf("/:id/attachments", "post");
    expect(chain.indexOf(C.requireVisibleAnnouncement)).toBeLessThan(
      chain.indexOf(receiveFiles),
    );
  });

  it("qulf o'zi ishlaydi — mavjud bo'lmagan route topilmaydi", () => {
    expect(chainOf("/:id/bunday-yol-yoq", "get")).toBeNull();
  });

  it("o'qish yo'llari o'z doirasini ALLAQACHON boshqa yo'l bilan oladi", () => {
    expect(chainOf("/:id/read", "put")).not.toContain(C.requireVisibleAnnouncement);
    expect(chainOf("/:id/attachments/:attachmentId/download", "get")).not.toContain(
      C.requireVisibleAnnouncement,
    );
  });
});
