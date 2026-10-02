const stringFromMultiLang = (v) => {
  if (v == null) return v;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    return v.uz || v.ru || v.eng || "";
  }
  return String(v);
};

module.exports = {
  multiLangField: (required = false) => ({
    type: String,
    ...(required && { required: true }),
    set: stringFromMultiLang,
  }),
  stringFromMultiLang,
};
