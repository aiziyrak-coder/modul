"use strict";

const { ROLES, MODULES, ACTIONS } = require("#config/constants");

const FULL_APPROVAL = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
  ACTIONS.SEARCH,
  ACTIONS.FILTER,
  ACTIONS.APPROVE,
  ACTIONS.REJECT,
  ACTIONS.SIGN,
  ACTIONS.EXPORT,
];

const FULL_CRUD = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
  ACTIONS.SEARCH,
  ACTIONS.FILTER,
];

const REF_READ = [ACTIONS.READ_ALL];

const REPORT_READ = [ACTIONS.READ];

const CHAIN_APPROVER = [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.APPROVE, ACTIONS.REJECT];

const VIEW_ONLY = [
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.SEARCH,
  ACTIONS.FILTER,
  ACTIONS.EXPORT,
];

const CONTINGENT_OWNER = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.APPROVE,
  ACTIONS.REJECT,
  ACTIONS.EXPORT,
  ACTIONS.DELETE,
];
const CONTINGENT_EDITOR = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.EXPORT,
];
const CONTINGENT_OBSERVER = [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.EXPORT];

const DEPT_CONTINGENT_OWNER = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
];
const DEPT_CONTINGENT_VIEWER = [ACTIONS.READ, ACTIONS.READ_ALL];

