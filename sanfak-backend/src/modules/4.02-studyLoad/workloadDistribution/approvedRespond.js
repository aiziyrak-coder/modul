const APPROVED_REJECT_MSG =
  "Tasdiqlangan taqsimotda faqat qayta biriktirilgan fanni qabul qilish " +
  "mumkin. E'tirozingiz bo'lsa, kafedra mudiriga murojaat qiling.";
const APPROVED_NOT_PENDING_MSG =
  "Tasdiqlangan taqsimotda faqat javob kutilayotgan (qayta biriktirilgan) " +
  "fanni qabul qilish mumkin";

function approvedRespondGate({ action, blocks, blockIds }) {
  if (action !== "accepted") return { status: 400, message: APPROVED_REJECT_MSG };
  const byId = new Map((blocks || []).map((b) => [String(b._id), b]));
  const allPending = (blockIds || []).every(
    (bid) => byId.get(String(bid))?.acceptanceStatus === "pending",
  );
  return allPending ? null : { status: 400, message: APPROVED_NOT_PENDING_MSG };
}

module.exports = { approvedRespondGate };
