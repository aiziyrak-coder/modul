jest.mock("./announcement.model");
jest.mock("./announcement.audience");
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn().mockResolvedValue([]),
  templates: { announcementNew: (title, mod) => `${title} [${mod}]` },
}));
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatchMany: jest.fn().mockResolvedValue({ total: 0, success: 0, failed: 0 }),
}));

const Announcement = require("./announcement.model");
const { resolveAnnouncementAudienceUserIds } = require("./announcement.audience");
const { notify } = require("#system/notification/notification.service");
const { dispatchMany } = require("#system/notification/notificationDispatcher");
const Controller = require("./announcement.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const AUTHOR_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("addAnnouncement — N-10 in-app dispatch", () => {
  test("auditoriyasi bor e'lon — dispatchMany to'g'ri userIds/eventType bilan chaqiriladi", async () => {
    const doc = {
      _id: "post1",
      title: "Kurs jadvali o'zgardi",
      body: "Batafsil ma'lumot ichkarida",
      module: "residency",
    };
    Announcement.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(doc) }));
    resolveAnnouncementAudienceUserIds.mockResolvedValue(["u1", "u2"]);

    const res = createRes();
    await Controller.addAnnouncement(
      { body: { title: doc.title, body: doc.body, module: doc.module }, user: { _id: AUTHOR_ID } },
      res,
      jest.fn(),
    );

    expect(notify).toHaveBeenCalledTimes(1);
    expect(dispatchMany).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ["u1", "u2"],
        eventType: "announcement_new",
        title: doc.title,
        body: doc.body,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("umumiy e'lon (auditoriya null) — dispatchMany chaqirilmaydi (fan-out yo'q)", async () => {
    const doc = { _id: "post2", title: "Umumiy e'lon", body: "B", module: "general" };
    Announcement.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(doc) }));
    resolveAnnouncementAudienceUserIds.mockResolvedValue(null);

    const res = createRes();
    await Controller.addAnnouncement(
      { body: { title: doc.title, body: doc.body, module: doc.module }, user: { _id: AUTHOR_ID } },
      res,
      jest.fn(),
    );

    expect(dispatchMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("resolveAnnouncementAudienceUserIds xato bersa ham javob 201 qaytadi (best-effort)", async () => {
    const doc = { _id: "post3", title: "T", body: "B", module: "general" };
    Announcement.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(doc) }));
    resolveAnnouncementAudienceUserIds.mockRejectedValue(new Error("DB xato"));

    const res = createRes();
    const next = jest.fn();
    await Controller.addAnnouncement(
      { body: { title: doc.title, body: doc.body, module: doc.module }, user: { _id: AUTHOR_ID } },
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
