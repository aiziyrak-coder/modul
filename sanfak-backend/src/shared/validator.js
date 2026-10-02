"use strict";

const { createValidator } = require("express-joi-validation");
const { ErrorHandler } = require("./error");

const base = createValidator({ passError: true });

const wrap = (middleware, type) => (req, res, next) =>
  middleware(req, res, (err) => {
    if (!err) return next();

    const joi = err.error;
    if (!joi || !joi.isJoi) return next(err);

    const detail = Array.isArray(joi.details)
      ? joi.details.map((d) => d.message).join("; ")
      : "";

    return next(new ErrorHandler(400, joi.message || `Noto'g'ri ${type}`, detail));
  });

module.exports = {
  body: (schema, opts) => wrap(base.body(schema, opts), "body"),
  query: (schema, opts) => wrap(base.query(schema, opts), "query"),
  params: (schema, opts) => wrap(base.params(schema, opts), "params"),
  headers: (schema, opts) => wrap(base.headers(schema, opts), "headers"),
};
