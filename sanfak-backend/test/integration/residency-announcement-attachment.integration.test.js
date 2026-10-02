"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");

const FILES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "resann-it-"));

process.env.RESIDENCY_ANNOUNCEMENT_FILES_DIR = FILES_DIR;
process.env.RESIDENCY_ANNOUNCEMENT_MAX_FILE_MB = "1";
process.env.RESIDENCY_ANNOUNCEMENT_MAX_FILES = "3";
process.env.RESIDENCY_ANNOUNCEMENT_MAX_TOTAL_MB = "2";

// eslint-disable-next-line import/first
const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const { handleError } = require("#shared/error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
const Announcement = require("#modules/4.05-residency/residencyAnnouncement/residencyAnnouncement.model");
const announcementRoutes = require("#modules/4.05-residency/residencyAnnouncement/residencyAnnouncement.routes");

const app = express();
app.use(bodyParser.json());
app.use("/api/residency-announcements", announcementRoutes);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => handleError(err, res));

const ROLE_DEFS = {
  magistratura_bolim: {
    scopeLevel: "global",
    actions: ["create", "read", "readAll", "update", "delete"],
  },
  rezident: { scopeLevel: "self", actions: ["readAll"] },
  magistrant: { scopeLevel: "self", actions: ["readAll"] },
};

const createUser = async (title) => {
  const def = ROLE_DEFS[title];
  const role = await RoleModel.create({
    title,
    desc: `${title} (test)`,
    permissions: [{ section: "residencyAnnouncement", actionKeys: def.actions }],
    scopeLevel: def.scopeLevel,
    active: true,
  });
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

const pad = (head, size) =>
  Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, size - head.length), 0x20)]);

const PDF = pad([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], 512);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 256);
const EXE = pad([0x4d, 0x5a, 0x90, 0x00], 128);
const BIG_PDF = pad([0x25, 0x50, 0x44, 0x46], 1.4 * 1024 * 1024);
const PDF_800KB = pad([0x25, 0x50, 0x44, 0x46, 0x2d, 0x32], 800 * 1024);
const PDF_900KB = pad([0x25, 0x50, 0x44, 0x46, 0x2d, 0x33], 900 * 1024);
const PDF_700KB = pad([0x25, 0x50, 0x44, 0x46, 0x2d, 0x34], 700 * 1024);

const ROOT = "/api/residency-announcements";

let xodim;
let rezident;
let magistrant;

const makeAnnouncement = (audience = "umumiy") =>
  Announcement.create({
    title: "Attestatsiya jadvali",
    content: "Batafsil ma'lumot biriktirilgan faylda.",
    audience,
    createdBy: xodim.user._id,
    createdByName: "magistratura_bolim Test",
  });

const listBlobs = async (dir = FILES_DIR) => {
  const out = [];
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".tmp") continue;
      out.push(...(await listBlobs(full)));
    } else {
      out.push(full);
    }
  }
  return out;
};

const listTmp = async () => {
  const tmp = path.join(FILES_DIR, ".tmp");
  try {
    return await fsp.readdir(tmp);
  } catch {
    return [];
  }
};

beforeEach(async () => {
  xodim = await createUser("magistratura_bolim");
  rezident = await createUser("rezident");
  magistrant = await createUser("magistrant");
  await fsp.rm(FILES_DIR, { recursive: true, force: true });
  await fsp.mkdir(FILES_DIR, { recursive: true });
});

afterAll(async () => {
  await fsp.rm(FILES_DIR, { recursive: true, force: true });
});

