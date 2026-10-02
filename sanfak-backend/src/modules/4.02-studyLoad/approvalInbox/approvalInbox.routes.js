"use strict";
const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const Controller = require("./approvalInbox.controller");

router.use(authenticate);

router.get("/", Controller.list);

module.exports = router;
