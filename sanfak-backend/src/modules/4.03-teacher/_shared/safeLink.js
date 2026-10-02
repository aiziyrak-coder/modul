const Joi = require("joi");

const SAFE_LINK_RX = /^(https?:\/\/[^\s]+|\/files\/[^\s]+)$/i;

const safeLink = () =>
  Joi.string()
    .trim()
    .max(2000)
    .pattern(SAFE_LINK_RX)
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base":
        "Havola http:// yoki https:// bilan boshlanishi kerak (yoki yuklangan fayl manzili)",
      "string.max": "Havola juda uzun (2000 belgidan oshmasin)",
    });

module.exports = { safeLink, SAFE_LINK_RX };