describe("POST /:id/attachments — happy path", () => {
  it("bir nechta faylni biriktiradi va diskka yozadi", async () => {
    const ann = await makeAnnouncement();

    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf")
      .attach("files", PNG, "sxema.png");

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(2);

    const [first, second] = res.body.created;
    expect(first.name).toBe("buyruq.pdf");
    expect(first.mimeType).toBe("application/pdf");
    expect(first.type).toBe("pdf");
    expect(first.bytes).toBe(PDF.length);
    expect(first.size).toMatch(/KB|B|MB/);
    expect(first.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(first.uploadedByName).toBe("magistratura_bolim Test");
    expect(second.mimeType).toBe("image/png");

    expect(await listBlobs()).toHaveLength(2);
    expect(await listTmp()).toHaveLength(0);

    const fresh = await Announcement.findById(ann._id);
    expect(fresh.attachments).toHaveLength(2);
  });

  it("javobda `storageKey` OSHKOR QILINMAYDI", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf");

    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/storageKey/);
    expect(res.body.created[0].storageKey).toBeUndefined();

    const fresh = await Announcement.findById(ann._id);
    expect(fresh.attachments[0].storageKey).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]+\.pdf$/);
  });

  it("fayl nomi sanitizatsiya qilinadi (papka qismi olib tashlanadi)", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "../../../etc/passwd.pdf");

    expect(res.status).toBe(201);
    expect(res.body.created[0].name).toBe("passwd.pdf");
  });

  it("mavjud ro'yxat (GET /) biriktirmalar bilan qaytadi", async () => {
    const ann = await makeAnnouncement();
    await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf");

    const res = await request(app)
      .get(ROOT)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].attachments).toHaveLength(1);
    expect(res.body[0].attachments[0].storageKey).toBeUndefined();
    expect(res.body[0].title).toBe("Attestatsiya jadvali");
    expect(res.body[0].audience).toBe("umumiy");
  });
});

describe("POST /:id/attachments — rad etish sabablari", () => {
  it("hajmi oshgan fayl → 400 ATTACHMENT_TOO_LARGE", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", BIG_PDF, "katta.pdf");

    expect(res.status).toBe(400);
    expect(res.body.detail).toBe("ATTACHMENT_TOO_LARGE");
    expect(await listBlobs()).toHaveLength(0);
    expect(await listTmp()).toHaveLength(0);
  });

  it("ruxsat etilmagan tur (.exe) → 400 ATTACHMENT_TYPE_NOT_ALLOWED", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", EXE, "virus.exe");

    expect(res.status).toBe(400);
    expect(res.body.detail).toBe("ATTACHMENT_TYPE_NOT_ALLOWED");
    expect(await listTmp()).toHaveLength(0);
  });

  it("SOXTA kengaytma (exe → .pdf) → 400 ATTACHMENT_TYPE_MISMATCH", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", EXE, { filename: "hisobot.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(400);
    expect(res.body.detail).toBe("ATTACHMENT_TYPE_MISMATCH");
    expect(await listBlobs()).toHaveLength(0);
    expect(await listTmp()).toHaveLength(0);
  });

  it("fayl soni chegarasi → 400 ATTACHMENT_TOO_MANY", async () => {
    const ann = await makeAnnouncement();
    const req = request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`);
    for (let i = 0; i < 4; i += 1) req.attach("files", PDF, `fayl-${i}.pdf`);
    const res = await req;

    expect(res.status).toBe(400);
    expect(res.body.detail).toBe("ATTACHMENT_TOO_MANY");
    expect(await listTmp()).toHaveLength(0);
  });

  it("umumiy hajm chegarasi → 400 ATTACHMENT_QUOTA_EXCEEDED", async () => {
    const ann = await makeAnnouncement();

    const first = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF_800KB, "birinchi.pdf")
      .attach("files", PDF_900KB, "ikkinchi.pdf");
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF_700KB, "uchinchi.pdf");

    expect(second.status).toBe(400);
    expect(second.body.detail).toBe("ATTACHMENT_QUOTA_EXCEEDED");
    expect(await listBlobs()).toHaveLength(2);
    expect(await listTmp()).toHaveLength(0);
  });

  it("bir xil fayl ikki marta → 400 ATTACHMENT_DUPLICATE", async () => {
    const ann = await makeAnnouncement();
    await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf");

    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq-nusxa.pdf");

    expect(res.status).toBe(400);
    expect(res.body.detail).toBe("ATTACHMENT_DUPLICATE");
    expect(await listBlobs()).toHaveLength(1);
  });

  it("batch ATOMIK — bitta fayl yaroqsiz bo'lsa hech biri biriktirilmaydi", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "yaxshi.pdf")
      .attach("files", EXE, "yomon.exe");

    expect(res.status).toBe(400);
    const fresh = await Announcement.findById(ann._id);
    expect(fresh.attachments).toHaveLength(0);
    expect(await listBlobs()).toHaveLength(0);
    expect(await listTmp()).toHaveLength(0);
  });

  it("faylsiz so'rov → 400", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(400);
    expect(res.body.detail).toBe("ATTACHMENT_FILE_REQUIRED");
  });

  it("mavjud bo'lmagan e'lon → 404", async () => {
    const res = await request(app)
      .post(`${ROOT}/64b7f1c2a1b2c3d4e5f60718/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf");

    expect(res.status).toBe(404);
    expect(await listBlobs()).toHaveLength(0);
  });
});

