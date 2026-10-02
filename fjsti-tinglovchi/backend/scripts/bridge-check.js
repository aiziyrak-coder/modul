"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { io: ioClient } = require("socket.io-client");

const TIMEOUT_MS = 15000;

const mainOrigin = () =>
  String(process.env.MAIN_API_URL || "")
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");

function attempt(label, origin, opts) {
  return new Promise((resolve) => {
    const sock = ioClient(origin, {
      auth: {
        serviceKey: process.env.SERVICE_KEY || "",
        actAsListener: "000000000000000000000000",
      },
      reconnection: false,
      timeout: TIMEOUT_MS,
      ...opts,
    });
    const done = (ok, note) => {
      sock.close();
      resolve({ label, ok, note });
    };
    const t = setTimeout(() => done(false, "vaqt tugadi (" + TIMEOUT_MS / 1000 + "s)"), TIMEOUT_MS);
    sock.on("connect", () => {
      clearTimeout(t);
      done(true, "transport: " + sock.io.engine.transport.name);
    });
    sock.on("connect_error", (err) => {
      clearTimeout(t);
      done(false, err.message);
    });
  });
}

async function main() {
  const origin = mainOrigin();
  console.log("[bridge-check] asosiy backend origin :", origin || "(YO'Q — MAIN_API_URL sozlanmagan)");
  console.log("[bridge-check] SERVICE_KEY           :", process.env.SERVICE_KEY ? "bor" : "YO'Q");
  if (!origin) {
    console.log("\n  MAIN_API_URL sozlanmagan — ko'prik umuman ishlay olmaydi.");
    process.exitCode = 1;
    return;
  }

  console.log("\n  Ikki usul sinovdan o'tkazilmoqda...\n");

  const forced = await attempt("Faqat websocket (majburiy)", origin, {
    transports: ["websocket"],
  });
  const dflt = await attempt("Standart (polling -> websocket)", origin, {
    tryAllTransports: true,
  });

  for (const r of [forced, dflt]) {
    console.log("  " + (r.ok ? "✓" : "✗") + "  " + r.label.padEnd(36) + " " + r.note);
  }

  console.log("");
  if (dflt.ok && !forced.ok) {
    console.log("  XULOSA: to'g'ridan websocket ulanishi o'tmaydi (proksi Upgrade sarlavhalarini uzatmayapti),");
    console.log("  standart tartib esa ishlaydi — ko'prik aynan shu tartibda ulanadi.");
  } else if (dflt.ok && forced.ok) {
    console.log("  XULOSA: ikkala usul ham ishlaydi — ko'prik ulanishi uchun to'siq yo'q.");
    console.log("  Chat ishlamasa, ko'prik logidagi xato matnini tekshiring.");
  } else {
    console.log("  XULOSA: hech qaysi usul ulanmadi — muammo transportdan chuqurroq:");
    console.log("  manzil noto'g'ri, tarmoq/firewall yopiq yoki SERVICE_KEY mos emas.");
    console.log("  Yuqoridagi xato matni sababini aytadi.");
  }
}

main().catch((err) => {
  console.error("[bridge-check] XATO:", err.message);
  process.exit(1);
});
