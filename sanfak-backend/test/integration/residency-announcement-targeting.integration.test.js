"use strict";

jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const mongoose = require("mongoose");

const { handleError } = require("#shared/error");
const { dispatch } = require("#system/notification/notificationDispatcher");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Announcement = require("#modules/4.05-residency/residencyAnnouncement/residencyAnnouncement.model");
const AnnouncementRead = require("#modules/4.05-residency/residencyAnnouncement/residencyAnnouncementRead.model");
const service = require("#modules/4.05-residency/residencyAnnouncement/residencyAnnouncement.service");
const announcementRoutes = require("#modules/4.05-residency/residencyAnnouncement/residencyAnnouncement.routes");

const app = express();
app.use(bodyParser.json());
app.use("/api/residency-announcements", announcementRoutes);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => handleError(err, res));

const ROOT = "/api/residency-announcements";

const ROLE_DEFS = {
  magistratura_bolim: {
    scopeLevel: "global",
    actions: ["create", "read", "readAll", "update", "delete"],
  },
  rezident: { scopeLevel: "self", actions: ["readAll"] },
  magistrant: { scopeLevel: "self", actions: ["readAll"] },
  klinik_ustoz: { scopeLevel: "self", actions: ["readAll"] },
};

const ensureRole = async (title) => {
  const def = ROLE_DEFS[title];
  const existing = await RoleModel.findOne({ title });
  if (existing) return existing;
  return RoleModel.create({
    title,
    desc: `${title} (test)`,
    permissions: [{ section: "residencyAnnouncement", actionKeys: def.actions }],
    scopeLevel: def.scopeLevel,
    active: true,
  });
};

const createUser = async (title) => {
  const role = await ensureRole(title);
  const user = await UserModel.create({
    firstName: "Test",
    lastName: title,
    role: role._id,
    active: true,
  });
  const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
  return { user, role, token };
};

const createResident = async (roleTitle, { program, courseNumber, specialty }) => {
  const actor = await createUser(roleTitle);
  const resident = await Resident.create({
    user: actor.user._id,
    program,
    fullName: `Test ${roleTitle} ${courseNumber}`,
    courseNumber,
    specialty: specialty ?? null,
  });
  return { ...actor, resident };
};

const makeAnnouncement = (over = {}) =>
  Announcement.create({
    title: "Test e'lon",
    content: "Matn",
    audience: "umumiy",
    ...over,
  });

const titlesVisibleTo = async (token) => {
  const res = await request(app).get(ROOT).set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.map((a) => a.title).sort();
};

const KARDIO = new mongoose.Types.ObjectId();
const NEVRO = new mongoose.Types.ObjectId();

let xodim;
let kurs1Kardio;
let kurs2Kardio;
let kurs1Nevro;
let magistrant1;
let ustoz;

beforeEach(async () => {
  dispatch.mockClear();
  xodim = await createUser("magistratura_bolim");
  ustoz = await createUser("klinik_ustoz");
  kurs1Kardio = await createResident("rezident", {
    program: "ordinatura",
    courseNumber: 1,
    specialty: KARDIO,
  });
  kurs2Kardio = await createResident("rezident", {
    program: "ordinatura",
    courseNumber: 2,
    specialty: KARDIO,
  });
  kurs1Nevro = await createResident("rezident", {
    program: "ordinatura",
    courseNumber: 1,
    specialty: NEVRO,
  });
  magistrant1 = await createResident("magistrant", {
    program: "magistratura",
    courseNumber: 1,
    specialty: KARDIO,
  });
});

