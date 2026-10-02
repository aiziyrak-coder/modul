const fs = require("fs");
const path = require("path");

const BASE = "{{baseUrl}}";

function req(method, name, url, body = null, params = []) {
  const item = {
    name,
    request: {
      method,
      header: body ? [{ key: "Content-Type", value: "application/json" }] : [],
      url: {
        raw: `${BASE}/${url}`,
        host: [`${BASE}`],
        path: url.split("/"),
        query: params.map((p) => ({ key: p.key, value: p.value, disabled: !p.active })),
      },
    },
    response: [],
  };
  if (body) {
    item.request.body = { mode: "raw", raw: JSON.stringify(body, null, 2), options: { raw: { language: "json" } } };
  }
  return item;
}

function folder(name, items) {
  return { name, item: items };
}

const multiLang = (uz, ru = "", eng = "") => ({ uz, ru, eng });
const ID = "{{id}}";
const TEACHER_ID = "{{teacherId}}";
const USER_ID = "{{userId}}";

const collection = {
  info: {
    name: "SANFAK — To'liq API",
    description: "SANFAK backend barcha endpointlari. baseUrl va token variable o'rnating.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000/api", type: "string" },
    { key: "token",   value: "",   type: "string" },
    { key: "id",      value: "64f1a2b3c4d5e6f7a8b9c0d1", type: "string" },
  ],
  auth: {
    type: "bearer",
    bearer: [{ key: "token", value: "{{token}}", type: "string" }],
  },
  item: [

    folder("1. Auth", [
      req("POST", "Login", "auth", { oneIdPin: "00000000000000" }),
      req("POST", "Token yangilash (Refresh)", "auth/refresh", { refreshToken: "{{refreshToken}}" }),
      req("GET",  "Profil ko'rish", "auth/profile"),
      req("PUT",  "Profil yangilash", "auth/profile", {
        firstName: "Test", lastName: "User", phone: "+998901234567",
      }),
    ]),

    folder("2. Foydalanuvchilar (User)", [
      req("POST", "Foydalanuvchi yaratish", "users", {
        firstName: "Sardor", lastName: "Toshmatov", middleName: "Aliyevich",
        oneIdPin: "12345678901234", role: ID, phone: "+998901112233", email: "sardor@sanfak.uz",
      }),
      req("GET",  "Barcha foydalanuvchilar", "users", null, [
        { key: "search", value: "", active: false },
        { key: "role",   value: "", active: false },
      ]),
      req("GET",  "Foydalanuvchilar (paginate)", "users/paginate", null, [
        { key: "page", value: "1", active: true },
        { key: "limit", value: "10", active: true },
        { key: "search", value: "", active: false },
      ]),
      req("GET",  "Foydalanuvchi ko'rish", `users/${ID}`),
      req("PUT",  "Foydalanuvchi yangilash", `users/${ID}`, {
        firstName: "Yangi", lastName: "Ism", phone: "+998901234567",
      }),
      req("PUT",  "Status o'zgartirish (active/block)", `users/active/${ID}`, { active: false }),
      req("DELETE","Foydalanuvchi o'chirish", `users/${ID}`),
    ]),

    folder("3. Rol & Ruxsat", [
      folder("Role", [
        req("POST", "Rol yaratish", "roles", {
          title: "yangi_rol", desc: "Yangi rol tavsifi",
          permissions: [{ section: "reference", actionKeys: ["readAll", "read"] }],
        }),
        req("GET",  "Barcha rollar", "roles"),
        req("GET",  "Rollar (paginate)", "roles/paginate"),
        req("GET",  "Rol ko'rish", `roles/${ID}`),
        req("GET",  "Foydalanuvchi roli", `roles/user/${USER_ID}`),
        req("PUT",  "Rol yangilash", `roles/${ID}`, { desc: "Yangilangan tavsif" }),
        req("DELETE","Rol o'chirish", `roles/${ID}`),
      ]),
      folder("Permission", [
        req("POST", "Permission yaratish", "permissions", {
          section: "newSection", actionKeys: ["create", "readAll", "read", "update", "delete"],
        }),
        req("GET",  "Barcha permissionlar", "permissions"),
        req("GET",  "Permissionlar (paginate)", "permissions/paginate"),
        req("GET",  "Permission ko'rish", `permissions/${ID}`),
        req("PUT",  "Permission yangilash", `permissions/${ID}`, { actionKeys: ["readAll", "read"] }),
        req("DELETE","Permission o'chirish", `permissions/${ID}`),
      ]),
    ]),

    folder("4. Reference", [
      folder("Fakultet", [
        req("POST", "Yaratish", "faculties", { title: multiLang("Stomatologiya fakulteti", "Стоматологический факультет", "Faculty of Dentistry") }),
        req("GET",  "Barchasi", "faculties"),
        req("GET",  "Paginate", "faculties/paginate"),
        req("GET",  "Ko'rish", `faculties/${ID}`),
        req("PUT",  "Yangilash", `faculties/${ID}`, { title: multiLang("Yangilangan Fakultet") }),
        req("DELETE","O'chirish", `faculties/${ID}`),
      ]),
      folder("Kafedra (Department)", [
        req("POST", "Yaratish", "departments", { title: multiLang("Stomatologiya kafedrasi", "Кафедра стоматологии"), faculty: ID }),
        req("GET",  "Barchasi", "departments", null, [{ key: "faculty", value: "", active: false }]),
        req("GET",  "Paginate", "departments/paginate"),
        req("GET",  "Ko'rish", `departments/${ID}`),
        req("PUT",  "Yangilash", `departments/${ID}`, { title: multiLang("Yangi Kafedra") }),
        req("DELETE","O'chirish", `departments/${ID}`),
      ]),
      folder("Fan (Science)", [
        req("POST", "Yaratish", "sciences", { title: multiLang("Terapevtik stomatologiya", "Терапевтическая стоматология"), department: ID }),
        req("GET",  "Barchasi", "sciences"),
        req("GET",  "Paginate", "sciences/paginate"),
        req("GET",  "Ko'rish", `sciences/${ID}`),
        req("PUT",  "Yangilash", `sciences/${ID}`, { title: multiLang("Yangilangan Fan") }),
        req("DELETE","O'chirish", `sciences/${ID}`),
      ]),
      folder("Yo'nalish (Direction)", [
        req("POST", "Yaratish", "directions", { title: multiLang("Stomatologiya", "Стоматология", "Dentistry"), faculty: ID }),
        req("GET",  "Barchasi", "directions"),
        req("GET",  "Paginate", "directions/paginate"),
        req("GET",  "Ko'rish", `directions/${ID}`),
        req("PUT",  "Yangilash", `directions/${ID}`, { title: multiLang("Yangi Yo'nalish") }),
        req("DELETE","O'chirish", `directions/${ID}`),
      ]),
      folder("Bo'linma (Division)", [
        req("POST", "Yaratish", "divisions", { title: multiLang("Ilmiy bo'lim", "Научный отдел") }),
        req("GET",  "Barchasi", "divisions"),
        req("GET",  "Paginate", "divisions/paginate"),
        req("GET",  "Ko'rish", `divisions/${ID}`),
        req("PUT",  "Yangilash", `divisions/${ID}`, { title: multiLang("Yangi Bo'linma") }),
        req("DELETE","O'chirish", `divisions/${ID}`),
      ]),
      folder("Kurs (Course)", [
        req("POST", "Yaratish", "courses", { title: multiLang("1-kurs", "1-курс", "1st Year") }),
        req("GET",  "Barchasi", "courses"),
        req("GET",  "Paginate", "courses/paginate"),
        req("GET",  "Ko'rish", `courses/${ID}`),
        req("PUT",  "Yangilash", `courses/${ID}`, { title: multiLang("2-kurs") }),
        req("DELETE","O'chirish", `courses/${ID}`),
      ]),
      folder("Lavozim (Position)", [
        req("POST", "Yaratish", "positions", { title: multiLang("Professor", "Профессор", "Professor") }),
        req("GET",  "Barchasi", "positions"),
        req("GET",  "Paginate", "positions/paginate"),
        req("GET",  "Ko'rish", `positions/${ID}`),
        req("PUT",  "Yangilash", `positions/${ID}`, { title: multiLang("Dotsent") }),
        req("DELETE","O'chirish", `positions/${ID}`),
      ]),
      folder("Xona (Room)", [
        req("POST", "Yaratish", "rooms", { title: multiLang("101-xona", "Аудитория 101"), building: multiLang("Asosiy bino"), capacity: 100, type: "lecture" }),
        req("GET",  "Barchasi", "rooms"),
        req("GET",  "Paginate", "rooms/paginate"),
        req("GET",  "Ko'rish", `rooms/${ID}`),
        req("PUT",  "Yangilash", `rooms/${ID}`, { capacity: 120 }),
        req("DELETE","O'chirish", `rooms/${ID}`),
      ]),
      folder("Guruh (Group)", [
        req("POST", "Yaratish", "groups", { title: multiLang("Stom-101", "Стом-101"), direction: ID, course: ID, lang: "uzb", studentNumber: 25 }),
        req("GET",  "Barchasi", "groups", null, [{ key: "direction", value: "", active: false }, { key: "course", value: "", active: false }]),
        req("GET",  "Paginate", "groups/paginate"),
        req("GET",  "Ko'rish", `groups/${ID}`),
        req("PUT",  "Yangilash", `groups/${ID}`, { studentNumber: 27 }),
        req("DELETE","O'chirish", `groups/${ID}`),
      ]),
      folder("Akademik daraja (AcademicLevel)", [
        req("POST", "Yaratish", "academic-levels", { title: multiLang("Bakalavr", "Бакалавр", "Bachelor") }),
        req("GET",  "Barchasi", "academic-levels"),
        req("GET",  "Paginate", "academic-levels/paginate"),
        req("GET",  "Ko'rish", `academic-levels/${ID}`),
        req("PUT",  "Yangilash", `academic-levels/${ID}`, { title: multiLang("Magistr") }),
        req("DELETE","O'chirish", `academic-levels/${ID}`),
      ]),
      folder("Ta'lim shakli (EducationForm)", [
        req("POST", "Yaratish", "education-forms", { title: multiLang("Kunduzgi", "Очная", "Full-time") }),
        req("GET",  "Barchasi", "education-forms"),
        req("GET",  "Paginate", "education-forms/paginate"),
        req("GET",  "Ko'rish", `education-forms/${ID}`),
        req("PUT",  "Yangilash", `education-forms/${ID}`, { title: multiLang("Sirtqi") }),
        req("DELETE","O'chirish", `education-forms/${ID}`),
      ]),
      folder("O'qish shakli (ReadingForm)", [
        req("POST", "Yaratish", "reading-forms", { title: multiLang("Ma'ruza", "Лекция", "Lecture") }),
        req("GET",  "Barchasi", "reading-forms"),
        req("GET",  "Paginate", "reading-forms/paginate"),
        req("GET",  "Ko'rish", `reading-forms/${ID}`),
        req("PUT",  "Yangilash", `reading-forms/${ID}`, { title: multiLang("Seminar") }),
        req("DELETE","O'chirish", `reading-forms/${ID}`),
      ]),
      folder("Ixtisoslik (Specialization)", [
        req("POST", "Yaratish", "specializations", { title: multiLang("Kardiolog", "Кардиолог", "Cardiologist") }),
        req("GET",  "Barchasi", "specializations"),
        req("GET",  "Paginate", "specializations/paginate"),
        req("GET",  "Ko'rish", `specializations/${ID}`),
        req("PUT",  "Yangilash", `specializations/${ID}`, { title: multiLang("Nevropatolog") }),
        req("DELETE","O'chirish", `specializations/${ID}`),
      ]),
      folder("O'quv davri (StudyPeriod)", [
        req("POST", "Yaratish", "studyPeriods", { title: multiLang("6 yil", "6 лет", "6 years") }),
        req("GET",  "Barchasi", "studyPeriods"),
        req("GET",  "Paginate", "studyPeriods/paginate"),
        req("GET",  "Ko'rish", `studyPeriods/${ID}`),
        req("PUT",  "Yangilash", `studyPeriods/${ID}`, { title: multiLang("2 yil") }),
        req("DELETE","O'chirish", `studyPeriods/${ID}`),
      ]),
      folder("O'quv yili (SchoolYear)", [
        req("POST", "Yaratish", "school-years", { title: "2024-2025" }),
        req("GET",  "Barchasi", "school-years"),
        req("GET",  "Paginate", "school-years/paginate"),
        req("GET",  "Ko'rish", `school-years/${ID}`),
        req("PUT",  "Yangilash", `school-years/${ID}`, { active: false }),
        req("DELETE","O'chirish", `school-years/${ID}`),
      ]),
    ]),

    folder("5. Dars Jadvali (Schedule)", [
      folder("TimeSlot", [
        req("POST", "Yaratish", "time-slots", { title: multiLang("1-juft", "1-я пара", "1st Period"), startTime: "08:00", endTime: "09:30", order: 1 }),
        req("GET",  "Barchasi", "time-slots"),
        req("PUT",  "Yangilash", `time-slots/${ID}`, { startTime: "08:30" }),
        req("DELETE","O'chirish", `time-slots/${ID}`),
      ]),
      folder("Schedule", [
        req("POST", "Jadval yaratish", "schedule", {
          group: ID, teacher: USER_ID, science: ID, room: ID, timeSlot: ID,
          dayOfWeek: 1, academicYear: "2024-2025", lessonType: "maruza", semester: 1, weekType: "both",
        }),
        req("GET",  "Barchasi", "schedule", null, [
          { key: "group", value: "", active: false },
          { key: "teacher", value: "", active: false },
          { key: "academicYear", value: "2024-2025", active: true },
        ]),
        req("GET",  "Paginate", "schedule/paginate"),
        req("GET",  "Guruh jadvali", `schedule/group/${ID}`),
        req("GET",  "O'qituvchi jadvali", `schedule/teacher/${TEACHER_ID}`),
        req("POST", "Konflikt tekshirish", "schedule/check-conflict", {
          group: ID, teacher: USER_ID, timeSlot: ID, dayOfWeek: 1, semester: 1, academicYear: "2024-2025",
        }),
        req("GET",  "Ko'rish", `schedule/${ID}`),
        req("PUT",  "Yangilash", `schedule/${ID}`, { room: ID }),
        req("DELETE","O'chirish", `schedule/${ID}`),
      ]),
    ]),

    folder("6. O'qituvchi (Teacher)", [
      folder("Teacher Profile", [
        req("POST", "Yaratish", "teachers", {
          user: USER_ID, department: ID, faculty: ID, position: ID,
          employmentType: "asosiy", academicDegree: "falsafa_doktori", academicTitle: "dotsent",
          gender: "male", birthDate: "1980-03-15",
          contactInfo: { phone: "+998901112233", email: "teacher@sanfak.uz" },
        }),
        req("GET",  "Barchasi", "teachers", null, [
          { key: "department", value: "", active: false },
          { key: "search", value: "", active: false },
        ]),
        req("GET",  "Paginate", "teachers/paginate"),
        req("GET",  "Ko'rish", `teachers/${ID}`),
        req("PUT",  "Yangilash", `teachers/${ID}`, { academicTitle: "professor" }),
        req("PATCH","Tasdiqlash (HR approve)", `teachers/${ID}/approve`, { comment: "Ma'lumotlar to'g'ri" }),
        req("PATCH","Rad etish (HR reject)", `teachers/${ID}/reject`, { comment: "Hujjatlar to'liq emas" }),
        req("GET",  "PDF yuklab olish", `teachers/${ID}/pdf`),
        req("DELETE","O'chirish", `teachers/${ID}`),
      ]),
      folder("Personal Work Plan", [
        req("POST", "Yaratish", "personal-work-plans", { teacher: ID, academicYear: "2024-2025" }),
        req("POST", "Generate qilish", "personal-work-plans/generate", { teacher: ID, academicYear: "2024-2025" }),
        req("GET",  "Barchasi", "personal-work-plans"),
        req("GET",  "Paginate", "personal-work-plans/paginate"),
        req("GET",  "Ko'rish", `personal-work-plans/${ID}`),
        req("PUT",  "Yangilash", `personal-work-plans/${ID}`, { goals: [{ title: "Maqola yozish" }] }),
        req("POST", "Yuborish (submit)", `personal-work-plans/${ID}/submit`),
        req("PATCH","Tasdiqlash", `personal-work-plans/${ID}/approve`, { comment: "Tasdiqlandi" }),
        req("PATCH","Rad etish", `personal-work-plans/${ID}/reject`, { comment: "Qayta ishlang" }),
        req("PATCH","Qayta ochish", `personal-work-plans/${ID}/reopen`),
        req("DELETE","O'chirish", `personal-work-plans/${ID}`),
      ]),
    ]),

    folder("7. Talaba (Student)", [
      folder("Student", [
        req("POST", "Yaratish", "students", {
          firstName: "Bobur", lastName: "Xoliqov", middleName: "Davronovich",
          studentId: "STD-2024-001", user: USER_ID, group: ID, faculty: ID, direction: ID,
          course: 1, semester: 1, enrollmentYear: 2024,
          educationForm: "kunduzgi", studyType: "grant", gender: "male",
        }),
        req("GET",  "Barchasi", "students", null, [
          { key: "group", value: "", active: false },
          { key: "status", value: "", active: false },
          { key: "search", value: "", active: false },
        ]),
        req("GET",  "Paginate", "students/paginate"),
        req("GET",  "Guruh statistikasi", `students/group/${ID}/stats`),
        req("GET",  "Ko'rish", `students/${ID}`),
        req("PUT",  "Yangilash", `students/${ID}`, { course: 2, semester: 3 }),
        req("PATCH","Status o'zgartirish", `students/${ID}/status`, { status: "leave", statusChangeReason: "Akademik ta'til" }),
        req("GET",  "PDF", `students/${ID}/pdf`),
        req("DELETE","O'chirish", `students/${ID}`),
      ]),
      folder("Talaba Davomati", [
        req("POST", "Jurnal yaratish", "student-attendance", { group: ID, science: ID, teacher: USER_ID, date: "2025-03-10" }),
        req("GET",  "Barchasi", "student-attendance"),
        req("GET",  "Ko'rish", `student-attendance/${ID}`),
        req("PUT",  "Yangilash", `student-attendance/${ID}`, { attendances: [{ student: ID, status: "present" }] }),
        req("DELETE","O'chirish", `student-attendance/${ID}`),
        req("GET",  "Talaba statistikasi", `student-attendance/student/${ID}/stats`),
      ]),
    ]),

    folder("8. O'quv Yuklamasi (Study Load)", [
      folder("O'quv jarayon (LearningProcess)", [
        req("POST", "XLSX parse qilish", "learning-process/parse", { fileUrl: "/uploads/file/oquv_jarayon.xlsx" }),
        req("POST", "Yaratish", "learning-process", { group: ID, academicYear: "2024-2025", direction: ID }),
        req("GET",  "Barchasi", "learning-process"),
        req("GET",  "Paginate", "learning-process/paginate"),
        req("GET",  "Study plan bilan", "learning-process/study-plan"),
        req("GET",  "Ko'rish", `learning-process/${ID}`),
        req("PUT",  "Yangilash", `learning-process/${ID}`, { academicYear: "2025-2026" }),
        req("PUT",  "Maxsus qism yangilash", `learning-process/special-part/${ID}`, { specialPart: {} }),
        req("PUT",  "Study plan yangilash", `learning-process/study-plan/${ID}`, { studyPlan: ID }),
        req("PUT",  "Tasdiqlash", `learning-process/${ID}/approve`),
        req("DELETE","O'chirish", `learning-process/${ID}`),
      ]),
      folder("O'quv reja (StudyPlan)", [
        req("POST", "Yaratish", "study-plans", { learningProcess: ID }),
        req("GET",  "Barchasi", "study-plans"),
        req("GET",  "Paginate", "study-plans/paginate"),
        req("GET",  "Ko'rish", `study-plans/${ID}`),
        req("PUT",  "Yangilash", `study-plans/${ID}`, { status: "approved" }),
        req("PUT",  "Tasdiqlash", `study-plans/${ID}/approve`),
        req("DELETE","O'chirish", `study-plans/${ID}`),
      ]),
      folder("Ish reja (WorkingPlan)", [
        req("POST", "Yaratish", "working-plans", { department: ID, academicYear: "2024-2025" }),
        req("GET",  "Barchasi", "working-plans"),
        req("GET",  "Paginate", "working-plans/paginate"),
        req("GET",  "Reja (plan)", "working-plans/plan"),
        req("GET",  "Fan ro'yxati", "working-plans/science"),
        req("GET",  "Fan ma'lumoti", "working-plans/science-info"),
        req("GET",  "Ko'rish", `working-plans/${ID}`),
        req("PUT",  "Yangilash", `working-plans/${ID}`, {}),
        req("PUT",  "Fan yangilash", `working-plans/science/${ID}`, {}),
        req("PUT",  "Qism ko'rish", `working-plans/part/${ID}`),
        req("PUT",  "Qism yangilash", `working-plans/part/${ID}`, {}),
        req("PUT",  "Tasdiqlash", `working-plans/${ID}/approve`),
        req("POST", "Yuborish", `working-plans/${ID}/submit`),
        req("PATCH","Qadam tasdiqlash", `working-plans/${ID}/approve-step`, { step: "kafedra", comment: "OK" }),
        req("PATCH","Qadam rad etish", `working-plans/${ID}/reject-step`, { step: "kafedra", comment: "Qayta" }),
        req("PATCH","Qayta ochish", `working-plans/${ID}/reopen`),
        req("GET",  "PDF", `working-plans/${ID}/pdf`),
        req("DELETE","O'chirish", `working-plans/${ID}`),
      ]),
      folder("Yuklama (Workload)", [
        req("POST", "Yaratish", "workloads", { department: ID, academicYear: "2024-2025", date: "2024-09-01" }),
        req("GET",  "Barchasi", "workloads"),
        req("GET",  "Paginate", "workloads/paginate"),
        req("GET",  "Ko'rish", `workloads/${ID}`),
        req("PUT",  "Yangilash", `workloads/${ID}`, {}),
        req("POST", "Yuborish (submit)", "workloads/submit", { id: ID }),
        req("PUT",  "Qadam tasdiqlash", `workloads/${ID}/approve-step`, { step: "methodical", comment: "OK" }),
        req("POST", "Qadam rad etish", "workloads/reject-step", { id: ID, step: "methodical", comment: "Qayta" }),
        req("PUT",  "Qayta ochish", `workloads/${ID}/reopen`),
        req("GET",  "PDF", `workloads/${ID}/pdf`),
        req("DELETE","O'chirish", `workloads/${ID}`),
      ]),
      folder("Yuklama taqsimoti (WorkloadDistribution)", [
        req("POST", "Yaratish", "distributions", { workload: ID, academicYear: "2024-2025" }),
        req("GET",  "Barchasi", "distributions"),
        req("GET",  "Paginate", "distributions/paginate"),
        req("GET",  "Ko'rish", `distributions/${ID}`),
        req("PUT",  "Yangilash", `distributions/${ID}`, {}),
        req("POST", "O'qituvchi qo'shish", `distributions/${ID}/teachers`, { teacher: TEACHER_ID }),
        req("DELETE","O'qituvchi o'chirish", `distributions/${ID}/teachers/{{teacherEntryId}}`),
        req("POST", "Blok tayinlash", `distributions/${ID}/teachers/{{teacherEntryId}}/blocks`, { blockId: ID }),
        req("DELETE","Blok o'chirish", `distributions/${ID}/teachers/{{teacherEntryId}}/blocks/{{blockId}}`),
        req("PATCH","O'qituvchi javobi", `distributions/${ID}/teachers/{{teacherEntryId}}/respond`, { response: "accepted" }),
        req("PATCH","Bo'shatish (vacate)", `distributions/${ID}/vacate/{{teacherEntryId}}`),
        req("POST", "Yuborish (submit)", "distributions/submit", { id: ID }),
        req("PATCH","Qadam tasdiqlash", `distributions/${ID}/approve-step`, { step: "methodical" }),
        req("POST", "Qadam rad etish", "distributions/reject-step", { id: ID, step: "methodical", comment: "" }),
        req("PATCH","Qayta ochish", `distributions/${ID}/reopen`),
        req("GET",  "PDF", `distributions/${ID}/pdf`),
        req("DELETE","O'chirish", `distributions/${ID}`),
      ]),
      folder("Sillabus (Syllabus)", [
        req("GET",  "Mening fanlarim", "syllabi/my-sciences"),
        req("POST", "Yaratish", "syllabi", { science: ID, faculty: ID, scienceTitle: "Terapevtik stomatologiya", year: 1, semester: 1 }),
        req("GET",  "Barchasi", "syllabi"),
        req("GET",  "Paginate", "syllabi/paginate"),
        req("GET",  "Ko'rish", `syllabi/${ID}`),
        req("PUT",  "Yangilash", `syllabi/${ID}`, { credits: 4 }),
        req("POST", "Yuborish", `syllabi/${ID}/submit`),
        req("PATCH","Qadam tasdiqlash", `syllabi/${ID}/approve-step`, { step: "kafedra" }),
        req("PATCH","Qadam rad etish", `syllabi/${ID}/reject-step`, { step: "kafedra", comment: "Qayta" }),
        req("PATCH","Qayta ochish", `syllabi/${ID}/reopen`),
        req("GET",  "PDF", `syllabi/${ID}/pdf`),
        req("DELETE","O'chirish", `syllabi/${ID}`),
      ]),
      folder("Fan dasturi (ScienceProgram)", [
        req("GET",  "Mening fanlarim", "science-programs/my-sciences"),
        req("POST", "Yaratish", "science-programs", { science: ID, faculty: ID, academicYear: "2024-2025" }),
        req("GET",  "Barchasi", "science-programs"),
        req("GET",  "Paginate", "science-programs/paginate"),
        req("GET",  "Ko'rish", `science-programs/${ID}`),
        req("PUT",  "Yangilash", `science-programs/${ID}`, { fileUrl: "/uploads/prog.pdf" }),
        req("POST", "Yuborish", `science-programs/${ID}/submit`),
        req("PATCH","Qadam tasdiqlash", `science-programs/${ID}/approve-step`, { step: "kafedra" }),
        req("PATCH","Qadam rad etish", `science-programs/${ID}/reject-step`, { step: "kafedra" }),
        req("PATCH","Qayta ochish", `science-programs/${ID}/reopen`),
        req("GET",  "PDF", `science-programs/${ID}/pdf`),
        req("DELETE","O'chirish", `science-programs/${ID}`),
      ]),
      folder("O'qituvchi ta'tili (TeacherLeave)", [
        req("POST", "Yaratish", "teacher-leaves", { teacher: USER_ID, type: "leave", fromDate: "2025-02-10", toDate: "2025-02-15", reason: "Shaxsiy sabab" }),
        req("GET",  "Barchasi", "teacher-leaves"),
        req("GET",  "Paginate", "teacher-leaves/paginate"),
        req("GET",  "Ko'rish", `teacher-leaves/${ID}`),
        req("PATCH","Tasdiqlash", `teacher-leaves/${ID}/approve`, { comment: "Tasdiqlandi" }),
        req("PATCH","Rad etish", `teacher-leaves/${ID}/reject`, { comment: "Asossiz" }),
        req("GET",  "PDF", `teacher-leaves/${ID}/pdf`),
        req("DELETE","O'chirish", `teacher-leaves/${ID}`),
      ]),
      folder("Ish jadvali (WorkingSchedule)", [
        req("GET",  "Barchasi", "working-schedules"),
        req("GET",  "Paginate", "working-schedules/paginate"),
        req("GET",  "Ko'rish", `working-schedules/${ID}`),
        req("PATCH","Status", `working-schedules/${ID}/status`, { status: "active" }),
        req("GET",  "PDF", `working-schedules/${ID}/pdf`),
      ]),
    ]),

    folder("9. Rezidentura (Residency)", [
      folder("Rezident", [
        req("POST", "Yaratish", "residents", { user: USER_ID, educationType: "kunduzgi", specialty: ID, course: ID, supervisor: ID }),
        req("GET",  "Barchasi", "residents"),
        req("GET",  "Paginate", "residents/paginate"),
        req("GET",  "Ko'rish", `residents/${ID}`),
        req("PUT",  "Yangilash", `residents/${ID}`, { totalUnexcusedHours: 2 }),
        req("DELETE","O'chirish", `residents/${ID}`),
      ]),
      folder("Rezident arizasi", [
        req("POST", "Ariza yuborish", "applications", { resident: ID, type: "academic_leave", reason: "Shaxsiy sabab" }),
        req("GET",  "Barchasi", "applications"),
        req("GET",  "Paginate", "applications/paginate"),
        req("PUT",  "Ko'rib chiqish", `applications/${ID}/review`, { status: "approved" }),
      ]),
      folder("Kundalik jurnal (DailyLog)", [
        req("POST", "Yaratish", "daily-logs", { resident: ID, date: "2025-03-10", clinicalWork: "Bemorlar qabuli", supervisorApproved: false }),
        req("GET",  "Rezident jurnallari", `daily-logs/resident/${ID}`),
        req("PUT",  "Yangilash", `daily-logs/${ID}`, { clinicalWork: "Yangilangan" }),
        req("PUT",  "Tasdiqlash", `daily-logs/${ID}/approve`),
      ]),
      folder("Davomat (Attendance)", [
        req("POST", "Davomat qo'shish", "attendance", { resident: ID, date: "2025-03-10", status: "present", hours: 8 }),
        req("GET",  "Barchasi (paginate)", "attendance/paginate"),
        req("GET",  "Rezident davomati", `attendance/resident/${ID}`),
        req("GET",  "Rezident statistikasi", `attendance/resident/${ID}/stats`),
        req("PUT",  "Yangilash", `attendance/${ID}`, { status: "excused" }),
        req("PUT",  "Uzr tasdiqlash", `attendance/${ID}/approve-excuse`, { approved: true }),
      ]),
      folder("Baholash (Assessment)", [
        req("POST", "Yaratish", "assessments", { resident: ID, science: ID, type: "oraliq", score: 85, maxScore: 100 }),
        req("GET",  "Rezident baholari", `assessments/resident/${ID}`),
        req("PUT",  "Yangilash", `assessments/${ID}`, { score: 90 }),
      ]),
      folder("Resurs", [
        req("POST", "Yaratish", "resources", { title: multiLang("Kardiologiya darsligi"), category: "lecture", fileUrl: "/uploads/r.pdf", department: ID }),
        req("GET",  "Barchasi", "resources"),
        req("GET",  "Paginate", "resources/paginate"),
        req("GET",  "Ko'rish", `resources/${ID}`),
        req("PUT",  "Yangilash", `resources/${ID}`, { category: "video" }),
        req("DELETE","O'chirish", `resources/${ID}`),
      ]),
      folder("Dissertatsiya", [
        req("POST", "Yaratish", "dissertations", { magistrant: ID, supervisor: TEACHER_ID, topic: "Tadqiqot mavzusi" }),
        req("GET",  "Barchasi", "dissertations"),
        req("GET",  "Paginate", "dissertations/paginate"),
        req("GET",  "Ko'rish", `dissertations/${ID}`),
        req("PUT",  "Ish rejasi yuklash", `dissertations/${ID}/upload-work-plan`, { fileUrl: "/uploads/workplan.pdf" }),
        req("PUT",  "Ish rejasi tasdiqlash", `dissertations/${ID}/approve-work-plan`),
        req("PUT",  "Milestone topshirish", `dissertations/${ID}/submit-milestone`, { milestoneIndex: 0, fileUrl: "/uploads/m1.pdf" }),
        req("PUT",  "Supervisor sharhi", `dissertations/${ID}/supervisor-review`, { milestoneIndex: 0, comment: "Yaxshi", status: "approved" }),
        req("PUT",  "Ochiq dars", `dissertations/${ID}/open-lesson`, { date: "2025-04-20", auditorium: "301-xona", topic: "Taqdimot" }),
        req("DELETE","O'chirish", `dissertations/${ID}`),
      ]),
    ]),

    folder("10. Institut Kengashi", [
      folder("Kengash a'zosi", [
        req("POST", "Yaratish", "members", { user: USER_ID, role: "A'zo", position: "Professor", startDate: "2024-01-01" }),
        req("GET",  "Barchasi", "members"),
        req("PUT",  "Yangilash", `members/${ID}`, { role: "Rais" }),
        req("DELETE","O'chirish", `members/${ID}`),
      ]),
      folder("Kengash vazifasi", [
        req("POST", "Yaratish", "council-tasks", { title: multiLang("Hisobot tayyorlash"), assignee: USER_ID, deadline: "2025-05-30" }),
        req("GET",  "Barchasi", "council-tasks"),
        req("GET",  "Paginate", "council-tasks/paginate"),
        req("GET",  "Ko'rish", `council-tasks/${ID}`),
        req("PUT",  "Yangilash", `council-tasks/${ID}`, { status: "in_progress" }),
        req("PUT",  "Yakunlash", `council-tasks/${ID}/complete`, { resultFiles: ["/uploads/result.pdf"] }),
        req("DELETE","O'chirish", `council-tasks/${ID}`),
      ]),
      folder("Unvon arizasi (RankApplication)", [
        req("POST", "Ariza yuborish", "rank-applications", { applicant: USER_ID, rankType: "professor" }),
        req("GET",  "Barchasi", "rank-applications"),
        req("GET",  "Paginate", "rank-applications/paginate"),
        req("GET",  "Ko'rish", `rank-applications/${ID}`),
        req("PUT",  "Ko'rib chiqish", `rank-applications/${ID}/review`, { status: "approved" }),
      ]),
      folder("Ovoz berish sessiyasi (VotingSession)", [
        req("POST", "Yaratish", "voting-sessions", {
          title: multiLang("Professor unvoni berish"), startDate: "2025-04-10T09:00:00", endDate: "2025-04-10T18:00:00",
          candidates: [{ user: USER_ID, title: multiLang("Sardor Toshmatov") }], passingPercent: 67,
        }),
        req("GET",  "Barchasi", "voting-sessions"),
        req("GET",  "Ko'rish", `voting-sessions/${ID}`),
        req("PUT",  "Yangilash", `voting-sessions/${ID}`, { status: "active" }),
        req("PUT",  "Boshlash", `voting-sessions/${ID}/start`),
        req("PUT",  "Yakunlash", `voting-sessions/${ID}/end`),
        req("DELETE","O'chirish", `voting-sessions/${ID}`),
      ]),
      folder("Ovoz berish (AnonymousVote)", [
        req("POST", "Ovoz berish", "votes", { session: ID, candidate: USER_ID, choice: "for" }),
        req("GET",  "Natijalar", `votes/results/${ID}`),
      ]),
    ]),

    folder("11. Ilmiy Kengash (Scientific Council)", [
      folder("Ilmiy ish (ScientificWork)", [
        req("POST", "Yaratish", "works", { title: multiLang("Ilmiy ish nomi"), researcher: USER_ID, type: "monograph" }),
        req("GET",  "Barchasi", "works"),
        req("GET",  "Paginate", "works/paginate"),
        req("GET",  "Ko'rish", `works/${ID}`),
        req("PUT",  "Yangilash", `works/${ID}`, { status: "seminar" }),
        req("DELETE","O'chirish", `works/${ID}`),
      ]),
      folder("Ko'rib chiqish (WorkReview)", [
        req("POST", "Yaratish", "reviews", { work: ID, member: USER_ID, section: "Ilmiy ahamiyati", comment: "Yaxshi ish", score: 90 }),
        req("GET",  "Ish sharhlari", `reviews/work/${ID}`),
        req("PUT",  "Yangilash", `reviews/${ID}`, { score: 85 }),
      ]),
      folder("Qaror (WorkDecision)", [
        req("POST", "Yaratish", "decisions", { work: ID, type: "seminar", decision: "Seminar o'tkazish tavsiya etiladi" }),
        req("GET",  "Ish qarorlari", `decisions/work/${ID}`),
        req("PUT",  "Imzolash", `decisions/${ID}/sign`, { eriSerial: "ERI-001" }),
      ]),
    ]),

    folder("12. Ilmiy Bo'lim (Scientific Dept)", [
      folder("Maqola (Article)", [
        req("POST", "Yaratish", "articles", { author: USER_ID, journalName: "O'zbekiston Tibbiyot Jurnali", title: multiLang("Maqola sarlavhasi"), year: 2024, type: "scopus" }),
        req("GET",  "Barchasi", "articles", null, [{ key: "type", value: "", active: false }, { key: "author", value: "", active: false }]),
        req("GET",  "Paginate", "articles/paginate"),
        req("GET",  "Ko'rish", `articles/${ID}`),
        req("PUT",  "Yangilash", `articles/${ID}`, { pages: "45-52" }),
        req("PUT",  "Tasdiqlash", `articles/${ID}/approve`, { approved: true }),
        req("DELETE","O'chirish", `articles/${ID}`),
      ]),
      folder("Tezis (Thesis)", [
        req("POST", "Yaratish", "theses", { author: USER_ID, conferenceName: "Xalqaro kongress", title: multiLang("Tezis sarlavhasi"), year: 2024 }),
        req("GET",  "Barchasi", "theses"),
        req("GET",  "Paginate", "theses/paginate"),
        req("GET",  "Ko'rish", `theses/${ID}`),
        req("PUT",  "Yangilash", `theses/${ID}`, { pages: "120-125" }),
        req("DELETE","O'chirish", `theses/${ID}`),
      ]),
      folder("Monografiya (Monograph)", [
        req("POST", "Yaratish", "monographs", { author: USER_ID, title: multiLang("Monografiya nomi"), publisher: "Fan nashriyoti", year: 2024 }),
        req("GET",  "Barchasi", "monographs"),
        req("GET",  "Paginate", "monographs/paginate"),
        req("GET",  "Ko'rish", `monographs/${ID}`),
        req("PUT",  "Yangilash", `monographs/${ID}`, { isbn: "978-9943-001-00-0" }),
        req("DELETE","O'chirish", `monographs/${ID}`),
      ]),
      folder("Konferensiya (Conference)", [
        req("POST", "Yaratish", "conferences", { title: multiLang("Konferensiya nomi"), startDate: "2024-10-10", endDate: "2024-10-12", createdBy: USER_ID }),
        req("GET",  "Barchasi", "conferences"),
        req("GET",  "Paginate", "conferences/paginate"),
        req("GET",  "Ko'rish", `conferences/${ID}`),
        req("PUT",  "Yangilash", `conferences/${ID}`, { deadline: "2024-09-30" }),
        req("DELETE","O'chirish", `conferences/${ID}`),
      ]),
      folder("Patent", [
        req("POST", "Yaratish", "patents", { author: USER_ID, title: multiLang("Patent nomi"), date: "2024-05-20", registrationNumber: "UZ IAP 001" }),
        req("GET",  "Barchasi", "patents"),
        req("GET",  "Paginate", "patents/paginate"),
        req("GET",  "Ko'rish", `patents/${ID}`),
        req("PUT",  "Yangilash", `patents/${ID}`, { registrationNumber: "UZ IAP 002" }),
        req("DELETE","O'chirish", `patents/${ID}`),
      ]),
      folder("Mualliflik huquqi (Copyright)", [
        req("POST", "Yaratish", "copyrights", { author: USER_ID, title: multiLang("Huquq nomi"), date: "2024-03-15", registrationNumber: "UZ DGC 001" }),
        req("GET",  "Barchasi", "copyrights"),
        req("GET",  "Paginate", "copyrights/paginate"),
        req("GET",  "Ko'rish", `copyrights/${ID}`),
        req("PUT",  "Yangilash", `copyrights/${ID}`, {}),
        req("DELETE","O'chirish", `copyrights/${ID}`),
      ]),
      folder("Metodik tavsiya (MethodicalRecommendation)", [
        req("POST", "Yaratish", "methodical-recommendations", { author: USER_ID, title: multiLang("Metodik ko'rsatma") }),
        req("GET",  "Barchasi", "methodical-recommendations"),
        req("GET",  "Paginate", "methodical-recommendations/paginate"),
        req("GET",  "Ko'rish", `methodical-recommendations/${ID}`),
        req("PUT",  "Yangilash", `methodical-recommendations/${ID}`, { status: "submitted" }),
        req("PUT",  "Tasdiqlash", `methodical-recommendations/${ID}/approve`),
        req("DELETE","O'chirish", `methodical-recommendations/${ID}`),
      ]),
      folder("Kafedra ish rejasi (DepartmentWorkPlan)", [
        req("POST", "Yaratish", "work-plans", { department: ID, academicYear: "2024-2025" }),
        req("GET",  "Barchasi", "work-plans"),
        req("GET",  "Ko'rish", `work-plans/${ID}`),
        req("PUT",  "Yangilash", `work-plans/${ID}`, { fileUrl: "/uploads/workplan.pdf" }),
        req("PUT",  "Tasdiqlash", `work-plans/${ID}/approve`, { approvalStatus: "approved" }),
      ]),
      folder("Yillik hisobot (AnnualReport)", [
        req("POST", "Yaratish", "annual-reports", { department: ID, year: 2024 }),
        req("GET",  "Barchasi", "annual-reports"),
        req("GET",  "Ko'rish", `annual-reports/${ID}`),
        req("PUT",  "Yangilash", `annual-reports/${ID}`, { fileUrl: "/uploads/report.pdf" }),
        req("PUT",  "Tasdiqlash", `annual-reports/${ID}/approve`, { approvalStatus: "approved" }),
      ]),
    ]),

    folder("13. Malaka Oshirish (Qualification)", [
      folder("Kurs (QualificationCourse)", [
        req("POST", "Yaratish", "qualification-courses", {
          title: multiLang("Kardiologiya kursi", "Курс кардиологии", "Cardiology Course"),
          type: 144, startDate: "2025-03-01", endDate: "2025-06-30", status: "planning",
        }),
        req("GET",  "Barchasi", "qualification-courses"),
        req("GET",  "Paginate", "qualification-courses/paginate"),
        req("GET",  "Ko'rish", `qualification-courses/${ID}`),
        req("PUT",  "Yangilash", `qualification-courses/${ID}`, { status: "active" }),
        req("DELETE","O'chirish", `qualification-courses/${ID}`),
      ]),
      folder("Kurs guruhi (CourseGroup)", [
        req("POST", "Yaratish", "course-groups", { course: ID, title: multiLang("1-guruh"), budgetType: "contract" }),
        req("GET",  "Barchasi", "course-groups"),
        req("GET",  "Paginate", "course-groups/paginate"),
        req("GET",  "Kurs guruhlari", `course-groups/course/${ID}`),
        req("PUT",  "Yangilash", `course-groups/${ID}`, { budgetType: "budget" }),
        req("DELETE","O'chirish", `course-groups/${ID}`),
      ]),
      folder("Tinglovchi (Listener)", [
        req("POST", "Yaratish", "listeners", {
          firstName: "Aziz", lastName: "Norqo'ziyev", phone: "+998901234567",
          organization: multiLang("3-son kasalxona"), courseGroup: ID,
        }),
        req("GET",  "Barchasi", "listeners"),
        req("GET",  "Paginate", "listeners/paginate"),
        req("GET",  "Ko'rish", `listeners/${ID}`),
        req("PUT",  "Yangilash", `listeners/${ID}`, { phone: "+998901234568" }),
        req("DELETE","O'chirish", `listeners/${ID}`),
      ]),
      folder("To'lov (CoursePayment)", [
        req("POST", "Yaratish", "payments", { listener: ID, course: ID, amount: 2500000, method: "bank", status: "paid" }),
        req("GET",  "Barchasi", "payments"),
        req("GET",  "Paginate", "payments/paginate"),
        req("PUT",  "Yangilash", `payments/${ID}`, { paidAmount: 2500000, status: "paid" }),
      ]),
      folder("Test", [
        req("POST", "Yaratish", "tests", {
          course: ID, type: "exit", title: multiLang("Yakuniy test"),
          questions: [{ question: "Savol?", options: ["A", "B", "C", "D"], correctAnswer: 1, points: 2 }],
          timeLimit: 60, passingScore: 70,
        }),
        req("GET",  "Barchasi", "tests"),
        req("GET",  "Kurs testlari", `tests/course/${ID}`),
        req("PUT",  "Yangilash", `tests/${ID}`, { passingScore: 75 }),
        req("DELETE","O'chirish", `tests/${ID}`),
      ]),
      folder("Test natijasi (TestResult)", [
        req("POST", "Test topshirish", "test-results/submit", { listener: ID, test: ID, answers: [1, 0, 2, 1] }),
        req("GET",  "Tinglovchi natijalari", `test-results/listener/${ID}`),
        req("GET",  "Test natijalari", `test-results/test/${ID}`),
      ]),
      folder("Sertifikat (Certificate)", [
        req("POST", "Berish", "certificates", { listener: ID, course: ID, type: "sertifikat", registrationNumber: "CERT-2025-001" }),
        req("GET",  "Tinglovchi sertifikatlari", `certificates/listener/${ID}`),
        req("GET",  "Kurs sertifikatlari", `certificates/course/${ID}`),
      ]),
    ]),

    folder("14. Sifat Nazorati (Quality Assurance)", [
      folder("Ko'rsatkich (Indicator)", [
        req("POST", "Yaratish", "indicators", {
          title: multiLang("Scopus maqolalar", "Статьи Scopus", "Scopus articles"),
          category: multiLang("Ilmiy faoliyat"), coefficient: 1.5,
          dataFields: [{ fieldName: "soni", fieldType: "number", required: true }],
        }),
        req("GET",  "Barchasi", "indicators"),
        req("GET",  "Paginate", "indicators/paginate"),
        req("GET",  "Ko'rish", `indicators/${ID}`),
        req("PUT",  "Yangilash", `indicators/${ID}`, { coefficient: 2.0 }),
        req("DELETE","O'chirish", `indicators/${ID}`),
      ]),
      folder("Ko'rsatkich iborasi (IndicatorSubmission)", [
        req("POST", "Yaratish", "submissions", { teacher: USER_ID, indicator: ID, academicYear: "2024-2025", data: { soni: 3 } }),
        req("GET",  "Barchasi", "submissions"),
        req("GET",  "Paginate", "submissions/paginate"),
        req("GET",  "O'qituvchi bali", `submissions/teacher/${TEACHER_ID}/score`),
        req("GET",  "Ko'rish", `submissions/${ID}`),
        req("PUT",  "Yangilash", `submissions/${ID}`, { data: { soni: 5 } }),
        req("PUT",  "Ko'rib chiqish", `submissions/${ID}/review`, { status: "approved", score: 15, comment: "OK" }),
      ]),
    ]),

    folder("15. Amaliyot (Practice)", [
      folder("Tibbiy tashkilot (MedicalOrganization)", [
        req("POST", "Yaratish", "medical-organizations", {
          title: multiLang("1-shahar kasalxonasi", "1-я городская больница"),
          address: multiLang("Toshkent, Yunusobod"), region: multiLang("Toshkent"),
          headName: multiLang("Karimov Hamid"), headPhone: "+998712390011",
        }),
        req("GET",  "Barchasi", "medical-organizations"),
        req("GET",  "Paginate", "medical-organizations/paginate"),
        req("GET",  "Ko'rish", `medical-organizations/${ID}`),
        req("PUT",  "Yangilash", `medical-organizations/${ID}`, { headPhone: "+998712390022" }),
        req("DELETE","O'chirish", `medical-organizations/${ID}`),
      ]),
      folder("Amaliyot shartnomasi (PracticeContract)", [
        req("POST", "Yaratish", "practices", { organization: ID, academicYear: "2024-2025", startDate: "2025-03-01", endDate: "2025-05-31" }),
        req("GET",  "Barchasi", "practices"),
        req("GET",  "Paginate", "practices/paginate"),
        req("GET",  "Ko'rish", `practices/${ID}`),
        req("PUT",  "Yangilash", `practices/${ID}`, { status: "active" }),
        req("PUT",  "Imzolash", `practices/${ID}/sign`, { role: "rector", eriSerial: "ERI-001" }),
        req("DELETE","O'chirish", `practices/${ID}`),
      ]),
    ]),

    folder("16. Iqtidorli Talabalar", [
      folder("Iqtidorli talaba (GiftedStudent)", [
        req("POST", "Ro'yxatga qo'shish", "gifted-students/students", { user: USER_ID, totalScore: 95, rank: 1 }),
        req("GET",  "Barchasi", "gifted-students/students"),
        req("GET",  "Paginate", "gifted-students/students/paginate"),
        req("GET",  "Reyting ro'yxati", "gifted-students/students/ranking"),
        req("GET",  "Ko'rish", `gifted-students/students/${ID}`),
        req("DELETE","O'chirish", `gifted-students/students/${ID}`),
      ]),
      folder("Baholash mezoni (EvaluationCriteria)", [
        req("POST", "Yaratish", "gifted-students/criteria", {
          title: "GPA ko'rsatkichi", category: "O'quv faoliyati",
          subCategories: [{ title: "A'lo (4.0)", pointsPerItem: 40 }], maxPoints: 40,
        }),
        req("GET",  "Barchasi", "gifted-students/criteria"),
        req("PUT",  "Yangilash", `gifted-students/criteria/${ID}`, { maxPoints: 50 }),
        req("DELETE","O'chirish", `gifted-students/criteria/${ID}`),
      ]),
      folder("Yutuqlar (StudentAchievement)", [
        req("POST", "Qo'shish", "gifted-students/achievements", { student: ID, criteria: ID, desc: "Olimpiada g'olibi", score: 40, fileUrl: "/uploads/cert.pdf" }),
        req("GET",  "Talaba yutuqlari", `gifted-students/achievements/student/${ID}`),
        req("PUT",  "Yangilash", `gifted-students/achievements/${ID}`, { score: 35 }),
        req("PUT",  "Tasdiqlash", `gifted-students/achievements/${ID}/approve`, { approved: true }),
        req("DELETE","O'chirish", `gifted-students/achievements/${ID}`),
      ]),
      folder("Stipendiya arizasi (ScholarshipApplication)", [
        req("POST", "Ariza yuborish", "scholarship-applications/apply", { giftedStudent: ID, type: "rektor_stipendiyasi", motivation: "..." }),
        req("GET",  "Mening arizalarim", "scholarship-applications/my"),
        req("GET",  "Barchasi", "scholarship-applications"),
        req("GET",  "Ko'rish", `scholarship-applications/${ID}`),
        req("PUT",  "Ko'rib chiqish", `scholarship-applications/${ID}/review`, { status: "approved", amount: 800000 }),
        req("DELETE","O'chirish", `scholarship-applications/${ID}`),
      ]),
    ]),

    folder("17. Xorijiy Talabalar Qabuli", [
      req("POST", "Ariza yaratish", "international-admission", {
        fullName: "John Smith", country: "USA", countryCode: "US",
        phone: "+19175551234", email: "john@example.com", passportNumber: "A12345678",
        birthDate: "2000-06-15", direction: ID,
        languageTest: { type: "IELTS", score: 6.5, fileUrl: "/uploads/ielts.pdf" },
      }),
      req("GET",  "Barchasi", "international-admission"),
      req("GET",  "Paginate", "international-admission/paginate"),
      req("GET",  "Ko'rish", `international-admission/${ID}`),
      req("PUT",  "Yangilash", `international-admission/${ID}`, { notes: "Hujjatlar tekshirildi" }),
      req("PUT",  "Status o'zgartirish", `international-admission/${ID}/status`, { status: "documents_accepted" }),
      req("PUT",  "Intervyu belgilash", `international-admission/${ID}/schedule-interview`, { scheduledAt: "2025-04-15T10:00:00", location: "301-xona", notes: "Online" }),
      req("PUT",  "Viza ma'lumotlari", `international-admission/${ID}/visa`, { appliedAt: "2025-04-01", receivedAt: "2025-05-01" }),
      req("PUT",  "Hujjat tasdiqlash", `international-admission/${ID}/verify-doc/0`, { verified: true }),
      req("DELETE","O'chirish", `international-admission/${ID}`),
    ]),

    folder("18. Baholar (Grade)", [
      folder("Baholar jurnali (Gradebook)", [
        req("POST", "Yaratish", "gradebooks", { student: ID, science: ID, group: ID, teacher: USER_ID, academicYear: "2024-2025" }),
        req("GET",  "Barchasi", "gradebooks"),
        req("GET",  "Paginate", "gradebooks/paginate"),
        req("GET",  "Talaba statistikasi", `gradebooks/student/${ID}/stats`),
        req("GET",  "O'qituvchi statistikasi", `gradebooks/teacher/${TEACHER_ID}/stats`),
        req("GET",  "Ko'rish", `gradebooks/${ID}`),
        req("PUT",  "Yig'indi yangilash", `gradebooks/${ID}/summary`, { totalScore: 87, passed: true }),
        req("PATCH","Yopish", `gradebooks/${ID}/close`),
        req("POST", "Dars qo'shish", `gradebooks/${ID}/lessons`, { type: "intermediate", date: "2025-02-01", maxScore: 50 }),
        req("PUT",  "Dars yangilash", `gradebooks/${ID}/lessons/{{lessonId}}`, { score: 45 }),
        req("DELETE","Dars o'chirish", `gradebooks/${ID}/lessons/{{lessonId}}`),
        req("DELETE","Jurnal o'chirish", `gradebooks/${ID}`),
      ]),
      folder("Imtihon (Exam)", [
        req("POST", "Yaratish", "exams", { group: ID, science: ID, teacher: USER_ID, academicYear: "2024-2025", type: "final", scheduledDate: "2025-06-10", room: ID, duration: 90, maxScore: 30 }),
        req("GET",  "Barchasi", "exams"),
        req("GET",  "Paginate", "exams/paginate"),
        req("GET",  "Ko'rish", `exams/${ID}`),
        req("PUT",  "Yangilash", `exams/${ID}`, { scheduledDate: "2025-06-15" }),
        req("PATCH","Status o'zgartirish", `exams/${ID}/status`, { status: "ongoing" }),
        req("POST", "Natijalar kiritish (bulk)", `exams/${ID}/results`, { results: [{ student: ID, score: 25, passed: true }] }),
        req("PATCH","Natija yangilash", `exams/${ID}/results/{{resultId}}`, { score: 27 }),
        req("GET",  "Statistika", `exams/${ID}/stats`),
        req("DELETE","O'chirish", `exams/${ID}`),
      ]),
    ]),

    folder("19. Vazifalar (Task)", [
      req("POST", "Yaratish", "tasks", {
        title: multiLang("Hisobot tayyorlash", "Подготовить отчёт", "Prepare report"),
        desc: multiLang("Batafsil tavsif"), deadline: "2025-05-30", priority: "high",
        assignees: [{ user: USER_ID }],
      }),
      req("GET",  "Barchasi", "tasks"),
      req("GET",  "Paginate", "tasks/paginate"),
      req("GET",  "Mening vazifalarim", "tasks/my/tasks"),
      req("GET",  "Ko'rish", `tasks/${ID}`),
      req("PUT",  "Yangilash", `tasks/${ID}`, { priority: "medium" }),
      req("POST", "Tayinlash", `tasks/${ID}/assign`, { users: [USER_ID] }),
      req("PUT",  "Javob berish", `tasks/${ID}/respond`, { text: "Bajarildi", files: [] }),
      req("DELETE","O'chirish", `tasks/${ID}`),
    ]),

    folder("20. Chat", [
      req("POST", "Xabar yuborish", "chat/send", { receiver: USER_ID, message: "Salom!" }),
      req("GET",  "Suhbatlar ro'yxati", "chat/conversations"),
      req("GET",  "O'qilmagan xabarlar soni", "chat/unread-count"),
      req("GET",  "Foydalanuvchi suhbati", `chat/${USER_ID}`),
      req("DELETE","Xabar o'chirish", `chat/${ID}`),
    ]),

    folder("21. E'lonlar (Announcement)", [
      req("POST", "Yaratish", "announcements", {
        title: "Muhim e'lon", body: "Batafsil matn...",
        module: "general", expiresAt: "2025-12-31",
        targetUsers: [], targetCourses: [], targetDirections: [],
      }),
      req("GET",  "Barchasi", "announcements"),
      req("GET",  "Paginate", "announcements/paginate"),
      req("GET",  "Mening e'lonlarim", "announcements/my/list"),
      req("GET",  "Ko'rish", `announcements/${ID}`),
      req("PUT",  "Yangilash", `announcements/${ID}`, { body: "Yangilangan matn" }),
      req("PUT",  "O'qilgan deb belgilash", `announcements/${ID}/mark-read`),
      req("GET",  "O'qish statistikasi", `announcements/${ID}/read-stats`),
      req("DELETE","O'chirish", `announcements/${ID}`),
    ]),

    folder("22. Hisobotlar (Report)", [
      req("GET",  "Yuklamalar hisoboti", "reports/workloads"),
      req("GET",  "Taqsimot hisoboti", "reports/distributions"),
      req("GET",  "O'qituvchilar hisoboti", "reports/teachers"),
      req("GET",  "Ish rejalari hisoboti", "reports/work-plans"),
      req("GET",  "Umumiy xulosa", "reports/summary"),
      req("GET",  "Saqlangan hisobotlar", "reports/saved"),
      req("POST", "Saqlash", "reports/saved", { type: "workloads", filters: {}, title: "2024-2025 Yuklamasi" }),
      req("GET",  "Saqlangan ko'rish", `reports/saved/${ID}`),
      req("POST", "Yuborish", `reports/saved/${ID}/submit`),
      req("PATCH","Tasdiqlash", `reports/saved/${ID}/approve`, { comment: "Tasdiqlandi" }),
      req("PATCH","Rad etish", `reports/saved/${ID}/reject`, { comment: "Qayta" }),
      req("PATCH","Qayta ochish", `reports/saved/${ID}/reopen`),
      req("GET",  "Yuklab olish", `reports/saved/${ID}/download`),
      req("DELETE","O'chirish", `reports/saved/${ID}`),
    ]),
  ],
};

const outPath = path.join(__dirname, "../SANFAK_API.postman_collection.json");
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2), "utf8");

const totalItems = (items) =>
  items.reduce((n, i) => n + (i.item ? totalItems(i.item) : 1), 0);

console.log("✅ Postman collection yaratildi!");
console.log(`📁 Fayl: ${outPath}`);
console.log(`📊 Jami so'rovlar soni: ${totalItems(collection.item)}`);
console.log(`📂 Jami bo'limlar: ${collection.item.length}`);
console.log("\nPostman ga import qilish:");
console.log("  File → Import → SANFAK_API.postman_collection.json");
console.log("\nVariables:");
console.log("  baseUrl = http://localhost:3000/api");
console.log("  token   = (login qilib oling)");
