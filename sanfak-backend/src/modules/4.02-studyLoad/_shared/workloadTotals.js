const computeWorkloadTotals = (doc) => {
  let totalLectures = 0;
  let totalHours = 0;

  for (const direction of doc?.directions || []) {
    const blocks = direction?.blocks || [];
    totalLectures += blocks.length;
    totalHours += blocks.reduce((sum, block) => sum + (block?.totalHour || 0), 0);
  }

  return { totalLectures, totalHours };
};

const workloadTotalHours = (doc) => computeWorkloadTotals(doc).totalHours;

module.exports = { computeWorkloadTotals, workloadTotalHours };
