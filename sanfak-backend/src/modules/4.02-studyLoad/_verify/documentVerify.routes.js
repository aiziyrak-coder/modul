"use strict";

const router = require("express").Router();
const Controller = require("./documentVerify.controller");

router.get("/:token", Controller.verifyDocument);

router.all("*", (req, res) => {
  res.status(405).json({
    status: "error",
    statusCode: 405,
    message: "Method Not Allowed",
  });
});

module.exports = router;
