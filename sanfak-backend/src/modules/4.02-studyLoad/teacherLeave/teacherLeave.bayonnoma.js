const { fmtDocDate } = require("#modules/4.02-studyLoad/_shared/pdfFormat");
const { resolveSignatory } = require("#modules/4.02-studyLoad/_shared/signatories");
const { QR_SIZE_ROW } = require("#modules/4.02-studyLoad/_shared/verifyQr");

const DASH = "—";
const APPROVER_POSITION_FALLBACK = "Kafedra mudiri";

const toDocDate = (v) => (v ? fmtDocDate(new Date(v)) : "");

function formatLeavePeriod(fromDate, toDate) {
  const from = toDocDate(fromDate);
  const to = toDocDate(toDate);
  if (from && to) return `${from} – ${to}`;
  if (from) return `${from} dan boshlab`;
  if (to) return `${to} gacha`;
  return DASH;
}

const TYPE_LABEL = {
  resignation: "Ishdan bo'shash",
  transfer: "Ko'chirish",
  leave: "Ta'til/chetlatish",
};

function refTitle(value) {
  if (!value || typeof value !== "object") return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  return title || null;
}

function teacherFullName(teacher) {
  if (!teacher || typeof teacher !== "object") return DASH;
  const name = [teacher.lastName, teacher.firstName, teacher.middleName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || DASH;
}

function buildBayonnomaInfoRows(leave) {
  const teacher = leave?.teacher;
  const distribution = leave?.distribution;
  const approvalDate = toDocDate(leave?.approvalDate) || DASH;

  return [
    ["Sana", approvalDate],
    ["O'qituvchi", teacherFullName(teacher)],
    ["Lavozim", refTitle(teacher?.position) || DASH],
    ["Amaliyot turi", TYPE_LABEL[leave?.type] || leave?.type || DASH],
    ["Muddat", formatLeavePeriod(leave?.fromDate, leave?.toDate)],
    ["Sabab", leave?.reason || DASH],
    [
      "Kafedra",
      refTitle(distribution?.department) ||
        refTitle(teacher?.department) ||
        DASH,
    ],
    ["O'quv yili", refTitle(distribution?.academicYear) || DASH],
    ["Holat", "Tasdiqlandi"],
  ];
}

function buildBayonnomaSignature(leave, qr) {
  const approver = leave?.approvedBy;
  const sig = resolveSignatory(null, {
    step: "kafedra",
    snapshot: leave?.verify?.snapshot,
    steps: [{ step: "kafedra", status: "approved", approvedBy: approver, date: leave?.approvalDate }],
  });
  const position = refTitle(approver?.position) || APPROVER_POSITION_FALLBACK;
  return {
    layout: "row",
    position: `${position}:`,
    sig: { ...sig, dateText: toDocDate(sig.date) || DASH },
    qr: qr ? { image: qr.image, size: QR_SIZE_ROW } : undefined,
  };
}

module.exports = {
  buildBayonnomaInfoRows,
  buildBayonnomaSignature,
  formatLeavePeriod,
  teacherFullName,
  refTitle,
  TYPE_LABEL,
};
