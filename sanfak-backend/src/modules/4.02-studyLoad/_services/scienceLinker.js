const ScienceModel = require("#references/science/science.model");
const winston = require("#shared/winston.logger");

const LINK_STATUS = {
  ALREADY: "already",
  FILLED: "filled",
  NO_CODE: "noCode",
  NON_SCIENCE: "nonScience",
  NOT_IN_CATALOG: "notInCatalog",
};

const NON_SCIENCE_TITLE = /(amaliyot|attestatsiya)/i;

const isNonScienceRow = (row) =>
  NON_SCIENCE_TITLE.test(String(row?.title ?? ""));

const ATTESTATION_TITLE = /attestatsiya/i;

const isAttestationRow = (row) =>
  ATTESTATION_TITLE.test(String(row?.title ?? ""));

const SEPARATOR_CHARS = /[-\s.]/g;
const APOSTROPHE_VARIANTS = /['‘’ʻʼ`]/g;
const CANONICAL_APOSTROPHE = "'";

const canonicalizeScienceCode = (code) => {
  if (code == null) return "";
  return String(code)
    .trim()
    .replace(APOSTROPHE_VARIANTS, CANONICAL_APOSTROPHE)
    .replace(SEPARATOR_CHARS, "")
    .toUpperCase();
};

const lookupCanonical = (catalog, code) => {
  const canonical = canonicalizeScienceCode(code);
  if (!canonical) return null;
  return catalog?.get(canonical) || null;
};

const collectUnlinkedCodes = (blocks) => {
  const codes = new Set();
  for (const block of blocks || []) {
    for (const row of block?.sciences || []) {
      if (row?.science) continue;
      const code = String(row?.code ?? "").trim();
      if (code) codes.add(code);
    }
  }
  return [...codes];
};

const buildCatalog = (docs) => {
  const groups = new Map();
  for (const d of docs || []) {
    if (!d?.scienceCode) continue;
    const canonical = canonicalizeScienceCode(d.scienceCode);
    if (!canonical) continue;
    const list = groups.get(canonical) ?? [];
    list.push({
      _id: d._id,
      department: d.department ?? null,
      scienceCode: d.scienceCode,
    });
    groups.set(canonical, list);
  }

  const catalog = new Map();
  for (const [canonical, list] of groups) {
    if (list.length > 1) {
      winston.warn(
        `[scienceLinker] Noaniq kod: kanonik "${canonical}" ko'rinishiga ${list.length} ` +
          `ta katalog yozuvi mos keldi (${list.map((x) => x.scienceCode).join(", ")}) — ` +
          "bog'lanish o'tkazib yuborildi (noaniqlik qo'riqchisi).",
      );
      continue;
    }
    const [{ _id, department }] = list;
    catalog.set(canonical, { _id, department });
  }
  return catalog;
};

const loadCatalogByCodes = async (codes) => {
  if (!codes || codes.length === 0) return new Map();
  const docs = await ScienceModel.find({ scienceCode: { $in: codes } })
    .select("_id scienceCode department")
    .lean();
  return buildCatalog(docs);
};

const resolveLink = (row, catalog) => {
  const current = {
    science: row?.science ?? null,
    department: row?.department ?? null,
  };
  if (row?.science) return { ...current, status: LINK_STATUS.ALREADY };

  const code = String(row?.code ?? "").trim();
  if (!code) return { ...current, status: LINK_STATUS.NO_CODE };

  const hit = lookupCanonical(catalog, code);
  if (hit) {
    return {
      science: hit._id,
      department: hit.department ?? null,
      status: LINK_STATUS.FILLED,
    };
  }
  return {
    ...current,
    status: isNonScienceRow(row)
      ? LINK_STATUS.NON_SCIENCE
      : LINK_STATUS.NOT_IN_CATALOG,
  };
};

const applyLink = (row, catalog) => {
  const result = resolveLink(row, catalog);
  if (result.status === LINK_STATUS.FILLED) {
    row.science = result.science;
    row.department = result.department;
  }
  return result.status;
};

module.exports = {
  LINK_STATUS,
  isNonScienceRow,
  isAttestationRow,
  canonicalizeScienceCode,
  lookupCanonical,
  collectUnlinkedCodes,
  buildCatalog,
  loadCatalogByCodes,
  resolveLink,
  applyLink,
};
