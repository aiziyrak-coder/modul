const os = require("os");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs/promises");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");

const execFileAsync = promisify(execFile);

const PAGE_URL = (id) => `https://www.scopus.com/pages/authors/${id}`;
const GRAPHQL_URL = "https://www.scopus.com/gateway/author-profile-api/author";
const SEARCH_URL = "https://api.elsevier.com/content/search/scopus";
const METRICS_QUERY =
  "query($id:String!){author(id:$id){metrics{citationCount documentCount hindex}}}";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const PAGE_SIZE = 25;
const MAX_PAGES = 20;
const DEFAULT_TIMEOUT_MS = 20000;
const MIN_INTERVAL_MS = 1500;

let lastRequestAt = 0;

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

const isConfigured = () => Boolean(process.env.SCOPUS_API_KEY);

function parseScopusAuthorId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\d{8,}$/.test(s)) return s;

  const patterns = [
    /\/pages\/authors\/(\d{8,})/i,
    /[?&]authorId=(\d{8,})/i,
    /\bAU-ID\((\d{8,})\)/i,
  ];
  for (const rx of patterns) {
    const m = s.match(rx);
    if (m) return m[1];
  }
  return null;
}

function toCount(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

function computeHIndex(citationCounts) {
  const sorted = [...citationCounts].sort((a, b) => b - a);
  let h = 0;
  sorted.forEach((c, i) => {
    if (c >= i + 1) h = i + 1;
  });
  return h;
}

function extractPreviewMetrics(raw) {
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const m = json?.data?.author?.metrics;
  if (!m) return null;
  const hIndex = toCount(m.hindex);
  const citations = toCount(m.citationCount);
  const documents = toCount(m.documentCount);
  if (hIndex === null && citations === null) return null;
  return { hIndex: hIndex ?? 0, citations: citations ?? 0, documents: documents ?? 0 };
}

async function runCurl(args, timeoutMs) {
  try {
    const { stdout } = await execFileAsync("curl", args, {
      timeout: timeoutMs + 5000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new ErrorHandler(500, "Serverda `curl` topilmadi — Scopus Preview ishlamaydi");
    }
    throw new ErrorHandler(504, "Scopus Preview so'rovi bajarilmadi");
  }
}

async function fetchViaPreview(authorId, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const jar = path.join(os.tmpdir(), `scopus-${crypto.randomUUID()}.cookie`);
  const seconds = String(Math.ceil(timeoutMs / 1000));
  const page = PAGE_URL(authorId);

  try {
    await runCurl(
      [
        "-s", "-L", "--max-redirs", "20", "--max-time", seconds,
        "-c", jar, "-b", jar,
        "-A", UA,
        "-H", "Accept-Language: en-US,en;q=0.9",
        "-o", os.devNull,
        page,
      ],
      timeoutMs,
    );

    const body = JSON.stringify({ query: METRICS_QUERY, variables: { id: authorId } });
    const stdout = await runCurl(
      [
        "-s", "--max-time", seconds,
        "-b", jar, "-c", jar,
        "-A", UA,
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json",
        "-H", "Origin: https://www.scopus.com",
        "-H", `Referer: ${page}`,
        "-X", "POST", GRAPHQL_URL,
        "-d", body,
      ],
      timeoutMs,
    );

    if (/"message"\s*:\s*"Forbidden"/i.test(stdout)) {
      throw new ErrorHandler(429, "Scopus so'rovni bloklaydi (Preview)");
    }

    const metrics = extractPreviewMetrics(stdout);
    if (!metrics) {
      throw new ErrorHandler(502, "Scopus Preview javobidan ko'rsatkich o'qilmadi");
    }
    return metrics;
  } finally {
    await fs.unlink(jar).catch(() => undefined);
  }
}

async function fetchSearchPage(authorId, start, timeoutMs) {
  const headers = {
    "X-ELS-APIKey": process.env.SCOPUS_API_KEY,
    Accept: "application/json",
  };
  if (process.env.SCOPUS_INST_TOKEN) {
    headers["X-ELS-Insttoken"] = process.env.SCOPUS_INST_TOKEN;
  }

  const url =
    `${SEARCH_URL}?query=${encodeURIComponent(`AU-ID(${authorId})`)}` +
    `&count=${PAGE_SIZE}&start=${start}&field=citedby-count`;

  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const reason = err.name === "TimeoutError" ? "javob bermadi (timeout)" : "ulanib bo'lmadi";
    throw new ErrorHandler(504, `Scopus API ${reason}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new ErrorHandler(502, "Scopus API ruxsat bermadi — kalit tekshirilsin");
  }
  if (res.status === 429) {
    throw new ErrorHandler(429, "Scopus API kvotasi tugadi");
  }
  if (!res.ok) throw new ErrorHandler(502, `Scopus API xatosi (${res.status})`);
  return res.json();
}

async function fetchViaSearchApi(authorId, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const counts = [];
  let total = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const json = await fetchSearchPage(authorId, page * PAGE_SIZE, timeoutMs);
    const sr = json["search-results"] || {};
    if (page === 0) total = Number(sr["opensearch:totalResults"] || 0);

    const entries = Array.isArray(sr.entry) ? sr.entry : [];
    if (!entries.length || entries[0]?.error) break;

    entries.forEach((e) => counts.push(Number(e["citedby-count"] || 0)));
    if (counts.length >= total) break;

    if (page === MAX_PAGES - 1) {
      winston.warn(
        `[scopus] AU-ID ${authorId}: ${total} hujjatdan faqat ${counts.length} tasi olindi (MAX_PAGES)`,
      );
    }
  }

  if (!total && !counts.length) {
    throw new ErrorHandler(404, "Scopus'da bu muallif bo'yicha hujjat topilmadi");
  }

  return {
    hIndex: computeHIndex(counts),
    citations: counts.reduce((sum, c) => sum + c, 0),
    documents: total || counts.length,
  };
}

async function fetchAuthorMetrics(authorId, opts = {}) {
  await throttle();

  try {
    return await fetchViaPreview(authorId, opts);
  } catch (previewErr) {
    if (!isConfigured()) throw previewErr;
    winston.warn(
      `[scopus] Preview ishlamadi (${previewErr.message}) — rasmiy API kalitiga o'tildi`,
    );
    return fetchViaSearchApi(authorId, opts);
  }
}

module.exports = {
  isConfigured,
  parseScopusAuthorId,
  computeHIndex,
  extractPreviewMetrics,
  fetchViaPreview,
  fetchViaSearchApi,
  fetchAuthorMetrics,
};
