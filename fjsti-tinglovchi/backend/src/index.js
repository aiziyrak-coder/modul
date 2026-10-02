require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server: SocketServer } = require("socket.io");

const logger = require("#shared/logger");
const { checkEnv } = require("#shared/checkEnv");
const { connectDb } = require("#shared/db");
const { startMirrorRetry } = require("#shared/mirror");
const { initSocketBridge } = require("#shared/socketBridge");
const { startProgressSyncRetry } = require("#modules/learning/progress.service");
const { startIdentitySync } = require("#shared/identitySync");
const { handleError, ErrorHandler } = require("#shared/error");
const { handleUploadError, FILES_DIR } = require("#shared/upload");

checkEnv();

const app = express();

const origins = (process.env.CORS_ORIGINS || "http://localhost:5473")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", { stream: { write: (m) => logger.info(m.trim()) } }));

app.use(
  "/files",
  express.static(FILES_DIR, {
    setHeaders: (res) => {
      res.setHeader("Content-Disposition", "attachment");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "listener-backend" }));
app.use("/api", require("./router"));

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "So'ralgan API yo'li topilmadi" });
});

const CLIENT_BUILD_DIR = path.resolve(
  process.env.CLIENT_BUILD_DIR || path.join(__dirname, "../public/build"),
);
const hasClientBuild = fs.existsSync(path.join(CLIENT_BUILD_DIR, "index.html"));

if (hasClientBuild) {
  app.use(express.static(CLIENT_BUILD_DIR));
  app.get("/*", (_req, res) => res.sendFile("index.html", { root: CLIENT_BUILD_DIR }));
} else {
  app.use((req, _res, next) => next(new ErrorHandler(404, `Yo'l topilmadi: ${req.originalUrl}`)));
}

app.use(handleUploadError);
app.use(handleError);

const PORT = process.env.PORT || 4500;

connectDb()
  .then(() => {
    startMirrorRetry();
    startProgressSyncRetry();
    startIdentitySync();

    const server = http.createServer(app);
    const io = new SocketServer(server, { cors: { origin: origins, credentials: true } });
    initSocketBridge(io);

    server.listen(PORT, () => {
      logger.info(`Tinglovchi backend ishga tushdi: port ${PORT}`);
      logger.info(
        hasClientBuild
          ? `[SPA] frontend build xizmatda: ${CLIENT_BUILD_DIR}`
          : `[SPA] build topilmadi (${CLIENT_BUILD_DIR}) — API-only rejim`,
      );
    });
    server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 120_000;
    server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS) || 30_000;
  })
  .catch((err) => {
    logger.error(`Ishga tushirib bo'lmadi: ${err.message}`);
    process.exit(1);
  });

module.exports = app;
