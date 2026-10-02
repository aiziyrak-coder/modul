const express = require("express");
const listEndpoints = require("express-list-endpoints");

const TAG_MAP = {
  auth: "4.01 Auth",
  users: "4.01 Foydalanuvchilar",
  roles: "4.01 RBAC",
  permissions: "4.01 RBAC",
  "permission-groups": "4.01 RBAC",

  "study-plans": "4.02 O'quv yuklamasi",
  "learning-process": "4.02 O'quv yuklamasi",
  "working-schedules": "4.02 O'quv yuklamasi",
  "working-plans": "4.02 O'quv yuklamasi",
  workloads: "4.02 O'quv yuklamasi",
  distributions: "4.02 O'quv yuklamasi",
  "science-programs": "4.02 O'quv yuklamasi",
  syllabi: "4.02 O'quv yuklamasi",
  "teacher-leaves": "4.02 O'quv yuklamasi",

  teachers: "4.03 O'qituvchilar",
  "personal-work-plans": "4.03 O'qituvchilar",

  residents: "4.05 Rezidentura",
  applications: "4.05 Rezidentura",
  attendance: "4.05 Rezidentura",
  "daily-logs": "4.05 Rezidentura",
  assessments: "4.05 Rezidentura",
  resources: "4.05 Rezidentura",
  dissertations: "4.05 Rezidentura",

  works: "4.06 Ilmiy kengash",
  reviews: "4.06 Ilmiy kengash",
  decisions: "4.06 Ilmiy kengash",

  tasks: "4.07 Topshiriqlar",
  "international-admission": "4.08 Xorijiy qabul",

  members: "4.09 Institut kengashi",
  "council-tasks": "4.09 Institut kengashi",
  "rank-applications": "4.09 Institut kengashi",
  "voting-sessions": "4.09 Institut kengashi",
  votes: "4.09 Institut kengashi",

  "gifted-students": "4.11 Iqtidorli talabalar",
  "evaluation-criterias": "4.11 Iqtidorli talabalar",
  "student-achievements": "4.11 Iqtidorli talabalar",
  "scholarship-applications": "4.11 Iqtidorli talabalar",

  indicators: "4.12 Sifat nazorati",
  submissions: "4.12 Sifat nazorati",

  practices: "4.13 Amaliyot",
  "medical-organizations": "4.13 Amaliyot",

  students: "_shared Talabalar",
  "student-attendance": "_shared Talabalar",
  gradebooks: "_shared Baholar",
  exams: "_shared Baholar",
  schedule: "_shared Jadval",
  "time-slots": "_shared Jadval",

  "approval-chains": "_system",
  chat: "_system",
  announcements: "_system",
  notifications: "_system",
  reports: "app Hisobotlar",
};

const PUBLIC_PATHS = new Set(["/auth", "/auth/refresh"]);

const REFS = [
  "faculties", "departments", "sciences", "directions", "divisions",
  "courses", "positions", "rooms", "groups", "academic-levels",
  "academic-title", "auditorium-hour", "education-forms",
  "education-activity-types", "reading-forms", "specializations",
  "studyPeriods", "academic-years", "countries", "public-offer",
  "language-of-instruction", "sla-configs",
];
const SCI_DEPT = [
  "annual-reports", "articles", "theses", "monographs", "patents",
  "copyrights", "conferences", "work-plans", "economic-contracts",
  "methodical-recommendations", "qualifying-applicants",
];

function tagFor(relPath) {
  const seg = relPath.split("/").filter(Boolean)[0] || "root";
  if (TAG_MAP[seg]) return TAG_MAP[seg];
  if (seg.startsWith("qualification")) return "4.04 Malaka oshirish";
  if (SCI_DEPT.includes(seg)) return "4.10 Ilmiy bo'lim";
  if (REFS.includes(seg)) return "_references Lug'atlar";
  return seg;
}

const R = {
  200: { description: "Muvaffaqiyatli" },
  201: { description: "Yaratildi" },
  400: { description: "Noto'g'ri so'rov / validatsiya xatosi" },
  401: { description: "Autentifikatsiya talab qilinadi" },
  403: { description: "Ruxsat berilmagan" },
  404: { description: "Topilmadi" },
};

function buildPaths() {
  const app = express();
  app.use("/api", require("../router"));
  const endpoints = listEndpoints(app);

  const paths = {};
  for (const ep of endpoints) {
    const rel = ep.path.replace(/^\/api/, "") || "/";
    const oaPath = rel.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    if (!paths[oaPath]) paths[oaPath] = {};

    const pathParams = (oaPath.match(/\{([A-Za-z0-9_]+)\}/g) || []).map((p) => ({
      name: p.slice(1, -1),
      in: "path",
      required: true,
      schema: { type: "string" },
    }));

    const isPaginate = oaPath.endsWith("/paginate");
    const isPublic = PUBLIC_PATHS.has(oaPath);

    for (const method of ep.methods) {
      const m = method.toLowerCase();

      const params = [...pathParams];
      if (m === "get") {
        if (isPaginate) {
          params.push({ name: "page", in: "query", required: true, schema: { type: "integer", default: 1 } });
          params.push({ name: "limit", in: "query", required: true, schema: { type: "integer", default: 10 } });
        }
        const isListLike = !oaPath.includes("{");
        if (isListLike) {
          params.push({ name: "search", in: "query", schema: { type: "string" }, description: "Qidiruv (ixtiyoriy)" });
          params.push({ name: "active", in: "query", schema: { type: "boolean" }, description: "Faol filtri (ixtiyoriy)" });
          params.push({ name: "status", in: "query", schema: { type: "string" }, description: "Status filtri (ixtiyoriy)" });
        }
      }

      const op = {
        tags: [tagFor(rel)],
        summary: `${method} ${oaPath}`,
        responses: {
          ...(m === "post" ? { 201: R[201] } : { 200: R[200] }),
          400: R[400],
          401: R[401],
          403: R[403],
          404: R[404],
        },
      };
      if (isPublic) op.security = [];
      if (params.length) op.parameters = params;
      if (["post", "put", "patch"].includes(m)) {
        op.requestBody = {
          content: {
            "application/json": { schema: { type: "object" } },
            "multipart/form-data": { schema: { type: "object" } },
          },
        };
      }
      paths[oaPath][m] = op;
    }
  }
  return paths;
}

const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Institut AIS API",
    version: "1.0.0",
    description:
      "Institut Avtomatlashtirilgan Axborot Tizimi API. Spec real route'lardan " +
      "avtomatik generatsiya qilinadi (kod bilan har doim mos). Barcha endpoint " +
      "JWT bearer token talab qiladi (login/refresh bundan mustasno).",
    contact: { name: "AIS Support" },
  },
  servers: [
    { url: "http://localhost:4000/api", description: "Development server" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: buildPaths(),
};

module.exports = swaggerSpec;
