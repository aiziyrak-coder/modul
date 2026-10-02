"use strict";

const { ROLES, MODULES, ACTIONS } = require("#config/constants");

const REVIEWER = [
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.APPROVE,
  ACTIONS.REJECT,
];

const OBSERVER = [ACTIONS.READ, ACTIONS.READ_ALL];

const REFERENCE_READ = {
  [MODULES.FACULTY]: [ACTIONS.READ_ALL],
  [MODULES.DEPARTMENT]: [ACTIONS.READ_ALL],
  [MODULES.POSITION]: [ACTIONS.READ_ALL],
  [MODULES.ACADEMIC_YEAR]: [ACTIONS.READ_ALL],
};

const ROLE_PERMISSIONS = {
  [ROLES.OQITUVCHI]: {
    desc: "Professor-o'qituvchi — o'z profili va shaxsiy ish rejasi",
    scopeLevel: "self",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.TEACHER]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
      ],
      [MODULES.PERSONAL_WORK_PLAN]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
        ACTIONS.APPROVE,
      ],
      ...REFERENCE_READ,
    },
  },

  [ROLES.KADRLAR]: {
    desc: "Kadrlar bo'limi — professor-o'qituvchi profilini tasdiqlaydi",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.TEACHER]: REVIEWER,
      [MODULES.STAFF]: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
        ACTIONS.EXPORT,
      ],
      ...REFERENCE_READ,
      [MODULES.ACADEMIC_TITLE]: [ACTIONS.READ_ALL],
    },
  },

  [ROLES.KAFEDRA_MUDIRI]: {
    desc: "Kafedra mudiri — kafedra o'qituvchilari ish rejasini tasdiqlaydi va monitoring qiladi",
    scopeLevel: "department",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.TEACHER]: OBSERVER,
      [MODULES.PERSONAL_WORK_PLAN]: [...REVIEWER, ACTIONS.REVIEW],
    },
  },

  [ROLES.DEKAN]: {
    desc: "Fakultet dekani — fakultet o'qituvchilari ish rejasini kuzatadi va 7-bosqichni tasdiqlaydi",
    scopeLevel: "faculty",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.TEACHER]: OBSERVER,
      [MODULES.PERSONAL_WORK_PLAN]: REVIEWER,
    },
  },

  [ROLES.PROREKTOR]: {
    desc: "Prorektor — yuklama, taqsimot va ishchi jadval prorektor bosqichini tasdiqlash",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.TEACHER]: OBSERVER,
    },
  },
  [ROLES.REKTOR]: {
    desc: "Rektor — yuklama va ishchi jadval rektor bosqichini tasdiqlash (ERI bilan)",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.TEACHER]: OBSERVER,
    },
  },

  [ROLES.KAFEDRA_USLUBIY_MASUL]: {
    desc: "Kafedraning o'quv va o'quv-uslubiy ishlar bo'yicha mas'ul xodimi — shaxsiy ish reja 2-bosqich",
    scopeLevel: "department",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.PERSONAL_WORK_PLAN]: REVIEWER,
    },
  },

  [ROLES.KAFEDRA_ILMIY_MASUL]: {
    desc: "Kafedraning ilmiy-tadqiqot ishlari bo'yicha mas'ul xodimi — shaxsiy ish reja 3-bosqich",
    scopeLevel: "department",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.PERSONAL_WORK_PLAN]: REVIEWER,
    },
  },

  [ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL]: {
    desc: "Kafedraning \"Ustoz-shogird\" ishlari bo'yicha mas'ul xodimi — shaxsiy ish reja 4-bosqich",
    scopeLevel: "department",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.PERSONAL_WORK_PLAN]: REVIEWER,
    },
  },

  [ROLES.OQUV_USLUBIY_BOSHQARMA]: {
    desc: "O'quv-uslubiy boshqarma — shaxsiy ish reja 6-bosqichini tasdiqlaydi",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.PERSONAL_WORK_PLAN]: REVIEWER,
      [MODULES.TEACHER]: [ACTIONS.READ],
    },
  },

  [ROLES.ICHKI_NAZORAT]: {
    desc: "Ichki nazorat va monitoring bo'limi — shaxsiy ish reja 8-bosqichi (oxirgi) va yakunlash",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.PERSONAL_WORK_PLAN]: REVIEWER,
    },
  },

  [ROLES.ILMIY_BOLIM]: {
    desc: "Ilmiy bo'lim — bajarilgan ilmiy ishlarni institut darajasida tekshiradi (TZ 4.3.5/4.3.9)",
    scopeLevel: "global",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.PERSONAL_WORK_PLAN]: [
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.APPROVE,
        ACTIONS.REJECT,
        ACTIONS.REVIEW,
      ],
    },
  },

  [ROLES.FAKULTET_KENGASH_KOTIBI]: {
    desc: "Fakultet ilmiy kengashi kotibi — kuzgi/yillik hisobotni tasdiqlaydi (TZ 4.3.7/4.3.8)",
    scopeLevel: "faculty",
    isSystem: false,
    active: true,
    sections: {
      [MODULES.PERSONAL_WORK_PLAN]: [
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.APPROVE,
        ACTIONS.REJECT,
      ],
      [MODULES.ACADEMIC_YEAR]: [ACTIONS.READ_ALL],
    },
  },
};

