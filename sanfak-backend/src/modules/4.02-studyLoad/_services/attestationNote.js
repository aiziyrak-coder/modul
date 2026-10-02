const ATTESTATION_NOTE_MAX = 500;

function deriveAttestationNote(summary) {
  if (!Array.isArray(summary)) return null;
  for (const row of summary) {
    const note = typeof row?.note === "string" ? row.note.trim() : "";
    if (note) return note.slice(0, ATTESTATION_NOTE_MAX);
  }
  return null;
}

module.exports = { deriveAttestationNote, ATTESTATION_NOTE_MAX };
