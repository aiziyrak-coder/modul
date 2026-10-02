"use strict";

const VERIFY_TOKEN_PATH = /^\/verify\/(doc|plan)(\/|\?|$)/;

const isVerifyTokenPath = (req) =>
  VERIFY_TOKEN_PATH.test(String((req && (req.originalUrl || req.url)) || ""));

module.exports = { isVerifyTokenPath, VERIFY_TOKEN_PATH };