const ROLE_PERMISSIONS = {
  [ROLES.OQITUVCHI]: {
    desc: "Professor-o'qituvchi — o'z sillabus, fan dasturi, shaxsiy ish rejasini boshqaradi",
    scopeLevel: "self",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.SYLLABUS]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ],
      [MODULES.SCIENCE_PROGRAM]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ],
      [MODULES.DIRECTION]: REF_READ,
      [MODULES.WORKLOAD_DISTRIBUTION]: [ACTIONS.READ, ACTIONS.CHANGE_STATUS],
      [MODULES.TEACHER_LEAVE]: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL],
    },
  },

  [ROLES.KAFEDRA_MUDIRI]: {
    desc: "Kafedra mudiri — yuklama taqsimotini boshqaradi, sillabus/fan dasturini tasdiqlaydi",
    scopeLevel: "department",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.DEPARTMENT_CONTINGENT]: DEPT_CONTINGENT_OWNER,

      [MODULES.WORKLOAD_DISTRIBUTION]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
        ACTIONS.APPROVE,
        ACTIONS.REJECT,
      ],
      [MODULES.WORKLOAD]: [
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.APPROVE,
        ACTIONS.REJECT,
      ],
      [MODULES.SCIENCE_PROGRAM]: CHAIN_APPROVER,
      [MODULES.SYLLABUS]: CHAIN_APPROVER,
      [MODULES.TEACHER_LEAVE]: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE],
      [MODULES.WORKING_SCHEDULE]: [ACTIONS.READ, ACTIONS.READ_ALL],

      [MODULES.GROUP]: REF_READ,
    },
  },

  [ROLES.OQUV_USLUBIY_BOSHQARMA]: {
    desc: "O'quv-uslubiy boshqarma — o'quv reja, ishchi jadval, yuklama uslubiy tasdiqlash",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {

      [MODULES.WORKLOAD_SUMMARY]: [ACTIONS.CREATE, ...CHAIN_APPROVER, ACTIONS.DELETE],

      [MODULES.CONTINGENT_REPORT]: CONTINGENT_OBSERVER,
      [MODULES.DEPARTMENT_CONTINGENT]: DEPT_CONTINGENT_VIEWER,

      [MODULES.GROUP]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ],
      [MODULES.STUDY_PLAN]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
        ACTIONS.EXPORT,
      ],
      [MODULES.LEARNING_PROCESS]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.APPROVE,
      ],
      [MODULES.WORKING_SCHEDULE]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.APPROVE,
        ACTIONS.REJECT,
      ],
      [MODULES.WORKING_PLAN]: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE],
      [MODULES.WORKLOAD]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.APPROVE,
        ACTIONS.UPDATE,
        ACTIONS.REJECT,
        ACTIONS.DELETE,
        ACTIONS.EXPORT,
      ],
      [MODULES.WORKLOAD_DISTRIBUTION]: CHAIN_APPROVER,
      [MODULES.SYLLABUS]: CHAIN_APPROVER,
      [MODULES.SCIENCE_PROGRAM]: CHAIN_APPROVER,

      [MODULES.TEACHER_LEAVE]: [],

      [MODULES.ACADEMIC_LEVEL]: REF_READ,
      [MODULES.EDUCATION_FORM]: REF_READ,
      [MODULES.READING_FORM]: REF_READ,
      [MODULES.SPECIALIZATION]: REF_READ,
      [MODULES.STUDY_PERIOD]: REF_READ,
      [MODULES.DIRECTION]: REF_READ,
      [MODULES.COURSE]: REF_READ,
      [MODULES.LANGUAGE_OF_INSTRUCTION]: REF_READ,
      [MODULES.DEPARTMENT]: REF_READ,
      [MODULES.ACADEMIC_YEAR]: REF_READ,
      [MODULES.ASSESSMENT_TYPE]: REF_READ,

      [MODULES.REPORT]: REPORT_READ,
      [MODULES.STATISTICS]: [ACTIONS.READ],
    },
  },

  [ROLES.REJA_MOLIYA]: {
    desc: "Reja-moliya bo'limi — yuklama va taqsimotni moliyaviy tasdiqlash",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {

      [MODULES.WORKLOAD_SUMMARY]: CHAIN_APPROVER,

      [MODULES.WORKLOAD]: [...CHAIN_APPROVER, ACTIONS.EXPORT],
      [MODULES.WORKLOAD_DISTRIBUTION]: CHAIN_APPROVER,

      [MODULES.DEPARTMENT]: REF_READ,
      [MODULES.ACADEMIC_YEAR]: REF_READ,

      [MODULES.REPORT]: REPORT_READ,
    },
  },

  [ROLES.DEKAN]: {
    desc: "Dekan — fakultet bo'yicha yuklama taqsimoti va ishchi jadval tasdiqlash",
    scopeLevel: "faculty",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.CONTINGENT_REPORT]: CONTINGENT_OWNER,
      [MODULES.WORKLOAD_DISTRIBUTION]: [...CHAIN_APPROVER, ACTIONS.EXPORT],
      [MODULES.WORKING_SCHEDULE]: [...CHAIN_APPROVER, ACTIONS.EXPORT],

      [MODULES.WORKLOAD]: [],
      [MODULES.WORKING_PLAN]: VIEW_ONLY,
      [MODULES.LEARNING_PROCESS]: VIEW_ONLY,
      [MODULES.SCIENCE_PROGRAM]: [...CHAIN_APPROVER, ACTIONS.EXPORT],
      [MODULES.STUDY_PLAN]: VIEW_ONLY,
      [MODULES.SYLLABUS]: [...CHAIN_APPROVER, ACTIONS.EXPORT],
      [MODULES.TEACHER_LEAVE]: VIEW_ONLY,

      [MODULES.SCHEDULE]: [],
      [MODULES.TIME_SLOT]: [],

      [MODULES.DIRECTION]: REF_READ,
      [MODULES.COURSE]: REF_READ,
      [MODULES.DEPARTMENT]: REF_READ,
      [MODULES.ACADEMIC_YEAR]: REF_READ,
    },
  },

  [ROLES.PROREKTOR]: {
    desc: "Prorektor — yuklama, taqsimot va ishchi jadval prorektor bosqichini tasdiqlash",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.WORKLOAD_SUMMARY]: CHAIN_APPROVER,
      [MODULES.CONTINGENT_REPORT]: CONTINGENT_OBSERVER,

      [MODULES.WORKLOAD]: CHAIN_APPROVER,
      [MODULES.WORKLOAD_DISTRIBUTION]: CHAIN_APPROVER,
      [MODULES.WORKING_SCHEDULE]: CHAIN_APPROVER,
      [MODULES.SYLLABUS]: CHAIN_APPROVER,
      [MODULES.SCIENCE_PROGRAM]: VIEW_ONLY,

      [MODULES.LEARNING_PROCESS]: VIEW_ONLY,
      [MODULES.STUDY_PLAN]: [...VIEW_ONLY, ACTIONS.APPROVE, ACTIONS.REJECT],

      [MODULES.DIRECTION]: REF_READ,
      [MODULES.COURSE]: REF_READ,
      [MODULES.DEPARTMENT]: REF_READ,
      [MODULES.ACADEMIC_YEAR]: REF_READ,

      [MODULES.REPORT]: REPORT_READ,
    },
  },

  [ROLES.REKTOR]: {
    desc: "Rektor — yuklama va ishchi jadval rektor bosqichini tasdiqlash (ERI bilan)",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.WORKLOAD_SUMMARY]: CHAIN_APPROVER,
      [MODULES.CONTINGENT_REPORT]: CONTINGENT_OBSERVER,

      [MODULES.WORKLOAD]: [...CHAIN_APPROVER, ACTIONS.EXPORT],
      [MODULES.WORKING_SCHEDULE]: [...CHAIN_APPROVER, ACTIONS.EXPORT],
      [MODULES.SCIENCE_PROGRAM]: [...VIEW_ONLY, ACTIONS.REJECT],

      [MODULES.WORKLOAD_DISTRIBUTION]: VIEW_ONLY,
      [MODULES.SYLLABUS]: VIEW_ONLY,
      [MODULES.TEACHER_LEAVE]: VIEW_ONLY,
      [MODULES.WORKING_PLAN]: VIEW_ONLY,
      [MODULES.LEARNING_PROCESS]: VIEW_ONLY,
      [MODULES.STUDY_PLAN]: VIEW_ONLY,
      [MODULES.SCHEDULE]: [],
      [MODULES.TIME_SLOT]: [],

      [MODULES.DEPARTMENT]: REF_READ,

      [MODULES.REPORT]: REPORT_READ,
      [MODULES.STATISTICS]: [ACTIONS.READ],
    },
  },

  [ROLES.ARM]: {
    desc: "Axborot-resurs markazi (ARM) — sillabus va fan dasturining ARM bosqichini kelishadi",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.SYLLABUS]: CHAIN_APPROVER,
      [MODULES.SCIENCE_PROGRAM]: CHAIN_APPROVER,

      [MODULES.ACADEMIC_YEAR]: REF_READ,

      [MODULES.REPORT]: REPORT_READ,
    },
  },

  [ROLES.KADRLAR]: {
    desc: "Kadrlar bo'limi — vakant yuklamalar reyestrini (hiring-signal) ko'radi",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.WORKLOAD_DISTRIBUTION]: [ACTIONS.READ, ACTIONS.READ_ALL],
    },
  },

  [ROLES.MAGISTRATURA_BOLIM]: {
    desc: "Magistratura va klinik ordinatura bo'limi — o'quv reja kiritish (O'UB bilan bir xil CRUD); tasdiqlash — o'quv reja tasdiqlash zanjirida",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.LEARNING_PROCESS]: [...VIEW_ONLY, ACTIONS.CREATE, ACTIONS.UPDATE],
      [MODULES.STUDY_PLAN]: [...VIEW_ONLY, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE],

      [MODULES.ACADEMIC_LEVEL]: [ACTIONS.READ, ACTIONS.READ_ALL],
      [MODULES.READING_FORM]: REF_READ,
      [MODULES.SPECIALIZATION]: REF_READ,
      [MODULES.STUDY_PERIOD]: REF_READ,
    },
  },

  [ROLES.FAKULTET_KENGASH_KOTIBI]: {
    desc: "Fakultet ilmiy kengashi kotibi — kuzgi/yillik hisobotni tasdiqlaydi (TZ 4.3.7/4.3.8)",
    scopeLevel: "faculty",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.CONTINGENT_REPORT]: CONTINGENT_EDITOR,
    },
  },
};

