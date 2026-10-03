const { BASE_URL, TOKEN, TYPES, PAGE_SIZE } = require("./hemis.config");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Bitta sahifani oladi; tarmoq/5xx xatolarida 3 marta qayta urinadi.
async function fetchPage(type, page) {
  const def = TYPES[type];
  if (!def) throw new Error(`Noma'lum HEMIS turi: ${type}`);
  const token = TOKEN();
  if (!token) throw new Error("HEMIS_API_TOKEN sozlanmagan");

  const qs = new URLSearchParams({
    ...(def.query || {}),
    limit: String(PAGE_SIZE),
    page: String(page),
  });
  const url = `${BASE_URL()}/${def.path}?${qs}`;

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || body.success === false) {
        const e = new Error(`HEMIS ${def.path}: ${body?.error || `HTTP ${res.status}`}`);
        e.fatal = true; // 4xx — qayta urinishdan foyda yo'q
        throw e;
      }
      const data = body.data || {};
      return {
        items: Array.isArray(data.items) ? data.items : [],
        pageCount: data.pagination?.pageCount ?? 1,
        totalCount: data.pagination?.totalCount ?? 0,
      };
    } catch (err) {
      lastErr = err;
      if (err.fatal) break;
      await sleep(1000 * attempt);
    }
  }
  throw lastErr;
}

module.exports = { fetchPage };
