const START_MONTH = 9;

const academicYearOf = (date) => {
  if (date === null || date === undefined || date === "") return null;
  const d = date instanceof Date ? date : new Date(date);
  const time = d.getTime();
  if (Number.isNaN(time)) return null;

  const year = d.getFullYear();
  return d.getMonth() + 1 >= START_MONTH ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

const currentAcademicYear = (now = new Date()) => academicYearOf(now);

module.exports = { academicYearOf, currentAcademicYear, START_MONTH };
