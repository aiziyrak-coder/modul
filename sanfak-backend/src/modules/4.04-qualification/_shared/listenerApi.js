const { ErrorHandler } = require("#shared/error");

async function callListener(path, { method = "GET", actAs, body, query, timeoutMs = 15000 } = {}) {
  const base = process.env.LISTENER_API_URL;
  if (!base) throw new ErrorHandler(500, "LISTENER_API_URL sozlanmagan");

  const qs = query ? `?${new URLSearchParams(query)}` : "";
  const url = `${base.replace(/\/$/, "")}${path}${qs}`;

  const headers = { "x-service-key": process.env.SERVICE_KEY || "" };
  if (actAs) headers["x-act-as"] = String(actAs);
  if (body) headers["content-type"] = "application/json";

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const aborted = err && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new ErrorHandler(
      aborted ? 504 : 502,
      aborted ? "Tinglovchi xizmati javob bermadi" : "Tinglovchi xizmati bilan aloqa uzildi",
      err.message,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = [400, 401, 403, 404, 409].includes(res.status) ? res.status : 502;
    throw new ErrorHandler(code, data.message || "Tinglovchi xizmati xatosi");
  }
  return data;
}

module.exports = { callListener };
