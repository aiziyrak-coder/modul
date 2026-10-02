const { currentAcademicYear } = require("./academicYearWindow");

const yearScoreOf = (gifted, year = currentAcademicYear()) => {
  const map = gifted?.scoresByYear;
  if (!map) return 0;
  const raw = typeof map.get === "function" ? map.get(year) : map[year];
  return typeof raw === "number" ? raw : 0;
};

const yearScorePath = (year = currentAcademicYear()) => `scoresByYear.${year}`;

const rankingSort = (year = currentAcademicYear()) => ({
  [yearScorePath(year)]: -1,
  totalScore: -1,
  fullName: 1,
});

const YEAR_RE = /^(\d{4})\s*[-/]\s*(\d{4})$/;
const resolveScoreYear = (raw) => {
  const m = String(raw ?? "").trim().match(YEAR_RE);
  return m ? `${m[1]}/${m[2]}` : currentAcademicYear();
};

module.exports = { yearScoreOf, yearScorePath, rankingSort, resolveScoreYear };