async function waitUntil(fn, { timeoutMs = 2000, stepMs = 5 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (!fn()) {
    if (Date.now() > deadline) {
      throw new Error(`waitUntil: shart ${timeoutMs}ms ichida bajarilmadi`);
    }
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

describe("Yo'naltirish — orqaga moslik", () => {
  it("targetsiz e'lonni HAMMA ko'radi (avvalgi xulq o'zgarmagan)", async () => {
    await makeAnnouncement({ title: "Targetsiz" });

    for (const actor of [xodim, kurs1Kardio, kurs2Kardio, magistrant1, ustoz]) {
      expect(await titlesVisibleTo(actor.token)).toContain("Targetsiz");
    }
  });

  it("target maydonlari YO'Q eski yozuv ham hammaga ko'rinadi", async () => {
    await Announcement.collection.insertOne({
      title: "Eski yozuv",
      content: "Matn",
      audience: "umumiy",
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(await titlesVisibleTo(kurs2Kardio.token)).toContain("Eski yozuv");
  });
});

describe("Yo'naltirish — kurs bo'yicha", () => {
  beforeEach(async () => {
    await makeAnnouncement({ title: "Faqat 1-kurs", targetCourses: [1] });
    await makeAnnouncement({ title: "1 va 2-kurs", targetCourses: [1, 2] });
  });

  it("1-kurs talabasi o'ziga tegishlilarni ko'radi", async () => {
    expect(await titlesVisibleTo(kurs1Kardio.token)).toEqual([
      "1 va 2-kurs",
      "Faqat 1-kurs",
    ]);
  });

  it("2-kurs talabasi 1-kurs e'lonini KO'RMAYDI", async () => {
    expect(await titlesVisibleTo(kurs2Kardio.token)).toEqual(["1 va 2-kurs"]);
  });

  it("bo'lim xodimiga target filtri qo'llanmaydi — hammasini ko'radi", async () => {
    expect(await titlesVisibleTo(xodim.token)).toEqual([
      "1 va 2-kurs",
      "Faqat 1-kurs",
    ]);
  });

  it("ustozga ham qo'llanmaydi (kursi yo'q, lekin nazorat qiladi)", async () => {
    expect(await titlesVisibleTo(ustoz.token)).toEqual([
      "1 va 2-kurs",
      "Faqat 1-kurs",
    ]);
  });
});

describe("Yo'naltirish — mutaxassislik bo'yicha", () => {
  beforeEach(async () => {
    await makeAnnouncement({ title: "Kardiologiya", targetSpecialties: [KARDIO] });
  });

  it("mos mutaxassislik ko'radi", async () => {
    expect(await titlesVisibleTo(kurs1Kardio.token)).toContain("Kardiologiya");
  });

  it("boshqa mutaxassislik KO'RMAYDI", async () => {
    expect(await titlesVisibleTo(kurs1Nevro.token)).not.toContain("Kardiologiya");
  });
});

describe("Yo'naltirish — o'lchamlar ORASIDA AND", () => {
  beforeEach(async () => {
    await makeAnnouncement({
      title: "1-kurs Kardiologiya",
      targetCourses: [1],
      targetSpecialties: [KARDIO],
    });
  });

  it("ikkala shartga mos talaba ko'radi", async () => {
    expect(await titlesVisibleTo(kurs1Kardio.token)).toContain("1-kurs Kardiologiya");
  });

  it("kursi mos, mutaxassisligi mos EMAS — ko'rmaydi", async () => {
    expect(await titlesVisibleTo(kurs1Nevro.token)).not.toContain(
      "1-kurs Kardiologiya",
    );
  });

  it("mutaxassisligi mos, kursi mos EMAS — ko'rmaydi", async () => {
    expect(await titlesVisibleTo(kurs2Kardio.token)).not.toContain(
      "1-kurs Kardiologiya",
    );
  });
});

describe("Yo'naltirish — auditoriya bilan birga", () => {
  it("auditoriya VA target ikkalasi ham qo'llanadi", async () => {
    await makeAnnouncement({
      title: "Ordinatura 1-kurs",
      audience: "ordinatura",
      targetCourses: [1],
    });

    expect(await titlesVisibleTo(kurs1Kardio.token)).toContain("Ordinatura 1-kurs");
    expect(await titlesVisibleTo(kurs2Kardio.token)).not.toContain("Ordinatura 1-kurs");
    expect(await titlesVisibleTo(magistrant1.token)).not.toContain("Ordinatura 1-kurs");
  });
});

describe("Yo'naltirish — kontingent yozuvi yo'q talaba", () => {
  it("faqat targetsiz e'lonlarni ko'radi", async () => {
    const yolgiz = await createUser("rezident");
    await makeAnnouncement({ title: "Targetsiz" });
    await makeAnnouncement({ title: "1-kurs", targetCourses: [1] });

    expect(await titlesVisibleTo(yolgiz.token)).toEqual(["Targetsiz"]);
  });
});

describe("Yaratish — target maydonlari saqlanadi", () => {
  it("POST target bilan qabul qiladi", async () => {
    const res = await request(app)
      .post(ROOT)
      .set("Authorization", `Bearer ${xodim.token}`)
      .send({
        title: "Yangi",
        content: "Matn",
        audience: "ordinatura",
        targetCourses: [1, 2],
        targetSpecialties: [KARDIO.toString()],
      });

    expect(res.status).toBe(201);
    const doc = await Announcement.findById(res.body._id);
    expect(doc.targetCourses).toEqual([1, 2]);
    expect(doc.targetSpecialties.map(String)).toEqual([KARDIO.toString()]);
  });

  it("yaroqsiz kurs raqamini RAD etadi", async () => {
    const res = await request(app)
      .post(ROOT)
      .set("Authorization", `Bearer ${xodim.token}`)
      .send({ title: "X", content: "Y", targetCourses: [0] });

    expect(res.status).toBe(400);
  });
});

describe("Bildirishnoma — kimga yuboriladi", () => {
  it("targetsiz `umumiy` e'lon — barcha bog'langan talabalarga", async () => {
    const doc = await makeAnnouncement({ audience: "umumiy" });
    const ids = await service.findNotifyTargets(doc);

    expect(ids.sort()).toEqual(
      [kurs1Kardio, kurs2Kardio, kurs1Nevro, magistrant1]
        .map((a) => a.user._id.toString())
        .sort(),
    );
  });

  it("auditoriya bo'yicha cheklanadi", async () => {
    const doc = await makeAnnouncement({ audience: "magistratura" });
    expect(await service.findNotifyTargets(doc)).toEqual([
      magistrant1.user._id.toString(),
    ]);
  });

  it("kurs + mutaxassislik targeti bo'yicha cheklanadi", async () => {
    const doc = await makeAnnouncement({
      targetCourses: [1],
      targetSpecialties: [KARDIO],
    });
    expect((await service.findNotifyTargets(doc)).sort()).toEqual(
      [kurs1Kardio, magistrant1].map((a) => a.user._id.toString()).sort(),
    );
  });

  it("`kafedra_mudirlari` auditoriyasida talabaga YUBORILMAYDI", async () => {
    const doc = await makeAnnouncement({ audience: "kafedra_mudirlari" });
    expect(await service.findNotifyTargets(doc)).toEqual([]);
  });

  it("OneID bog'lanmagan rezident (user yo'q) chetlab o'tiladi", async () => {
    await Resident.create({
      program: "ordinatura",
      fullName: "Bog'lanmagan",
      courseNumber: 1,
      user: null,
    });
    const doc = await makeAnnouncement({ audience: "ordinatura" });
    const ids = await service.findNotifyTargets(doc);

    expect(ids).toHaveLength(3);
    expect(ids).not.toContain(null);
    expect(ids).not.toContain("null");
  });
});

describe("Bildirishnoma — dispatch chaqirilishi", () => {
  it("har qabul qiluvchi uchun bir marta, to'g'ri shakl bilan", async () => {
    const doc = await makeAnnouncement({
      title: "Attestatsiya boshlandi",
      audience: "magistratura",
    });

    const sent = await service.notifyAudience(doc);

    expect(sent).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      userId: magistrant1.user._id.toString(),
      eventType: "residency_announcement_published",
      title: "Yangi e'lon",
      body: "Attestatsiya boshlandi",
      link: `/residency/elonlar?id=${doc._id}`,
      metadata: { announcementId: String(doc._id) },
    });
  });

  it("bitta qabul qiluvchi yiqilsa qolganlari yuboriladi", async () => {
    dispatch.mockRejectedValueOnce(new Error("tarmoq xatosi"));
    const doc = await makeAnnouncement({ audience: "umumiy" });

    const sent = await service.notifyAudience(doc);

    expect(dispatch).toHaveBeenCalledTimes(4);
    expect(sent).toBe(3);
  });

  it("`POST /` javobi bildirishnomani KUTMAYDI (fon rejimi)", async () => {
    const res = await request(app)
      .post(ROOT)
      .set("Authorization", `Bearer ${xodim.token}`)
      .send({ title: "Fon", content: "Matn", audience: "umumiy" });

    expect(res.status).toBe(201);
    expect(dispatch).not.toHaveBeenCalled();

    await waitUntil(() => dispatch.mock.calls.length > 0);
    expect(dispatch).toHaveBeenCalled();
  });
});

const markRead = (id, token) =>
  request(app).put(`${ROOT}/${id}/read`).set('Authorization', `Bearer ${token}`);

const readStats = (id, token) =>
  request(app).get(`${ROOT}/${id}/read-stats`).set('Authorization', `Bearer ${token}`);

describe("O'qilgan deb belgilash", () => {
  it('belgilaydi va idempotent — ikkinchi marta dublikat yozmaydi', async () => {
    const ann = await makeAnnouncement();

    const first = await markRead(ann._id, kurs1Kardio.token);
    expect(first.status).toBe(200);
    expect(first.body.message).toBe('marked as read');

    const second = await markRead(ann._id, kurs1Kardio.token);
    expect(second.status).toBe(200);
    expect(second.body.message).toBe('already read');

    const rows = await AnnouncementRead.find({ announcement: ann._id });
    expect(rows).toHaveLength(1);
    expect(String(rows[0].user)).toBe(kurs1Kardio.user._id.toString());
    expect(rows[0].readAt).toBeInstanceOf(Date);
  });

  it("KO'RINMAYDIGAN e'lonni belgilab bo'lmaydi → 404", async () => {
    const ann = await makeAnnouncement({ title: '2-kurs', targetCourses: [2] });

    const res = await markRead(ann._id, kurs1Kardio.token);

    expect(res.status).toBe(404);
    expect(await AnnouncementRead.countDocuments({ announcement: ann._id })).toBe(0);
  });

  it("boshqa auditoriyaning e'lonini belgilab bo'lmaydi → 404", async () => {
    const ann = await makeAnnouncement({ audience: 'magistratura' });
    expect((await markRead(ann._id, kurs1Kardio.token)).status).toBe(404);
  });
});

describe("Ro'yxat javobi — readBy oshkor qilinmaydi", () => {
  it("`readBy` olib tashlanadi, `isRead` bayrogi qo‘yiladi", async () => {
    const ann = await makeAnnouncement();
    await markRead(ann._id, kurs1Kardio.token);

    const res = await request(app)
      .get(ROOT)
      .set('Authorization', `Bearer ${kurs1Kardio.token}`);
    const row = res.body.find((a) => a._id === String(ann._id));

    expect(row.readBy).toBeUndefined();
    expect(row.isRead).toBe(true);
  });

  it("o'qimagan foydalanuvchida `isRead: false`", async () => {
    const ann = await makeAnnouncement();
    await markRead(ann._id, kurs1Kardio.token);

    const res = await request(app)
      .get(ROOT)
      .set('Authorization', `Bearer ${kurs2Kardio.token}`);
    const row = res.body.find((a) => a._id === String(ann._id));

    expect(row.isRead).toBe(false);
    expect(row.readBy).toBeUndefined();
  });

  it('`paginate` javobida ham bir xil', async () => {
    const ann = await makeAnnouncement();
    await markRead(ann._id, kurs1Kardio.token);

    const res = await request(app)
      .get(`${ROOT}/paginate?page=1&limit=10`)
      .set('Authorization', `Bearer ${kurs1Kardio.token}`);
    const row = res.body.docs.find((a) => a._id === String(ann._id));

    expect(row.readBy).toBeUndefined();
    expect(row.isRead).toBe(true);
  });
});

describe("Hisobot — kim o‘qidi / kim o‘qimadi", () => {
  it("maxraj = bildirishnoma qabul qiluvchilari, o‘qiganlar ajratiladi", async () => {
    const ann = await makeAnnouncement({ audience: 'umumiy' });
    await markRead(ann._id, kurs1Kardio.token);
    await markRead(ann._id, magistrant1.token);

    const res = await readStats(ann._id, xodim.token);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.readCount).toBe(2);
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.percent).toBe(50);
    expect(res.body.read.map((r) => r.user).sort()).toEqual(
      [kurs1Kardio, magistrant1].map((a) => a.user._id.toString()).sort(),
    );
    expect(res.body.unread.map((r) => r.user).sort()).toEqual(
      [kurs2Kardio, kurs1Nevro].map((a) => a.user._id.toString()).sort(),
    );
  });

  it("hisobot yo‘naltirish bo‘yicha toraytiriladi", async () => {
    const ann = await makeAnnouncement({ targetCourses: [2] });
    const res = await readStats(ann._id, xodim.token);

    expect(res.body.total).toBe(1);
    expect(res.body.unread.map((r) => r.user)).toEqual([
      kurs2Kardio.user._id.toString(),
    ]);
  });

  it("qabul qiluvchi bo‘lmasa foiz `null` (nolga bo‘linmaydi)", async () => {
    const ann = await makeAnnouncement({ audience: 'kafedra_mudirlari' });
    const res = await readStats(ann._id, xodim.token);

    expect(res.body.total).toBe(0);
    expect(res.body.percent).toBeNull();
  });

  it("qabul qiluvchi bo‘lmagan o‘quvchi (xodim) foizni buzmaydi", async () => {
    const ann = await makeAnnouncement({ audience: 'magistratura' });
    await markRead(ann._id, magistrant1.token);
    await markRead(ann._id, xodim.token);

    const res = await readStats(ann._id, xodim.token);

    expect(res.body.total).toBe(1);
    expect(res.body.readCount).toBe(1);
    expect(res.body.percent).toBe(100);
  });

  it('hisobot faqat xodimga — talaba 403 oladi', async () => {
    const ann = await makeAnnouncement();
    expect((await readStats(ann._id, kurs1Kardio.token)).status).toBe(403);
    expect((await readStats(ann._id, ustoz.token)).status).toBe(403);
  });

  it("mavjud bo'lmagan e'lon → 404", async () => {
    expect((await readStats('64b7f1c2a1b2c3d4e5f60718', xodim.token)).status).toBe(404);
  });
});

describe("O'qilganlik — alohida kolleksiya xulqi", () => {
  it("PARALLEL belgilash ham bitta yozuv qoldiradi (unique indeks)", async () => {
    const ann = await makeAnnouncement();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => markRead(ann._id, kurs1Kardio.token)),
    );

    results.forEach((r) => expect(r.status).toBe(200));
    expect(await AnnouncementRead.countDocuments({ announcement: ann._id })).toBe(1);
  });

  it("e'lon o'chirilganda o'qilganlik yozuvlari ham ketadi (kaskad)", async () => {
    const ann = await makeAnnouncement();
    await markRead(ann._id, kurs1Kardio.token);
    await markRead(ann._id, magistrant1.token);
    expect(await AnnouncementRead.countDocuments({ announcement: ann._id })).toBe(2);

    const res = await request(app)
      .delete(`${ROOT}/${ann._id}`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(200);
    expect(await AnnouncementRead.countDocuments({ announcement: ann._id })).toBe(0);
  });

  it("boshqa e'lonning yozuvlari `isRead` ga aralashmaydi", async () => {
    const a1 = await makeAnnouncement({ title: "Birinchi" });
    const a2 = await makeAnnouncement({ title: "Ikkinchi" });
    await markRead(a1._id, kurs1Kardio.token);

    const res = await request(app)
      .get(ROOT)
      .set("Authorization", `Bearer ${kurs1Kardio.token}`);

    const byTitle = Object.fromEntries(res.body.map((a) => [a.title, a.isRead]));
    expect(byTitle["Birinchi"]).toBe(true);
    expect(byTitle["Ikkinchi"]).toBe(false);
    expect(String(a2._id)).toBeTruthy();
  });

  it("javobda `readBy` maydoni umuman yo'q (model'dan olib tashlangan)", async () => {
    const ann = await makeAnnouncement();
    await markRead(ann._id, kurs1Kardio.token);

    const res = await request(app)
      .get(ROOT)
      .set("Authorization", `Bearer ${kurs1Kardio.token}`);
    const row = res.body.find((a) => a._id === String(ann._id));

    expect(row.readBy).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/readBy/);
  });
});
