const {
  collectEntries,
  streamArchive,
} = require("#modules/4.10-scientificDept/_shared/fileArchive");
const Startup = require("./startup.model");

const SLOT_LABELS = {
  passport: "Loyiha pasporti",
  application: "Ariza",
  presentation: "Taqdimot",
  certificate: "Sertifikat",
};

const authorFullName = (doc) =>
  [doc.author?.lastName, doc.author?.firstName].filter(Boolean).join(" ");

const archiveBaseName = (doc) =>
  [authorFullName(doc), doc.title].filter(Boolean).join(" — ") || "startap";

async function streamStartupArchive(doc, res) {
  const entries = collectEntries(doc.files || {}, Startup.STARTUP_FILE_SLOTS, SLOT_LABELS);
  return streamArchive(entries, archiveBaseName(doc), res);
}

module.exports = { streamStartupArchive, SLOT_LABELS, authorFullName, archiveBaseName };
