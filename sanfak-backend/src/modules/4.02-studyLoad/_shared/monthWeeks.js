"use strict";

const { ErrorHandler } = require("#shared/error");

const normMonth = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[ʻʼʽʾʿ`´‘’‚‛]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const monthCounts = (course) =>
  (course?.months || []).map((m) => ({
    month: m?.month ?? "",
    count: Array.isArray(m?.weeks) ? m.weeks.length : 0,
  }));

const totalWeeks = (course) => monthCounts(course).reduce((s, m) => s + m.count, 0);

const weekKeyFromMap = (weeks, weekNo) => {
  if (!weeks) return undefined;
  if (typeof weeks.get === "function") return weeks.get(String(weekNo));
  return weeks[String(weekNo)] ?? weeks[weekNo];
};

const normalizeCounts = (counts) =>
  (Array.isArray(counts) ? counts : []).map((c) => ({
    month: String(c?.month ?? "").trim(),
    count: Number(c?.count),
  }));

const validateCounts = (course, counts, label = "") => {
  const cur = monthCounts(course);
  const inc = normalizeCounts(counts);
  const pre = label ? `${label}: ` : "";
  if (!cur.length) {
    throw new ErrorHandler(
      400,
      `${pre}bu hujjatda oylar taqsimoti yo'q — avval faylni qayta yuklang`,
    );
  }
  if (inc.length !== cur.length) {
    throw new ErrorHandler(
      400,
      `${pre}oylar soni mos emas: ${cur.length} kutildi, ${inc.length} keldi`,
    );
  }
  cur.forEach((m, i) => {
    if (normMonth(inc[i].month) !== normMonth(m.month)) {
      throw new ErrorHandler(
        400,
        `${pre}${i + 1}-oy nomi mos emas: "${m.month}" kutildi, "${inc[i].month}" keldi`,
      );
    }
    if (!Number.isInteger(inc[i].count) || inc[i].count < 1) {
      throw new ErrorHandler(
        400,
        `${pre}"${m.month}" uchun haftalar soni butun va kamida 1 bo'lishi kerak`,
      );
    }
  });
  const total = totalWeeks(course);
  const sum = inc.reduce((s, c) => s + c.count, 0);
  if (sum !== total) {
    throw new ErrorHandler(
      400,
      `${pre}haftalar yig'indisi ${total} bo'lishi kerak (hozir ${sum})`,
    );
  }
  return inc;
};

const redistributeMonths = (course, counts, label) => {
  const inc = validateCounts(course, counts, label);
  const oldKeys = new Map();
  for (const m of course.months || []) {
    for (const w of m.weeks || []) {
      if (w && w.week != null) oldKeys.set(Number(w.week), w.key);
    }
  }
  let weekNo = 1;
  return inc.map((c, i) => {
    const weeks = [];
    for (let k = 0; k < c.count; k++) {
      const fromMap = weekKeyFromMap(course.weeks, weekNo);
      const key = fromMap ?? oldKeys.get(weekNo) ?? " ";
      weeks.push({ week: weekNo, key });
      weekNo += 1;
    }
    return { month: course.months[i].month, weeks };
  });
};

const equalCounts = (monthNames, total) => {
  const n = monthNames.length || 1;
  const base = Math.floor(total / n);
  const extra = total % n;
  return monthNames.map((month, i) => ({ month, count: base + (i < extra ? 1 : 0) }));
};

const planCourses = (courses, counts) =>
  (Array.isArray(courses) ? courses : []).map((c, i) => ({
    _id: c._id,
    months: redistributeMonths(c, counts, c.course ? `${c.course} kurs` : `${i + 1}-kurs`),
  }));

const buildCoursesUpdate = (plans) => {
  const $set = {};
  const arrayFilters = [];
  plans.forEach((p, i) => {
    $set[`courses.$[c${i}].months`] = p.months;
    arrayFilters.push({ [`c${i}._id`]: p._id });
  });
  return { update: { $set }, arrayFilters };
};

module.exports = {
  normMonth,
  monthCounts,
  totalWeeks,
  validateCounts,
  redistributeMonths,
  equalCounts,
  planCourses,
  buildCoursesUpdate,
};