describe("Ruxsatlar", () => {
  it("faqat o'qish huquqi bor rol fayl biriktira OLMAYDI → 403", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${rezident.token}`)
      .attach("files", PDF, "buyruq.pdf");

    expect(res.status).toBe(403);
    expect(await listTmp()).toHaveLength(0);
    expect(await listBlobs()).toHaveLength(0);
  });

  it("faqat o'qish huquqi bor rol faylni o'chira OLMAYDI → 403", async () => {
    const ann = await makeAnnouncement();
    const up = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf");

    const res = await request(app)
      .delete(`${ROOT}/${ann._id}/attachments/${up.body.created[0]._id}`)
      .set("Authorization", `Bearer ${rezident.token}`);

    expect(res.status).toBe(403);
    expect(await listBlobs()).toHaveLength(1);
  });

  it("tokensiz so'rov → 401", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app).post(`${ROOT}/${ann._id}/attachments`);
    expect(res.status).toBe(401);
  });
});

describe("GET /:id/attachments/:attachmentId/download", () => {
  const upload = async (audience) => {
    const ann = await makeAnnouncement(audience);
    const up = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf");
    return { ann, attachmentId: up.body.created[0]._id };
  };

  it("faylni qaytaradi — HAR DOIM `attachment`, hech qachon inline", async () => {
    const { ann, attachmentId } = await upload("umumiy");

    const res = await request(app)
      .get(`${ROOT}/${ann._id}/attachments/${attachmentId}/download`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .buffer()
      .parse((r, cb) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(res.headers["content-disposition"]).toContain('filename="buyruq.pdf"');
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["content-length"]).toBe(String(PDF.length));
    expect(Buffer.compare(res.body, PDF)).toBe(0);
  });

  it("SVG ham inline emas, `octet-stream` bilan beriladi", async () => {
    const ann = await makeAnnouncement();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>');
    const up = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", svg, "logo.svg");
    expect(up.status).toBe(201);

    const res = await request(app)
      .get(`${ROOT}/${ann._id}/attachments/${up.body.created[0]._id}/download`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-disposition"]).toMatch(/^attachment;/);
  });

  it("kirill/probelli nom RFC 5987 bilan kodlanadi", async () => {
    const ann = await makeAnnouncement();
    const up = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "Buyruq № 12.pdf");

    const res = await request(app)
      .get(`${ROOT}/${ann._id}/attachments/${up.body.created[0]._id}/download`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.headers["content-disposition"]).toContain("filename*=UTF-8''");
    expect(res.headers["content-disposition"]).toContain(
      encodeURIComponent("Buyruq № 12.pdf"),
    );
  });

  it("AUDITORIYASIGA kirmagan rol yuklab OLA OLMAYDI → 404", async () => {
    const { ann, attachmentId } = await upload("magistratura");

    const res = await request(app)
      .get(`${ROOT}/${ann._id}/attachments/${attachmentId}/download`)
      .set("Authorization", `Bearer ${rezident.token}`);

    expect(res.status).toBe(404);
  });

  it("auditoriyasiga kiruvchi rol yuklab OLADI → 200", async () => {
    const { ann, attachmentId } = await upload("magistratura");

    const res = await request(app)
      .get(`${ROOT}/${ann._id}/attachments/${attachmentId}/download`)
      .set("Authorization", `Bearer ${magistrant.token}`);

    expect(res.status).toBe(200);
  });

  it("`umumiy` e'lonni hamma yuklab oladi", async () => {
    const { ann, attachmentId } = await upload("umumiy");
    for (const actor of [rezident, magistrant]) {
      const res = await request(app)
        .get(`${ROOT}/${ann._id}/attachments/${attachmentId}/download`)
        .set("Authorization", `Bearer ${actor.token}`);
      expect(res.status).toBe(200);
    }
  });

  it("mavjud bo'lmagan fayl → 404", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .get(`${ROOT}/${ann._id}/attachments/64b7f1c2a1b2c3d4e5f60718/download`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(404);
    expect(res.body.detail).toBe("ATTACHMENT_NOT_FOUND");
  });

  it("yaroqsiz ObjectId → 400 (CastError 500 emas)", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .get(`${ROOT}/${ann._id}/attachments/not-an-id/download`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(400);
  });
});

describe("DELETE /:id/attachments/:attachmentId", () => {
  it("faylni bazadan ham, diskdan ham o'chiradi", async () => {
    const ann = await makeAnnouncement();
    const up = await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf")
      .attach("files", PNG, "sxema.png");

    const res = await request(app)
      .delete(`${ROOT}/${ann._id}/attachments/${up.body.created[0]._id}`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(200);
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].name).toBe("sxema.png");

    expect(await listBlobs()).toHaveLength(1);

    const fresh = await Announcement.findById(ann._id);
    expect(fresh.attachments).toHaveLength(1);
  });

  it("mavjud bo'lmagan fayl → 404 ATTACHMENT_NOT_FOUND", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .delete(`${ROOT}/${ann._id}/attachments/64b7f1c2a1b2c3d4e5f60718`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(404);
    expect(res.body.detail).toBe("ATTACHMENT_NOT_FOUND");
  });
});

describe("E'lon o'chirilganda kaskad", () => {
  it("e'lon HARD-delete bo'ladi va barcha blob'lar o'chadi", async () => {
    const ann = await makeAnnouncement();
    await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf")
      .attach("files", PNG, "sxema.png");

    expect(await listBlobs()).toHaveLength(2);

    const res = await request(app)
      .delete(`${ROOT}/${ann._id}`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(200);

    expect(await listBlobs()).toHaveLength(0);

    expect(await Announcement.findById(ann._id)).toBeNull();
    const withDeleted = await Announcement.findWithDeleted({ _id: ann._id });
    expect(withDeleted).toHaveLength(0);
  });

  it("biriktirmasiz e'lon ham muammosiz o'chadi", async () => {
    const ann = await makeAnnouncement();
    const res = await request(app)
      .delete(`${ROOT}/${ann._id}`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(200);
    expect(await Announcement.findById(ann._id)).toBeNull();
  });

  it("mavjud bo'lmagan e'lon → 404", async () => {
    const res = await request(app)
      .delete(`${ROOT}/64b7f1c2a1b2c3d4e5f60718`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(404);
  });
});

describe("Mass-assignment himoyasi", () => {
  it("`PUT /:id` orqali attachments o'zgartirib bo'lmaydi", async () => {
    const ann = await makeAnnouncement();
    await request(app)
      .post(`${ROOT}/${ann._id}/attachments`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .attach("files", PDF, "buyruq.pdf");

    const res = await request(app)
      .put(`${ROOT}/${ann._id}`)
      .set("Authorization", `Bearer ${xodim.token}`)
      .send({ title: "Yangilangan", attachments: [] });

    expect(res.status).toBe(400);

    const fresh = await Announcement.findById(ann._id);
    expect(fresh.attachments).toHaveLength(1);
  });
});
