"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const http     = require("http");

const BASE_URL    = "http://localhost:4000/api";
const ADMIN_PIN   = "00000000000001";
const EXECUTOR_ID = "6a2fdf07e2aeb6133331e25a";
const POLL_MS     = 300;
const TIMEOUT_MS  = 30000;

const C = {
  reset:  "\x1b[0m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  bold:   "\x1b[1m",
};
const ok   = (s) => `${C.green}✓${C.reset} ${s}`;
const warn = (s) => `${C.yellow}⚠${C.reset} ${s}`;
const err  = (s) => `${C.red}✗${C.reset} ${s}`;
const info = (s) => `${C.cyan}→${C.reset} ${s}`;

const request = (method, path, body, token) =>
  new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "localhost",
      port:     4000,
      path:     `/api${path}`,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });

async function main() {
  console.log(`\n${C.bold}=== Task:TgQueue — E2E Test ===${C.reset}\n`);

  process.stdout.write(info("1. Login (super_admin) ... "));
  const loginRes = await request("POST", "/auth", { oneIdPin: ADMIN_PIN });
  if (loginRes.status !== 200 || !loginRes.body.accessToken) {
    console.log(err(`Login muvaffaqiyatsiz: ${loginRes.status}`));
    console.log(loginRes.body);
    process.exit(1);
  }
  const token = loginRes.body.accessToken;
  console.log(ok("token olindi"));

  process.stdout.write(info("2. Topshiriq yaratilmoqda ... "));
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const taskRes = await request(
    "POST",
    "/tasks",
    {
      title:     `[TgQueue Test] ${new Date().toLocaleTimeString("uz-UZ")}`,
      description: "Avtomatik E2E test — MongoDB Telegram Queue",
      deadline,
      priority:  "medium",
      assignees: [EXECUTOR_ID],
    },
    token,
  );
  if (taskRes.status !== 201 && taskRes.status !== 200) {
    console.log(err(`Task yaratilmadi: ${taskRes.status}`));
    console.log(JSON.stringify(taskRes.body, null, 2));
    process.exit(1);
  }
  const tasks = Array.isArray(taskRes.body) ? taskRes.body : [taskRes.body];
  const taskId = tasks[0]?._id || tasks[0]?.id || "?";
  console.log(ok(`task yaratildi (${taskId})`));

  console.log(info("3. MongoDB queue kuzatilmoqda ..."));
  await mongoose.connect(process.env.MONGO_HOST);

  const TelegramQueue = mongoose.model(
    "taskTelegramQueue",
    new mongoose.Schema(
      {
        chatId:  String,
        message: String,
        status:  String,
        retries: Number,
        retryAt: Date,
        error:   String,
        sentAt:  Date,
      },
      { timestamps: true, versionKey: false },
    ),
    "tasktelegramqueues",
  );

  const since    = new Date(Date.now() - 5000);
  const deadline2 = Date.now() + TIMEOUT_MS;
  let   doc     = null;
  let   lastStatus = null;

  while (Date.now() < deadline2) {
    doc = await TelegramQueue.findOne({
      createdAt: { $gte: since },
      chatId:    { $exists: true },
    }).sort({ createdAt: -1 }).lean();

    if (doc) {
      if (doc.status !== lastStatus) {
        lastStatus = doc.status;
        const icon = doc.status === "sent" ? ok : doc.status === "dead" ? err : warn;
        console.log(`   ${icon(doc.status.padEnd(12))} chatId=${doc.chatId}` +
          (doc.error ? `  xato: ${doc.error}` : "") +
          (doc.sentAt ? `  sentAt=${new Date(doc.sentAt).toLocaleTimeString("uz-UZ")}` : ""));
      }
      if (doc.status === "sent" || doc.status === "dead") break;
    } else if (lastStatus === null) {
      process.stdout.write(".");
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  console.log("");

  await mongoose.disconnect();

  if (!doc) {
    console.log(err("Queue hujjati topilmadi — sendTaskAssigned chaqirilmadimi?"));
    process.exit(1);
  }

  if (doc.status === "sent") {
    console.log(`\n${C.green}${C.bold}✓ E2E TEST O'TDI${C.reset}`);
    console.log(`  Queue:    pending → processing → sent`);
    console.log(`  ChatId:   ${doc.chatId}`);
    console.log(`  SentAt:   ${new Date(doc.sentAt).toLocaleTimeString("uz-UZ")}`);
    console.log(`  Message:  ${doc.message.replace(/\n/g, " ").slice(0, 80)}...\n`);
  } else if (doc.status === "dead") {
    console.log(`\n${C.red}${C.bold}✗ DEAD-LETTER${C.reset} — ${doc.retries} urinish bajarildi`);
    console.log(`  Xato: ${doc.error}\n`);
    process.exit(1);
  } else {
    console.log(warn(`Timeout — oxirgi holat: ${doc.status} (${TIMEOUT_MS / 1000}s kutildi)`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(err(e.message));
  process.exit(1);
});
