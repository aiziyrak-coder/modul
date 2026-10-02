const { ctTotal, itemVal } = require("#shared/particleHelpers");

const round2 = (n) => Math.round(n * 100) / 100;
const positive = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);

function blockHours(block) {
  const sw = (block && block.studyWork) || {};
  const lecture = ctTotal(sw, "maruza", "lecture");
  const seminar = ctTotal(sw, "amaliy", "practicalExercise") + ctTotal(sw, "seminar", null);
  const laboratory = ctTotal(sw, "laboratoriya", "labTraining");
  const practical = ctTotal(sw, "klinik_amaliyot", "clinicalPractice");
  const on = itemVal(sw, "on");
  const yan = itemVal(sw, "yan");
  const retake = itemVal(sw, "qoldirilgan");
  const practiceLead = itemVal(sw, "malakaviy");
  const otherWork = positive(block && block.nonAuditHour);
  const total = Number(block && block.totalHour) || 0;
  const auditorium = lecture + seminar + laboratory + practical;
  const known = auditorium + on + yan + retake + practiceLead + otherWork;
  return {
    lecture,
    seminar,
    laboratory,
    practical,
    independent: Math.max(0, total - auditorium),
    on,
    yan,
    retake,
    practiceLead,
    otherWork,
    adjustment: round2(total - known),
  };
}

function blockCounts(block) {
  const sw = (block && block.studyWork) || {};
  return { streamCount: positive(sw.stream), groupCount: positive(sw.group) };
}

module.exports = { blockHours, blockCounts };
