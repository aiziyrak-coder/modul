const ScholarshipApplicationModel = require("#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model");

const ALWAYS_EDITABLE = new Set(["active"]);

async function isScoringComplete(scholarship) {
  if (!scholarship || scholarship.type !== "rektor") return false;

  const judges = (scholarship.judges || []).map(String);
  if (!judges.length) return false;

  const apps = await ScholarshipApplicationModel.find({
    scholarship: scholarship._id,
    status: "approved",
  })
    .select("judgeScores")
    .lean();
  if (!apps.length) return false;

  return apps.every((app) => {
    const scored = new Set((app.judgeScores || []).map((js) => String(js.judge)));
    return judges.every((j) => scored.has(j));
  });
}

function touchesScoring(body) {
  return Object.keys(body || {}).some((k) => !ALWAYS_EDITABLE.has(k));
}

module.exports = { isScoringComplete, touchesScoring, ALWAYS_EDITABLE };
