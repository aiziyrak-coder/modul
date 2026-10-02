"use strict";

function rollupEntryAcceptance(blocks, fallbackStatus = "pending") {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { acceptanceStatus: "pending", rejectionReason: null, respondedAt: null };
  }

  const effective = blocks.map((block) => ({
    status: block?.acceptanceStatus ?? fallbackStatus,
    rejectionReason: block?.rejectionReason ?? null,
    respondedAt: block?.respondedAt ?? null,
  }));

  let maxRespondedAt = null;
  for (const e of effective) {
    if (!e.respondedAt) continue;
    const t = new Date(e.respondedAt).getTime();
    if (Number.isNaN(t)) continue;
    if (maxRespondedAt === null || t > new Date(maxRespondedAt).getTime()) {
      maxRespondedAt = e.respondedAt;
    }
  }

  const rejected = effective.filter((e) => e.status === "rejected");
  if (rejected.length > 0) {
    const dated = rejected.filter((e) => e.respondedAt);
    const last =
      dated.length > 0
        ? dated.reduce((max, e) =>
            new Date(e.respondedAt).getTime() > new Date(max.respondedAt).getTime()
              ? e
              : max,
          )
        : rejected[rejected.length - 1];
    return {
      acceptanceStatus: "rejected",
      rejectionReason: last.rejectionReason,
      respondedAt: maxRespondedAt,
    };
  }

  const allAccepted = effective.every((e) => e.status === "accepted");
  if (allAccepted) {
    return { acceptanceStatus: "accepted", rejectionReason: null, respondedAt: maxRespondedAt };
  }

  return { acceptanceStatus: "pending", rejectionReason: null, respondedAt: maxRespondedAt };
}

module.exports = { rollupEntryAcceptance };
