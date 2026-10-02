"use strict";

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const { resolveAllowedOrigins, isOriginAllowed } = require("#shared/corsOrigin");
const createFileAccessGuard = require("#shared/fileAccessGuard");
const { ErrorHandler, handleError } = require("#shared/error");
const winston = require("#shared/winston.logger");

const buildPerimeterApp = ({ allowedOrigins = resolveAllowedOrigins() } = {}) => {
  const app = express();

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
        if (isOriginAllowed(origin, allowedOrigins, req)) return callback(null, true);
        winston.warn(`CORS: ${origin} ruxsatsiz domen`);
        return callback(new ErrorHandler(403, "CORS: ruxsatsiz origin"));
      },
    })(req, res, next),
  );

  const uploadsRoot = path.join(__dirname, "../../../uploads");
  app.use("/files", createFileAccessGuard(uploadsRoot), express.static(uploadsRoot));

  app.get("/api/_probe", (req, res) => res.status(200).json({ ok: true }));

  app.use((err, req, res, next) => handleError(err, res));

  return app;
};

module.exports = { buildPerimeterApp };
