const { ErrorHandler } = require("./error");
const { signFileUrlsDeep } = require("./fileSign");
const { mirrorWrite } = require("./mirror");

const MAX_BODY_BYTES = (Number(process.env.PROXY_MAX_BODY_MB) || 210) * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS) || 120_000;
const MAX_RESPONSE_BYTES = (Number(process.env.PROXY_MAX_RESPONSE_MB) || 50) * 1024 * 1024;

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      req.destroy();
      throw new ErrorHandler(413, "So'rov tanasi juda katta");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function proxyToMain(req, res, next) {
  (async () => {
    try {
      const base = process.env.MAIN_API_URL;
      if (!base) return next(new ErrorHandler(500, "MAIN_API_URL sozlanmagan"));

      const target = base.replace(/\/$/, "") + req.originalUrl.replace(/^\/api/, "");

      const headers = {};
      if (req.listenerId) {
        headers["x-service-key"] = process.env.SERVICE_KEY || "";
        headers["x-act-as-listener"] = String(req.listenerId);
      }

      const opts = { method: req.method, headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) };

      if (!["GET", "HEAD"].includes(req.method)) {
        const ct = req.headers["content-type"] || "";
        if (ct.includes("application/json")) {
          headers["content-type"] = "application/json";
          opts.body = JSON.stringify(req.body ?? {});
        } else if (ct) {
          headers["content-type"] = ct;
          opts.body = await readRawBody(req);
        }
      }

      const upstream = await fetch(target, opts);
      const declaredLen = Number(upstream.headers.get("content-length"));
      if (Number.isFinite(declaredLen) && declaredLen > MAX_RESPONSE_BYTES) {
        return next(new ErrorHandler(502, "Asosiy backend javobi juda katta"));
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const rct = upstream.headers.get("content-type") || "";
      if (rct) res.set("content-type", rct);

      const isWrite = !["GET", "HEAD"].includes(req.method);
      const ok = upstream.status >= 200 && upstream.status < 300;

      let parsed;
      if (rct.includes("application/json")) {
        try {
          parsed = JSON.parse(buf.toString("utf8"));
        } catch {
          parsed = undefined;
        }
      }

      if (parsed !== undefined) {
        if (isWrite && ok) {
          try {
            mirrorWrite(req, upstream.status, JSON.parse(buf.toString("utf8"))).catch(() => {});
          } catch {
          }
        }
        return res.status(upstream.status).json(signFileUrlsDeep(parsed));
      }
      return res.status(upstream.status).send(buf);
    } catch (err) {
      if (err instanceof ErrorHandler) return next(err);
      const aborted = err && (err.name === "TimeoutError" || err.name === "AbortError");
      return next(
        new ErrorHandler(
          aborted ? 504 : 502,
          aborted ? "Asosiy backend javob bermadi (timeout)" : "Asosiy backend bilan aloqa uzildi",
          err.message,
        ),
      );
    }
  })();
}

module.exports = { proxyToMain };
