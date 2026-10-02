"use strict";

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];

const isDevEnv = (value = process.env.NODE_ENV) =>
  DEV_ENVS.includes(String(value || "").toLowerCase());

module.exports = { DEV_ENVS, isDevEnv };