const ROUTE_REQUIREMENTS = [
  {
    method: "POST",
    path: "/teachers",
    section: MODULES.TEACHER,
    actions: [ACTIONS.CREATE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "GET",
    path: "/teachers",
    section: MODULES.TEACHER,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.OQITUVCHI, ROLES.KADRLAR, ROLES.KAFEDRA_MUDIRI, ROLES.DEKAN],
  },
  {
    method: "GET",
    path: "/teachers/:id",
    section: MODULES.TEACHER,
    actions: [ACTIONS.READ],
    roles: [ROLES.OQITUVCHI, ROLES.KADRLAR, ROLES.KAFEDRA_MUDIRI, ROLES.DEKAN],
  },
  {
    method: "PUT",
    path: "/teachers/:id",
    section: MODULES.TEACHER,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "POST",
    path: "/teachers/me/degrees",
    section: MODULES.TEACHER,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "DELETE",
    path: "/teachers/me/degrees/:type/:fileId",
    section: MODULES.TEACHER,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "PATCH",
    path: "/teachers/:id/approve",
    section: MODULES.TEACHER,
    actions: [ACTIONS.APPROVE],
    roles: [ROLES.KADRLAR],
  },
  {
    method: "PATCH",
    path: "/teachers/:id/reject",
    section: MODULES.TEACHER,
    actions: [ACTIONS.REJECT],
    roles: [ROLES.KADRLAR],
  },

  {
    method: "POST",
    path: "/personal-work-plans/generate",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.CREATE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "GET",
    path: "/personal-work-plans",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.OQITUVCHI, ROLES.KAFEDRA_MUDIRI, ROLES.DEKAN],
  },
  {
    method: "GET",
    path: "/personal-work-plans/monitoring",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.REVIEW],
    roles: [ROLES.KAFEDRA_MUDIRI, ROLES.ILMIY_BOLIM],
  },
  {
    method: "POST",
    path: "/personal-work-plans/:id/activity",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "POST",
    path: "/personal-work-plans/:id/submit",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "PATCH",
    path: "/personal-work-plans/:id/approve",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.APPROVE],
    roles: [
      ROLES.OQITUVCHI,
      ROLES.KAFEDRA_USLUBIY_MASUL,
      ROLES.KAFEDRA_ILMIY_MASUL,
      ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL,
      ROLES.KAFEDRA_MUDIRI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
      ROLES.ICHKI_NAZORAT,
    ],
  },
  {
    method: "PATCH",
    path: "/personal-work-plans/:id/reject",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.REJECT],
    roles: [
      ROLES.KAFEDRA_USLUBIY_MASUL,
      ROLES.KAFEDRA_ILMIY_MASUL,
      ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL,
      ROLES.KAFEDRA_MUDIRI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.DEKAN,
      ROLES.ICHKI_NAZORAT,
    ],
  },
  {
    method: "PATCH",
    path: "/personal-work-plans/:id/complete",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.APPROVE],
    roles: [ROLES.ICHKI_NAZORAT],
  },

  {
    method: "GET",
    path: "/personal-work-plans/completed-items",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.OQITUVCHI, ROLES.KAFEDRA_MUDIRI, ROLES.ILMIY_BOLIM],
  },
  {
    method: "GET",
    path: "/personal-work-plans/completed-items/export",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.OQITUVCHI, ROLES.KAFEDRA_MUDIRI, ROLES.ILMIY_BOLIM],
  },
  {
    method: "PATCH",
    path: "/personal-work-plans/:id/activity/:activityId/verify",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.APPROVE, ACTIONS.REJECT],
    roles: [ROLES.KAFEDRA_MUDIRI, ROLES.ILMIY_BOLIM],
  },

  {
    method: "POST",
    path: "/staff",
    section: MODULES.STAFF,
    actions: [ACTIONS.CREATE],
    roles: [ROLES.KADRLAR],
  },
  {
    method: "GET",
    path: "/staff",
    section: MODULES.STAFF,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.KADRLAR],
  },
  {
    method: "GET",
    path: "/staff/:id",
    section: MODULES.STAFF,
    actions: [ACTIONS.READ],
    roles: [ROLES.KADRLAR],
  },
  {
    method: "PUT",
    path: "/staff/:id",
    section: MODULES.STAFF,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.KADRLAR],
  },
  {
    method: "DELETE",
    path: "/staff/:id",
    section: MODULES.STAFF,
    actions: [ACTIONS.DELETE],
    roles: [ROLES.KADRLAR],
  },
  {
    method: "GET",
    path: "/staff/export",
    section: MODULES.STAFF,
    actions: [ACTIONS.EXPORT],
    roles: [ROLES.KADRLAR],
  },
  {
    method: "PATCH",
    path: "/staff/:id/restore",
    section: MODULES.STAFF,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.KADRLAR],
  },

  {
    method: "POST",
    path: "/personal-reports",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.CREATE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "GET",
    path: "/personal-reports",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.OQITUVCHI, ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
  {
    method: "GET",
    path: "/personal-reports/paginate",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.OQITUVCHI, ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
  {
    method: "GET",
    path: "/personal-reports/export",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.READ_ALL],
    roles: [ROLES.OQITUVCHI, ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
  {
    method: "GET",
    path: "/personal-reports/:id",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.READ],
    roles: [ROLES.OQITUVCHI, ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
  {
    method: "PUT",
    path: "/personal-reports/:id",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.UPDATE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "DELETE",
    path: "/personal-reports/:id",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.DELETE],
    roles: [ROLES.OQITUVCHI],
  },
  {
    method: "PATCH",
    path: "/personal-reports/:id/approve",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.APPROVE],
    roles: [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
  {
    method: "PATCH",
    path: "/personal-reports/:id/reject",
    section: MODULES.PERSONAL_WORK_PLAN,
    actions: [ACTIONS.REJECT],
    roles: [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
  },
];

module.exports = { ROLE_PERMISSIONS, ROUTE_REQUIREMENTS, REVIEWER, OBSERVER };
