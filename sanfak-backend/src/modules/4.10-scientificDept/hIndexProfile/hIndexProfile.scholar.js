const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");

const PROFILE_URL = "https://scholar.google.com/citations";
const MIN_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 20000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

let lastRequestAt = 0;

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

function parseScholarUserId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[\w-]{10,20}$/.test(s) && !s.includes("://")) return s;
  const m = s.match(/[?&]user=([\w-]{10,20})/);
  return m ? m[1] : null;
}

function extractScholarMetrics(html) {
  const cells = [...html.matchAll(/class="gsc_rsb_std">(\d+)</g)].map((m) => Number(m[1]));
  if (cells.length < 6) return null;
  return { citations: cells[0], hIndex: cells[2], i10Index: cells[4] };
}

function isBlocked(html) {
  return /captcha|unusual traffic|not a robot|sorry\/index/i.test(html);
}

async function fetchScholarMetrics(userId, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  await throttle();

  let res;
  try {
    res = await fetch(`${PROFILE_URL}?user=${encodeURIComponent(userId)}&hl=en`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason = err.name === "TimeoutError" ? "javob bermadi (timeout)" : "ulanib bo'lmadi";
    throw new ErrorHandler(504, `Google Scholar ${reason}`);
  }

  if (res.status === 404) {
    throw new ErrorHandler(404, "Google Scholar profili topilmadi");
  }
  if (res.status === 429 || res.status === 403) {
    throw new ErrorHandler(
      429,
      "Google Scholar so'rovni bloklaydi — keyinroq urinib ko'ring yoki raqamlarni qo'lda kiriting",
    );
  }
  if (!res.ok) {
    throw new ErrorHandler(502, `Google Scholar xatosi (${res.status})`);
  }

  const html = await res.text();
  if (isBlocked(html)) {
    winston.warn(`[scholar] blok/CAPTCHA sahifasi keldi (user ${userId})`);
    throw new ErrorHandler(
      429,
      "Google Scholar tekshiruv (CAPTCHA) so'radi — avtomatik olish vaqtincha imkonsiz",
    );
  }

  const metrics = extractScholarMetrics(html);
  if (!metrics) {
    winston.warn(`[scholar] statistika jadvali topilmadi (user ${userId})`);
    throw new ErrorHandler(
      502,
      "Google Scholar sahifasidan statistika o'qilmadi — profil ochiqligini tekshiring",
    );
  }
  return metrics;
}

module.exports = {
  parseScholarUserId,
  extractScholarMetrics,
  isBlocked,
  fetchScholarMetrics,
};
