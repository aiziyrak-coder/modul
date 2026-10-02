const { ErrorHandler } = require("./error");

async function callMain(
  path,
  { method = "GET", actAs, actAsListener, body, query, timeoutMs = 20000 } = {},
) {
  const base = process.env.MAIN_API_URL;
  if (!base) throw new ErrorHandler(500, "MAIN_API_URL sozlanmagan");

  const qs = query ? `?${new URLSearchParams(query)}` : "";
  const url = `${base.replace(/\/$/, "")}${path}${qs}`;

  const headers = { "x-service-key": process.env.SERVICE_KEY || "" };
  if (actAs) headers["x-act-as"] = String(actAs);
  if (actAsListener) headers["x-act-as-listener"] = String(actAsListener);
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
      aborted ? "Asosiy backend javob bermadi" : "Asosiy backend bilan aloqa uzildi",
      err.message,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = [400, 401, 403, 404, 409].includes(res.status) ? res.status : 502;
    throw new ErrorHandler(code, data.message || "Asosiy backend xatosi");
  }
  return data;
}

module.exports = { callMain };
