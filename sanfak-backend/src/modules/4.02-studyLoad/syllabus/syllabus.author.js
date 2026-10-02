function authorSetFields(author) {
  if (!author || typeof author !== "object") return {};
  const out = {};
  if (author.email !== undefined) out["author.email"] = author.email || null;
  if (author.organization !== undefined) {
    out["author.organization"] = author.organization || null;
  }
  if (author.reviewer !== undefined) {
    out["author.reviewer.desc"] = author.reviewer?.desc || null;
  }
  return out;
}

module.exports = { authorSetFields };
