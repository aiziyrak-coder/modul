"use strict";

const router = require("express").Router();
const { samsKeyGate } = require("./samsKeyGate");
const C = require("./samsIngest.controller");

const noStore = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

router.use(noStore, samsKeyGate);

router.get("/roster", C.roster);
router.post("/ingest", C.ingest);

module.exports = router;
