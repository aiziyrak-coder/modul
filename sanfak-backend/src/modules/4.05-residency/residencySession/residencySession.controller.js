"use strict";

const { ErrorHandler } = require("#shared/error");
const S = require("./residencySession.service");

const wrap = (label, fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    return next(err instanceof ErrorHandler ? err : new ErrorHandler(500, label, err.message));
  }
};

module.exports = {
  announce: wrap("Mashg'ulotni e'lon qilishda xato", async (req, res) => {
    const result = await S.announce(req.body, req.user);
    return res.status(201).json({ message: "Mashg'ulot e'lon qilindi", ...result });
  }),

  paginate: wrap("Mashg'ulotlar ro'yxati xatosi", async (req, res) => {
    const page = await S.paginate(req.query, req.user);
    return res.status(200).json(page);
  }),

  unsupervised: wrap("Ustozsiz rezidentlar ro'yxati xatosi", async (req, res) => {
    const page = await S.unsupervisedResidents(req.query, req.user);
    return res.status(200).json(page);
  }),

  cancel: wrap("Mashg'ulotni bekor qilishda xato", async (req, res) => {
    const result = await S.cancel(req.params.id, req.body.reason, req.user);
    return res.status(200).json(result);
  }),

  findOne: wrap("Mashg'ulotni olishda xato", async (req, res) => {
    const result = await S.findOne(req.params.id, req.user);
    return res.status(200).json(result);
  }),
};
