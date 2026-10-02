"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const CHAT_ID  = "CHAT_ID";
const COUNT    = parseInt(process.argv[2], 10) || 30;
const POLL_MS  = 500;

const C = {
  reset:  "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m",
  red:    "\x1b[31m", cyan:  "\x1b[36m", bold:   "\x1b[1m",
  gray:   "\x1b[90m",
};
const g   = (s) => `${C.green}${s}${C.reset}`;
const y   = (s) => `${C.yellow}${s}${C.reset}`;
const r   = (s) => `${C.red}${s}${C.reset}`;
const dim = (s) => `${C.gray}${s}${C.reset}`;
const b   = (s) => `${C.bold}${s}${C.reset}`;

const bar = (filled, total, width = 30) => {
  const n = Math.round((filled / total) * width);
  return `[${"█".repeat(n)}${" ".repeat(width - n)}]`;
};

async function connect() {
  await mongoose.connect(process.env.MONGO_HOST);
}

function getModel() {
  if (mongoose.models.taskTelegramQueue) return mongoose.models.taskTelegramQueue;
  return mongoose.model(
    "taskTelegramQueue",
    new mongoose.Schema(
      {
        chatId:      String,
        message:     String,
        status:      { type: String, default: "pending" },
        retries:     { type: Number, default: 0 },
        retryAt:     { type: Date, default: null },
        processingAt:{ type: Date, default: null },
        sentAt:      { type: Date, default: null },
        error:       { type: String, default: null },
        metadata:    mongoose.Schema.Types.Mixed,
      },
      { timestamps: true, versionKey: false },
    ),
    "tasktelegramqueues",
  );
}

async function main() {
  const startedAt = Date.now();
  console.log(`\n${b("=== Task:TgQueue — Mass Load Test ===")} (${COUNT} xabar → chatId=${CHAT_ID})\n`);

  await connect();
  const Q = getModel();

  const cleaned = await Q.deleteMany({ "metadata.massTest": true, status: { $ne: "sent" } });
  if (cleaned.deletedCount) process.stdout.write(dim(`  eski test qoldig'i tozalandi: ${cleaned.deletedCount}\n`));

  const now = new Date();
  const docs = Array.from({ length: COUNT }, (_, i) => ({
    chatId:  CHAT_ID,
    message: `🧪 <b>Mass Load Test</b> [${i + 1}/${COUNT}]\n` +
             `Vaqt: <code>${now.toLocaleTimeString("uz-UZ")}</code>`,
    status:  "pending",
    metadata:{ massTest: true, seq: i + 1 },
  }));

  await Q.insertMany(docs);
  console.log(g(`✓ ${COUNT} xabar navbatga qo'shildi — poller ularni oladi...\n`));

  const ids = (await Q.find({ "metadata.massTest": true, createdAt: { $gte: now } })
    .select("_id").lean()).map((d) => d._id);

  let prevLine = 0;
  const clearLines = (n) => {
    for (let i = 0; i < n; i++) process.stdout.write("\x1b[1A\x1b[2K");
  };

  const TIMEOUT_MS = Math.max(COUNT * 3000, 120000);

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const all = await Q.find({ _id: { $in: ids } }).lean();

    const counts = { pending: 0, processing: 0, retry: 0, sent: 0, dead: 0 };
    let nextRetry = null;
    let totalRetries = 0;
    for (const d of all) {
      counts[d.status] = (counts[d.status] || 0) + 1;
      totalRetries += d.retries || 0;
      if (d.status === "retry" && d.retryAt) {
        const t = new Date(d.retryAt);
        if (!nextRetry || t < nextRetry) nextRetry = t;
      }
    }

    const done    = counts.sent + counts.dead;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    const rate    = done > 0 ? (done / ((Date.now() - startedAt) / 1000)).toFixed(2) : "0.00";
    const eta     = done > 0
      ? Math.ceil((COUNT - done) / (done / ((Date.now() - startedAt) / 1000)))
      : "?";

    const lines = [
      `${bar(done, COUNT)} ${g(`${done}/${COUNT}`)} yuborildi`,
      ``,
      `  ${g("sent")}:       ${String(counts.sent).padStart(4)}    ${y("retry")}:      ${String(counts.retry).padStart(4)}`,
      `  ${dim("processing")}: ${String(counts.processing).padStart(4)}    ${dim("pending")}:    ${String(counts.pending).padStart(4)}    ${r("dead")}: ${counts.dead}`,
      ``,
      `  429 urinishlar (jami): ${y(totalRetries)}`,
      nextRetry
        ? `  Keyingi retry:        ${y(new Date(nextRetry).toLocaleTimeString("uz-UZ"))}`
        : `  Keyingi retry:        ${dim("yo'q")}`,
      ``,
      `  Tezlik: ${g(rate + " msg/s")}   Vaqt: ${elapsed}s   ETA: ${eta === "?" ? dim("?") : g(eta + "s")}`,
    ];

    if (prevLine) clearLines(prevLine);
    lines.forEach((l) => console.log(l));
    prevLine = lines.length;

    if (done === COUNT) break;
    await new Promise((res) => setTimeout(res, POLL_MS));
  }

  const all = await Q.find({ _id: { $in: ids } }).lean();
  const sent = all.filter((d) => d.status === "sent").length;
  const dead = all.filter((d) => d.status === "dead").length;
  const remaining = all.filter((d) => !["sent","dead"].includes(d.status)).length;
  const totalRetries = all.reduce((s, d) => s + (d.retries || 0), 0);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`\n${b("═══════════════════════════════════")}`);
  if (sent === COUNT) {
    console.log(g(`✓  Hammasi yuborildi! (${COUNT}/${COUNT})`));
  } else {
    console.log(y(`⚠  Natija: ${sent} yuborildi, ${dead} dead, ${remaining} qoldi`));
  }
  console.log(`   Jami vaqt:      ${b(elapsed + "s")}`);
  console.log(`   O'rtacha tezlik: ${b((sent / (elapsed || 1)).toFixed(2) + " msg/s")}`);
  console.log(`   429 retrylar:   ${b(totalRetries)} ta (Telegram per-chat limitga urdi)`);
  console.log(`${b("═══════════════════════════════════")}\n`);

  await mongoose.disconnect();
  process.exit(sent === COUNT ? 0 : 1);
}

main().catch((e) => {
  console.error(r("✗ " + e.message));
  process.exit(1);
});
