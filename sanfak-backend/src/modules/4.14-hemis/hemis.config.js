const BASE_URL = () =>
  (process.env.HEMIS_API_URL || "https://student.fjsti.uz/rest/v1/data").replace(/\/+$/, "");
const TOKEN = () => process.env.HEMIS_API_TOKEN || "";

// HEMIS ro'yxatlari: kalit — saqlanadigan tur nomi, `path` — endpoint, `query` — majburiy parametrlar.
// heavy: juda katta ro'yxat — faqat qo'lda yoki haftalik ishga tushiriladi.
const TYPES = {
  department: { path: "department-list" },
  specialty: { path: "specialty-list" },
  curriculum: { path: "curriculum-list" },
  group: { path: "group-list" },
  semester: { path: "semester-list" },
  auditorium: { path: "auditorium-list" },
  // bir xodim bir nechta lavozimda bo'lsa `id` takrorlanadi — har lavozim qatori `meta_id` bilan ajraladi
  employee: { path: "employee-list", query: { type: "all" }, key: "meta_id" },
  student: { path: "student-list" },
  subject: { path: "subject-list" },
  curriculumSubject: { path: "curriculum-subject-list" },
  schedule: { path: "schedule-list" },
  attendance: { path: "attendance-list" },
  studentGpa: { path: "student-gpa-list" },
  exam: { path: "exam-list" },
  studentPerformance: { path: "student-performance-list", heavy: true },
};

const REGULAR_TYPES = Object.keys(TYPES).filter((t) => !TYPES[t].heavy);
const HEAVY_TYPES = Object.keys(TYPES).filter((t) => TYPES[t].heavy);

module.exports = { BASE_URL, TOKEN, TYPES, REGULAR_TYPES, HEAVY_TYPES, PAGE_SIZE: 200 };
