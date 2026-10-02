"use strict";

const {
  guardUploadContent,
  uploadContentGuardMw,
  HEADER_BYTES,
} = require("#modules/4.05-residency/_services/uploadContentGuard");

module.exports = { guardUploadContent, uploadContentGuardMw, HEADER_BYTES };
