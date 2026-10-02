const {
  collectEntries,
  streamArchive,
} = require("#modules/4.10-scientificDept/_shared/fileArchive");
const EconomicContract = require("./economicContract.model");

const SLOT_LABELS = {
  order: "Buyruq",
  contract: "Shartnoma",
  receipt: "To'lov kvitansiyasi",
};

const teacherFullName = (doc) =>
  [doc.teacher?.lastName, doc.teacher?.firstName].filter(Boolean).join(" ");

const contractDay = (doc) => {
  const d = doc.contractDate ? new Date(doc.contractDate) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
};

const archiveBaseName = (doc) =>
  [teacherFullName(doc), contractDay(doc)].filter(Boolean).join(" ") ||
  doc.title ||
  "shartnoma";

async function streamContractArchive(doc, res) {
  const entries = collectEntries(
    doc.files || {},
    EconomicContract.CONTRACT_FILE_SLOTS,
    SLOT_LABELS,
  );
  return streamArchive(entries, archiveBaseName(doc), res);
}

module.exports = {
  streamContractArchive,
  SLOT_LABELS,
  teacherFullName,
  contractDay,
  archiveBaseName,
};