const ROUTE_REQUIREMENTS = [
  {
    method: "PATCH",
    path: "/workloads/approve/:id",
    section: MODULES.WORKLOAD,
    actions: [ACTIONS.APPROVE, ACTIONS.UPDATE],
    roles: [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.KAFEDRA_MUDIRI,
      ROLES.REJA_MOLIYA,
      ROLES.PROREKTOR,
      ROLES.REKTOR,
    ],
  },
  {
    method: "GET",
    path: "/workloads/summary.xlsx",
    section: MODULES.WORKLOAD,
    actions: [ACTIONS.EXPORT],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REJA_MOLIYA, ROLES.REKTOR],
  },
  {
    method: "PATCH",
    path: "/workloads/reject/:id",
    section: MODULES.WORKLOAD,
    actions: [ACTIONS.REJECT],
    roles: [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.KAFEDRA_MUDIRI,
      ROLES.REJA_MOLIYA,
      ROLES.PROREKTOR,
      ROLES.REKTOR,
    ],
  },
  {
    method: "PATCH",
    path: "/distributions/approve/:id",
    section: MODULES.WORKLOAD_DISTRIBUTION,
    actions: [ACTIONS.APPROVE, ACTIONS.UPDATE],
    roles: [
      ROLES.KAFEDRA_MUDIRI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.REJA_MOLIYA,
      ROLES.DEKAN,
      ROLES.PROREKTOR,
    ],
  },
  {
    method: "PATCH",
    path: "/distributions/reject/:id",
    section: MODULES.WORKLOAD_DISTRIBUTION,
    actions: [ACTIONS.REJECT],
    roles: [
      ROLES.KAFEDRA_MUDIRI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.REJA_MOLIYA,
      ROLES.DEKAN,
      ROLES.PROREKTOR,
    ],
  },
  {
    method: "GET",
    path: "/distributions/my",
    section: MODULES.WORKLOAD_DISTRIBUTION,
    actions: [ACTIONS.READ],
    roles: [
      ROLES.OQITUVCHI,
      ROLES.KAFEDRA_MUDIRI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.REJA_MOLIYA,
      ROLES.DEKAN,
      ROLES.PROREKTOR,
    ],
  },
  {
    method: "PATCH",
    path: "/distributions/:id/teachers/:teacherEntryId/respond",
    section: MODULES.WORKLOAD_DISTRIBUTION,
    actions: [ACTIONS.CHANGE_STATUS],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "PATCH",
    path: "/working-schedules/approve/:id",
    section: MODULES.WORKING_SCHEDULE,
    actions: [ACTIONS.APPROVE, ACTIONS.UPDATE],
    roles: [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
      ROLES.PROREKTOR,
      ROLES.REKTOR,
    ],
  },
  {
    method: "PATCH",
    path: "/working-schedules/reject/:id",
    section: MODULES.WORKING_SCHEDULE,
    actions: [ACTIONS.REJECT],
    roles: [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
      ROLES.PROREKTOR,
      ROLES.REKTOR,
    ],
  },
  {
    method: "PATCH",
    path: "/science-programs/approve/:id",
    section: MODULES.SCIENCE_PROGRAM,
    actions: [ACTIONS.APPROVE, ACTIONS.UPDATE],
    roles: [
      ROLES.OQITUVCHI,
      ROLES.KAFEDRA_MUDIRI,
      ROLES.ARM,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
    ],
  },
  {
    method: "PATCH",
    path: "/science-programs/reject/:id",
    section: MODULES.SCIENCE_PROGRAM,
    actions: [ACTIONS.REJECT],
    roles: [
      ROLES.KAFEDRA_MUDIRI,
      ROLES.ARM,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
      ROLES.REKTOR,
    ],
  },
  {
    method: "PATCH",
    path: "/syllabi/approve/:id",
    section: MODULES.SYLLABUS,
    actions: [ACTIONS.APPROVE, ACTIONS.UPDATE],
    roles: [
      ROLES.OQITUVCHI,
      ROLES.KAFEDRA_MUDIRI,
      ROLES.ARM,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
      ROLES.PROREKTOR,
    ],
  },
  {
    method: "PATCH",
    path: "/syllabi/reject/:id",
    section: MODULES.SYLLABUS,
    actions: [ACTIONS.REJECT],
    roles: [
      ROLES.KAFEDRA_MUDIRI,
      ROLES.ARM,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
      ROLES.PROREKTOR,
    ],
  },
  {
    method: "PATCH",
    path: "/teacher-leaves/:id/approve",
    section: MODULES.TEACHER_LEAVE,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.KAFEDRA_MUDIRI],
  },
  {
    method: "PATCH",
    path: "/teacher-leaves/:id/reject",
    section: MODULES.TEACHER_LEAVE,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.KAFEDRA_MUDIRI],
  },
  {
    method: "GET",
    path: "/teacher-leaves/:id/suggestions",
    section: MODULES.TEACHER_LEAVE,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.KAFEDRA_MUDIRI],
  },
  {
    method: "POST",
    path: "/teacher-leaves/:id/reassign",
    section: MODULES.TEACHER_LEAVE,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.KAFEDRA_MUDIRI],
  },
  {
    method: "PUT",
    path: "/learning-process/:id/approve",
    section: MODULES.LEARNING_PROCESS,
    actions: [ACTIONS.APPROVE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA],
  },
  {
    method: "GET",
    path: "/study-plans/paginate",
    section: MODULES.STUDY_PLAN,
    actions: [ACTIONS.READ_ALL],
    roles: [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
      ROLES.PROREKTOR,
      ROLES.REKTOR,
      ROLES.MAGISTRATURA_BOLIM,
    ],
  },
  {
    method: "GET",
    path: "/study-plans/:id/pdf",
    section: MODULES.STUDY_PLAN,
    actions: [ACTIONS.EXPORT],
    roles: [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
      ROLES.PROREKTOR,
      ROLES.REKTOR,
      ROLES.MAGISTRATURA_BOLIM,
    ],
  },
  {
    method: "POST",
    path: "/learning-process",
    section: MODULES.LEARNING_PROCESS,
    actions: [ACTIONS.CREATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "PUT",
    path: "/learning-process/fullupdate/:id",
    section: MODULES.LEARNING_PROCESS,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "PUT",
    path: "/learning-process/:id",
    section: MODULES.LEARNING_PROCESS,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "PUT",
    path: "/learning-process/study-plan/:id",
    section: MODULES.LEARNING_PROCESS,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "PUT",
    path: "/learning-process/special-part/:id",
    section: MODULES.LEARNING_PROCESS,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "PUT",
    path: "/learning-process/special-part/title/:id",
    section: MODULES.LEARNING_PROCESS,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "PUT",
    path: "/learning-process/:id/month-weeks",
    section: MODULES.LEARNING_PROCESS,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "PUT",
    path: "/learning-process/:id/restore",
    section: MODULES.LEARNING_PROCESS,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "DELETE",
    path: "/study-plans/:id",
    section: MODULES.STUDY_PLAN,
    actions: [ACTIONS.DELETE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "PATCH",
    path: "/study-plans/:id/link-science",
    section: MODULES.STUDY_PLAN,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "POST",
    path: "/study-plans/:id/elective-row",
    section: MODULES.STUDY_PLAN,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "DELETE",
    path: "/study-plans/:id/elective-row/:rowId",
    section: MODULES.STUDY_PLAN,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.MAGISTRATURA_BOLIM],
  },
  {
    method: "GET",
    path: "/study-load-statistics/oub-overview",
    section: MODULES.STATISTICS,
    actions: [ACTIONS.READ],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REKTOR],
  },
  {
    method: "GET",
    path: "/study-load-statistics/oub-faculties",
    section: MODULES.STATISTICS,
    actions: [ACTIONS.READ],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REKTOR],
  },
  {
    method: "GET",
    path: "/study-load-statistics/oub-teachers",
    section: MODULES.STATISTICS,
    actions: [ACTIONS.READ],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REKTOR],
  },
  {
    method: "POST",
    path: "/contingent-reports",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.CREATE],
    roles: [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
  {
    method: "GET",
    path: "/contingent-reports/paginate",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.READ_ALL],
    roles: [
      ROLES.DEKAN,
      ROLES.FAKULTET_KENGASH_KOTIBI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.REKTOR,
      ROLES.PROREKTOR,
    ],
  },
  {
    method: "GET",
    path: "/contingent-reports/:id",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.READ],
    roles: [
      ROLES.DEKAN,
      ROLES.FAKULTET_KENGASH_KOTIBI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.REKTOR,
      ROLES.PROREKTOR,
    ],
  },
  {
    method: "PUT",
    path: "/contingent-reports/:id",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
  {
    method: "POST",
    path: "/contingent-reports/:id/prefill",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
  {
    method: "PATCH",
    path: "/contingent-reports/approve/:id",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.APPROVE, ACTIONS.UPDATE],
    roles: [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
  {
    method: "PATCH",
    path: "/contingent-reports/reject/:id",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.REJECT],
    roles: [ROLES.DEKAN],
  },
  {
    method: "DELETE",
    path: "/contingent-reports/:id",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.DELETE],
    roles: [ROLES.DEKAN],
  },
  {
    method: "GET",
    path: "/contingent-reports/summary",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REKTOR, ROLES.PROREKTOR],
  },
  {
    method: "GET",
    path: "/contingent-reports/summary/pdf",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.EXPORT],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REKTOR, ROLES.PROREKTOR],
  },
  {
    method: "GET",
    path: "/contingent-reports/summary/xlsx",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.EXPORT],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REKTOR, ROLES.PROREKTOR],
  },
  {
    method: "GET",
    path: "/contingent-reports/:id/xlsx",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.EXPORT],
    roles: [
      ROLES.DEKAN,
      ROLES.FAKULTET_KENGASH_KOTIBI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.REKTOR,
      ROLES.PROREKTOR,
    ],
  },
  {
    method: "GET",
    path: "/contingent-reports/:id/pdf",
    section: MODULES.CONTINGENT_REPORT,
    actions: [ACTIONS.EXPORT],
    roles: [
      ROLES.DEKAN,
      ROLES.FAKULTET_KENGASH_KOTIBI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.REKTOR,
      ROLES.PROREKTOR,
    ],
  },
  {
    method: "POST",
    path: "/department-contingents",
    section: MODULES.DEPARTMENT_CONTINGENT,
    actions: [ACTIONS.CREATE],
    roles: [ROLES.KAFEDRA_MUDIRI],
  },
  {
    method: "GET",
    path: "/department-contingents/paginate",
    section: MODULES.DEPARTMENT_CONTINGENT,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.KAFEDRA_MUDIRI, ROLES.OQUV_USLUBIY_BOSHQARMA],
  },
  {
    method: "GET",
    path: "/department-contingents/summary",
    section: MODULES.DEPARTMENT_CONTINGENT,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.OQUV_USLUBIY_BOSHQARMA],
  },
  {
    method: "GET",
    path: "/department-contingents/prefill",
    section: MODULES.DEPARTMENT_CONTINGENT,
    actions: [ACTIONS.CREATE],
    roles: [ROLES.KAFEDRA_MUDIRI],
  },
  {
    method: "GET",
    path: "/department-contingents/:id",
    section: MODULES.DEPARTMENT_CONTINGENT,
    actions: [ACTIONS.READ],
    roles: [ROLES.KAFEDRA_MUDIRI, ROLES.OQUV_USLUBIY_BOSHQARMA],
  },
  {
    method: "PUT",
    path: "/department-contingents/:id",
    section: MODULES.DEPARTMENT_CONTINGENT,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.KAFEDRA_MUDIRI],
  },
  {
    method: "DELETE",
    path: "/department-contingents/:id",
    section: MODULES.DEPARTMENT_CONTINGENT,
    actions: [ACTIONS.DELETE],
    roles: [ROLES.KAFEDRA_MUDIRI],
  },
];

module.exports = { ROLE_PERMISSIONS, ROUTE_REQUIREMENTS };
