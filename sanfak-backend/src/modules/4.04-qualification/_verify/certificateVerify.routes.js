"use strict";

const router = require("express").Router();
const Controller = require("./certificateVerify.controller");

router.get("/:code", Controller.verifyCertificate);

module.exports = router;
