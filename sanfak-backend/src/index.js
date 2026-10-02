const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});
const express = require("express");
const http = require("http");
const { Server: SocketServer } = require("socket.io");
const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));
const debug = require("debug")("node-server:index");
const util = require("util");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const { ErrorHandler, handleError } = require("./shared/error");
const winston = require("./shared/winston.logger");
const { installProcessGuard } = require("./shared/processGuard");
installProcessGuard({ logger: winston });
const { isDevEnv } = require("./shared/env");
const { resolveAllowedOrigins, isOriginAllowed: isOriginInAllowlist } =
  require("./shared/corsOrigin");
const appRouter = require("./router");
const { initBot } = require("./shared/telegram");
const { initSocket } = require("./system/_shared/socketHandler");
const { createAdapter } = require("@socket.io/redis-adapter");
const { pub: redisPub, sub: redisSub } = require("./system/_shared/redisClient");
const { startExpulsionCron } = require("./app/scheduler/expulsionCron");
const { startSlaCheckerCron } = require("./app/scheduler/slaCheckerCron");
const { startEriExpiryCron } = require("./app/scheduler/eriExpiryCron");
const { startSamsMonitorCron } = require("./app/scheduler/samsMonitorCron");
const startupRbacCheck = require("./shared/startupRbacCheck");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");

const { apiLimiter, publicReadLimiter } = require("./shared/rateLimiter");
const auditLogger = require("./system/_shared/auditLogger");
const {
  fileDownloadLogger,
  fileAccessLimiter,
} = require("./system/_shared/fileDownloadLogger");
const createFileAccessGuard = require("./shared/fileAccessGuard");
const certificateVerifyRoutes = require("./modules/4.04-qualification/_verify/certificateVerify.routes");
const documentVerifyRoutes = require("./modules/4.02-studyLoad/_verify/documentVerify.routes");
const workPlanVerifyRoutes = require("./modules/4.03-teacher/_verify/workPlanVerify.routes");
const { isVerifyTokenPath } = require("./shared/verifyLogSkip");

const allowedOrigins = resolveAllowedOrigins();

const isOriginAllowed = (origin, req) => isOriginInAllowlist(origin, allowedOrigins, req);

const app = express();

const trustProxyRaw = process.env.TRUST_PROXY ?? "1";
const trustProxy =
  trustProxyRaw === "true"
    ? true
    : trustProxyRaw === "false"
      ? false
      : !isNaN(Number(trustProxyRaw))
        ? Number(trustProxyRaw)
        : trustProxyRaw;
app.set("trust proxy", trustProxy);

const httpServer = http.createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: (origin, callback) =>
      isOriginAllowed(origin)
        ? callback(null, true)
        : callback(new Error(`CORS(socket): ${origin} ruxsatsiz domen`)),
    methods: ["GET", "POST"],
    credentials: true,
  },
});
io.adapter(createAdapter(redisPub, redisSub));
initSocket(io);

const PORT = process.env.PORT || 4000;
const LISTEN_HOST = process.env.LISTEN_HOST || "0.0.0.0";

mongoose.connect(process.env.MONGO_HOST);

mongoose.connection.on("error", () => {
  throw new ErrorHandler(
    400,
    `Unable to connect to database: ${process.env.MONGO_HOST}`,
  );
});

mongoose.connection.on("connected", () => {
  winston.info(`MongoDB connected: ${process.env.MONGO_HOST}`);
  startupRbacCheck();
});

if (process.env.MONGOOSE_DEBUG) {
  mongoose.set("debug", (collectionName, method, query, doc) => {
    debug(`${collectionName}.${method}`, util.inspect(query, false, 20), doc);
  });
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  }),
);

morgan.token("url-masked", (req) => auditLogger.sanitizeUrl(req.originalUrl));
app.use(
  morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url-masked HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
    {
      stream: winston.stream,
      skip: isVerifyTokenPath,
    },
  ),
);

const corsOptions = {
  methods: "GET,PUT,POST,DELETE,PATCH",
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
};

app.use((req, res, next) =>
  cors({
    ...corsOptions,
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, req)) {
        return callback(null, true);
      }
      winston.warn(`CORS: ${origin} ruxsatsiz domen`);
      return callback(new ErrorHandler(403, "CORS: ruxsatsiz origin"));
    },
  })(req, res, next),
);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
    parameterLimit: 50000,
  }),
);

app.use("/api", apiLimiter);

app.use("/api", auditLogger);

const uploadsRoot = path.join(__dirname, "../uploads");
app.use(
  "/files",
  fileAccessLimiter,
  fileDownloadLogger,
  createFileAccessGuard(uploadsRoot),
  express.static(uploadsRoot),
);

app.use("/verify/doc", publicReadLimiter, documentVerifyRoutes);
app.use("/verify/plan", publicReadLimiter, workPlanVerifyRoutes);
app.use("/verify", publicReadLimiter, certificateVerifyRoutes);

if (isDevEnv()) {
  const swaggerSpec = require("./config/swagger.docs");
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

app.use("/api", appRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ message: "So'ralgan API yo'li topilmadi" });
});

const root = path.join(__dirname, "../public/build");

app.use(express.static(root));
app.get("/*", (req, res) => {
  res.sendFile("index.html", { root });
});

app.use((err, req, res, next) => {
  handleError(err, res);
});

initBot();

startExpulsionCron();

startSlaCheckerCron();

startEriExpiryCron();

startSamsMonitorCron();

httpServer.listen(PORT, LISTEN_HOST, () => {
  winston.info(`Server ishga tushdi: ${LISTEN_HOST}:${PORT}`);
});

module.exports = app;
