"use strict";

const toGlobalSemKey = (localSemKey, courseNum) => {
  const local = Number(localSemKey);
  const course = Number(courseNum);
  if (!Number.isInteger(local) || local < 1) return null;
  if (!Number.isInteger(course) || course < 1) return null;
  return String((course - 1) * 2 + local);
};

const semesterDisplayNo = (localSemKey, courseNum) =>
  toGlobalSemKey(localSemKey, courseNum) ?? String(localSemKey);

module.exports = { toGlobalSemKey, semesterDisplayNo };
