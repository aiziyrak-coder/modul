"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Permission = require("../src/modules/4.01-auth/permission/permission.model");
const PermissionGroup = require("../src/modules/4.01-auth/permissionGroup/permissionGroup.model");
const { MODULES, ACTIONS } = require("../src/config/constants");
const { EQ_CATALOG } = require("./quality-role-access.seed");

const EQ = new Map(EQ_CATALOG.map((p) => [p.section, p]));

const SECTION_TO_GROUPS = {
  [MODULES.AUTH]: ["4.1"],
  [MODULES.USER]: ["4.1"],
  [MODULES.ROLE]: ["4.1"],
  [MODULES.PERMISSION]: ["4.1"],
  [MODULES.PERMISSION_GROUP]: ["4.1"],
  [MODULES.AUDIT_LOG]: ["4.1"],

  [MODULES.STUDY_PLAN]: ["4.2"],
  [MODULES.WORKING_PLAN]: ["4.2"],
  [MODULES.WORKING_SCHEDULE]: ["4.2"],
  [MODULES.WORKLOAD]: ["4.2"],
  [MODULES.WORKLOAD_DISTRIBUTION]: ["4.2"],
  [MODULES.WORKLOAD_SUMMARY]: ["4.2"],
  [MODULES.CONTINGENT_REPORT]: ["4.2"],
  [MODULES.DEPARTMENT_CONTINGENT]: ["4.2"],
  [MODULES.SYLLABUS]: ["4.2"],
  [MODULES.SCIENCE_PROGRAM]: ["4.2"],
  [MODULES.LEARNING_PROCESS]: ["4.2"],
  [MODULES.TEACHER_LEAVE]: ["4.2"],
  [MODULES.SCHEDULE]: ["4.2"],
  [MODULES.TIME_SLOT]: ["4.2"],

  [MODULES.TEACHER]: ["4.3"],
  [MODULES.PERSONAL_WORK_PLAN]: ["4.3"],
  [MODULES.STAFF]: ["4.3"],

  [MODULES.QUAL_COURSE]: ["4.4"],
  [MODULES.QUAL_COURSE_TYPE]: ["4.4"],
  [MODULES.QUAL_COURSE_SUBSCRIPTION]: ["4.4"],
  [MODULES.QUAL_CALENDAR_PLAN]: ["4.4"],
  [MODULES.QUAL_CONTRACT]: ["4.4"],
  [MODULES.QUAL_PAYMENT]: ["4.4"],
  [MODULES.QUAL_PETITION]: ["4.4"],
  [MODULES.QUAL_SOURCE]: ["4.4"],
  [MODULES.QUAL_TEACHER]: ["4.4"],
  [MODULES.QUAL_TOPIC]: ["4.4"],
  [MODULES.QUAL_NOTIFICATION]: ["4.4"],
  [MODULES.QUAL_ACCESS_TEST_RESULT]: ["4.4"],
  [MODULES.QUAL_FINAL_TEST_RESULT]: ["4.4"],
  [MODULES.QUAL_EXIT_TEST_RESULT]: ["4.4"],
  [MODULES.QUAL_TOPIC_COMPLETION]: ["4.4"],
  [MODULES.QUAL_TOPIC_LECTURE]: ["4.4"],
  [MODULES.QUAL_TOPIC_PRACTICAL]: ["4.4"],
  [MODULES.QUAL_TOPIC_VIDEO]: ["4.4"],
  [MODULES.QUAL_TOPIC_SCENARIO]: ["4.4"],
  [MODULES.QUAL_TOPIC_FINAL_TEST]: ["4.4"],
  [MODULES.QUAL_ACCESS_TEST]: ["4.4"],
  [MODULES.QUAL_EXIT_TEST]: ["4.4"],
  [MODULES.QUAL_TEST_CONFIG]: ["4.4"],
  [MODULES.QUAL_LISTENER_PORTAL]: ["4.4"],

  [MODULES.RESIDENT]: ["4.5"],
  [MODULES.RESIDENCY_SPECIALTY]: ["4.5"],
  [MODULES.RESIDENCY_ACTIVITY_PLAN]: ["4.5"],
  [MODULES.RESIDENCY_DISSERTATION_PLAN]: ["4.5"],
  [MODULES.RESIDENCY_THEORY_TOPIC]: ["4.5"],
  [MODULES.RESIDENCY_SKILL]: ["4.5"],
  [MODULES.RESIDENCY_ATTESTATION]: ["4.5"],
  [MODULES.RESIDENCY_CURRICULUM]: ["4.5"],
  [MODULES.RESIDENCY_LESSON]: ["4.5"],
  [MODULES.RESIDENCY_NOTICE]: ["4.5"],
  [MODULES.RESIDENCY_PROBLEM_STUDENT]: ["4.5"],
  [MODULES.RESIDENCY_ANNOUNCEMENT]: ["4.5"],
  [MODULES.RESIDENCY_REPORT]: ["4.5"],
  [MODULES.RESIDENT_APPLICATION]: ["4.5"],
  [MODULES.RESIDENT_ATTENDANCE]: ["4.5"],
  [MODULES.RESIDENT_DAILY_LOG]: ["4.5"],
  [MODULES.RESIDENT_ASSESSMENT]: ["4.5"],
  [MODULES.RESIDENT_RESOURCE]: ["4.5"],
  [MODULES.RESIDENCY_OPEN_LESSON]: ["4.5"],
  [MODULES.DISSERTATION]: ["4.5", "4.6"],
  [MODULES.STUDENT]: ["4.5"],
  [MODULES.STUDENT_ATTENDANCE]: ["4.5"],
  [MODULES.GRADEBOOK]: ["4.5"],
  [MODULES.EXAM]: ["4.5"],

  [MODULES.SCIENCE_COUNCIL]: ["4.6"],
  [MODULES.SCIENTIFIC_WORK]: ["4.6"],
  [MODULES.WORK_REVIEW]: ["4.6"],
  [MODULES.WORK_DECISION]: ["4.6"],

  [MODULES.TASK]: ["4.7"],
  [MODULES.TASK_CATEGORY]: ["4.7"],

  [MODULES.INTERNATIONAL_ADMISSION]: ["4.8"],
  [MODULES.ADMISSION_SEASON]: ["4.8"],
  [MODULES.ADMISSION_DIRECTION]: ["4.8"],
  [MODULES.ADMISSION_EDUCATION_FORM]: ["4.8"],
  [MODULES.ADMISSION_EDUCATION_LANGUAGE]: ["4.8"],
  [MODULES.ADMISSION_COUNTRY]: ["4.8"],
  [MODULES.ADMISSION_OFFER]: ["4.8"],
  [MODULES.ADMISSION_MESSAGE]: ["4.8"],

  [MODULES.COUNCIL_MEMBER]: ["4.9"],
  [MODULES.COUNCIL_TASK]: ["4.9"],
  [MODULES.RANK_APPLICATION]: ["4.9"],
  [MODULES.VOTING_SESSION]: ["4.9"],
  [MODULES.ANONYMOUS_VOTE]: ["4.9"],

  [MODULES.ARTICLE]: ["4.10"],
  [MODULES.MONOGRAPH]: ["4.10"],
  [MODULES.THESIS]: ["4.10"],
  [MODULES.PATENT]: ["4.10"],
  [MODULES.COPYRIGHT]: ["4.10"],
  [MODULES.CONFERENCE]: ["4.10"],
  [MODULES.METHODICAL_RECOMMENDATION]: ["4.10"],
  [MODULES.ANNUAL_REPORT]: ["4.10"],
  [MODULES.DEPARTMENT_WORK_PLAN]: ["4.10"],
  [MODULES.QUALIFYING_APPLICANT]: ["4.10"],
  [MODULES.ECONOMIC_CONTRACT]: ["4.10"],
  [MODULES.OAK_JOURNAL]: ["4.10"],
  [MODULES.THESIS_CATEGORY]: ["4.10"],
  [MODULES.SCIENTIFIC_TEMPLATE]: ["4.10"],
  [MODULES.H_INDEX]: ["4.10"],
  [MODULES.SCIENTIFIC_DEGREE]: ["4.10"],
  [MODULES.SCIENTIFIC_TITLE]: ["4.10"],
  [MODULES.DEFENSE]: ["4.10"],
  [MODULES.EXAM_SPECIALTY]: ["4.10"],
  [MODULES.SCIENTIFIC_POST]: ["4.10"],
  [MODULES.SCIENTIFIC_PORTAL]: ["4.10"],
  [MODULES.METHODICAL_SPECIALTY]: ["4.10"],
  [MODULES.STARTUP]: ["4.10"],
  [MODULES.STARTUP_TYPE]: ["4.10"],

  [MODULES.GIFTED_STUDENT]: ["4.11"],
  [MODULES.EVALUATION_CRITERIA]: ["4.11"],
  [MODULES.STUDENT_ACHIEVEMENT]: ["4.11"],
  [MODULES.SCHOLARSHIP_APPLICATION]: ["4.11"],
  [MODULES.SCHOLARSHIP]: ["4.11"],
  [MODULES.DOCUMENT_TYPE]: ["4.11"],

  [MODULES.INDICATOR]: ["4.12"],
  [MODULES.EQ_INDICATOR]: ["4.12"],
  [MODULES.EQ_SUBMISSION]: ["4.12"],
  [MODULES.EQ_ANNOUNCEMENT]: ["4.12"],
  [MODULES.EQ_REPORT]: ["4.12"],
  [MODULES.INDICATOR_SUBMISSION]: ["4.12"],

  [MODULES.PRACTICE]: ["4.13"],
  [MODULES.MEDICAL_ORGANIZATION]: ["4.13"],
  [MODULES.ORG_TYPE]: ["4.13"],
  [MODULES.PRACTICE_STUDENT]: ["4.13"],

  [MODULES.PROVINCE]: ["references"],
  [MODULES.REGION]: ["references"],
  [MODULES.FACULTY]: ["references"],
  [MODULES.DEPARTMENT]: ["references"],
  [MODULES.COURSE]: ["references"],
  [MODULES.GROUP]: ["references"],
  [MODULES.ROOM]: ["references"],
  [MODULES.POSITION]: ["references"],
  [MODULES.DIRECTION]: ["references"],
  [MODULES.DIVISION]: ["references"],
  [MODULES.SCIENCE]: ["references"],
  [MODULES.SCIENCE_BRANCH]: ["references"],
  [MODULES.ACADEMIC_LEVEL]: ["references"],
  [MODULES.ACADEMIC_TITLE]: ["references"],
  [MODULES.AUDITORIUM_HOUR]: ["references"],
  [MODULES.EDUCATION_FORM]: ["references"],
  [MODULES.EDUCATION_ACTIVITY_TYPE]: ["references"],
  [MODULES.READING_FORM]: ["references"],
  [MODULES.SPECIALIZATION]: ["references"],
  [MODULES.STUDY_PERIOD]: ["references"],
  [MODULES.ACADEMIC_YEAR]: ["references"],
  [MODULES.ASSESSMENT_TYPE]: ["references"],
  [MODULES.COUNTRY]: ["references"],
  [MODULES.PUBLIC_OFFER]: ["references"],
  [MODULES.LANGUAGE_OF_INSTRUCTION]: ["references"],

  [MODULES.NOTIFICATION]: ["system"],
  [MODULES.NOTIFICATION_PREFERENCE]: ["system"],
  [MODULES.SLA_CONFIG]: ["system"],
  [MODULES.APPROVAL_CHAIN]: ["system"],
  [MODULES.ANNOUNCEMENT]: ["system"],
  [MODULES.CHAT]: ["system"],
  [MODULES.REPORT]: ["system"],
  [MODULES.DASHBOARD]: ["system"],
  [MODULES.STATISTICS]: ["4.2"],
};

const CRUD_ACTIONS = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
  ACTIONS.SEARCH,
  ACTIONS.FILTER,
];

const APPROVAL_ACTIONS = [
  ...CRUD_ACTIONS,
  ACTIONS.APPROVE,
  ACTIONS.REJECT,
  ACTIONS.SIGN,
  ACTIONS.EXPORT,
];

const APPROVAL_WITH_STATUS = [...APPROVAL_ACTIONS, ACTIONS.CHANGE_STATUS];

const READ_ONLY = [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.SEARCH, ACTIONS.FILTER];

const MODULE_ACTIONS_OVERRIDE = {
  [MODULES.AUTH]: READ_ONLY,
  [MODULES.USER]: [...CRUD_ACTIONS, ACTIONS.CHANGE_STATUS, ACTIONS.EXPORT],
  [MODULES.ROLE]: [...CRUD_ACTIONS, ACTIONS.CHANGE_STATUS, ACTIONS.GRANT_ANY],
  [MODULES.PERMISSION]: CRUD_ACTIONS,
  [MODULES.AUDIT_LOG]: [...READ_ONLY, ACTIONS.EXPORT],

  [MODULES.STUDY_PLAN]: APPROVAL_ACTIONS,
  [MODULES.WORKING_PLAN]: APPROVAL_ACTIONS,
  [MODULES.WORKING_SCHEDULE]: APPROVAL_ACTIONS,
  [MODULES.WORKLOAD]: APPROVAL_WITH_STATUS,
  [MODULES.WORKLOAD_DISTRIBUTION]: APPROVAL_WITH_STATUS,
  [MODULES.WORKLOAD_SUMMARY]: APPROVAL_ACTIONS,
  [MODULES.CONTINGENT_REPORT]: APPROVAL_ACTIONS,
  [MODULES.SYLLABUS]: APPROVAL_ACTIONS,
  [MODULES.SCIENCE_PROGRAM]: APPROVAL_ACTIONS,
  [MODULES.LEARNING_PROCESS]: APPROVAL_ACTIONS,
  [MODULES.TEACHER_LEAVE]: APPROVAL_ACTIONS,

  [MODULES.TEACHER]: [
    ...CRUD_ACTIONS,
    ACTIONS.APPROVE,
    ACTIONS.REJECT,
    ACTIONS.EXPORT,
    ACTIONS.CHANGE_STATUS,
  ],
  [MODULES.PERSONAL_WORK_PLAN]: [...APPROVAL_ACTIONS, ACTIONS.REVIEW],
  [MODULES.STAFF]: [...CRUD_ACTIONS, ACTIONS.EXPORT],

  [MODULES.QUAL_COURSE]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
  [MODULES.QUAL_CONTRACT]: APPROVAL_ACTIONS,
  [MODULES.QUAL_PETITION]: APPROVAL_ACTIONS,
  [MODULES.QUAL_LISTENER_PORTAL]: [ACTIONS.READ],
  [MODULES.QUAL_TEST_CONFIG]: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE],

  [MODULES.RESIDENT]: [...CRUD_ACTIONS, ACTIONS.EXPORT, ACTIONS.CHANGE_STATUS],
  [MODULES.RESIDENCY_ACTIVITY_PLAN]: APPROVAL_ACTIONS,
  [MODULES.RESIDENCY_DISSERTATION_PLAN]: APPROVAL_ACTIONS,
  [MODULES.RESIDENCY_NOTICE]: APPROVAL_ACTIONS,
  [MODULES.RESIDENT_APPLICATION]: APPROVAL_ACTIONS,
  [MODULES.RESIDENT_DAILY_LOG]: APPROVAL_ACTIONS,
  [MODULES.RESIDENT_ATTENDANCE]: [...CRUD_ACTIONS, ACTIONS.APPROVE],
  [MODULES.RESIDENT_ASSESSMENT]: [...CRUD_ACTIONS, ACTIONS.EXPORT, ACTIONS.SCORE],
  [MODULES.RESIDENCY_OPEN_LESSON]: CRUD_ACTIONS,
  [MODULES.DISSERTATION]: APPROVAL_ACTIONS,

  [MODULES.SCIENCE_COUNCIL]: [
    ...CRUD_ACTIONS,
    ACTIONS.CHANGE_STATUS,
    ACTIONS.REVIEW,
    ACTIONS.SIGN,
    ACTIONS.DASHBOARD,
    ACTIONS.MANAGE_MEMBERS,
    ACTIONS.SUBMIT_WORK,
    ACTIONS.NOTIFICATIONS,
  ],
  [MODULES.SCIENTIFIC_WORK]: APPROVAL_ACTIONS,
  [MODULES.WORK_REVIEW]: CRUD_ACTIONS,
  [MODULES.WORK_DECISION]: APPROVAL_ACTIONS,

  [MODULES.TASK]: [
    ...CRUD_ACTIONS,
    ACTIONS.CHANGE_STATUS,
    ACTIONS.EXPORT,
    ACTIONS.MANAGE_MEMBERS,
  ],
  [MODULES.TASK_CATEGORY]: CRUD_ACTIONS,

  [MODULES.INTERNATIONAL_ADMISSION]: [
    ...CRUD_ACTIONS,
    ACTIONS.APPROVE,
    ACTIONS.REJECT,
    ACTIONS.EXPORT,
  ],
  [MODULES.ADMISSION_DIRECTION]: CRUD_ACTIONS,
  [MODULES.ADMISSION_EDUCATION_FORM]: CRUD_ACTIONS,
  [MODULES.ADMISSION_EDUCATION_LANGUAGE]: CRUD_ACTIONS,
  [MODULES.ADMISSION_COUNTRY]: CRUD_ACTIONS,
  [MODULES.ADMISSION_OFFER]: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE],
  [MODULES.ADMISSION_SEASON]: [...CRUD_ACTIONS, ACTIONS.CHANGE_STATUS],
  [MODULES.ADMISSION_MESSAGE]: [
    ACTIONS.CREATE,
    ACTIONS.READ,
    ACTIONS.READ_ALL,
    ACTIONS.SEARCH,
    ACTIONS.FILTER,
    ACTIONS.EXPORT,
  ],

  [MODULES.COUNCIL_MEMBER]: CRUD_ACTIONS,
  [MODULES.COUNCIL_TASK]: [
    ...CRUD_ACTIONS,
    ACTIONS.APPROVE,
    ACTIONS.REJECT,
    ACTIONS.CHANGE_STATUS,
  ],
  [MODULES.RANK_APPLICATION]: APPROVAL_ACTIONS,
  [MODULES.VOTING_SESSION]: APPROVAL_WITH_STATUS,
  [MODULES.ANONYMOUS_VOTE]: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL],
  [MODULES.RESIDENCY_REPORT]: [ACTIONS.READ_ALL],

  [MODULES.ARTICLE]: APPROVAL_ACTIONS,
  [MODULES.MONOGRAPH]: APPROVAL_ACTIONS,
  [MODULES.THESIS]: APPROVAL_ACTIONS,
  [MODULES.PATENT]: APPROVAL_ACTIONS,
  [MODULES.COPYRIGHT]: APPROVAL_ACTIONS,
  [MODULES.CONFERENCE]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
  [MODULES.STARTUP]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
  [MODULES.METHODICAL_RECOMMENDATION]: APPROVAL_ACTIONS,
  [MODULES.ANNUAL_REPORT]: APPROVAL_ACTIONS,
  [MODULES.DEPARTMENT_WORK_PLAN]: APPROVAL_ACTIONS,
  [MODULES.QUALIFYING_APPLICANT]: [
    ...CRUD_ACTIONS,
    ACTIONS.APPROVE,
    ACTIONS.REJECT,
    ACTIONS.CHANGE_STATUS,
    ACTIONS.EXPORT,
  ],
  [MODULES.ECONOMIC_CONTRACT]: APPROVAL_ACTIONS,
  [MODULES.SCIENTIFIC_DEGREE]: [...CRUD_ACTIONS, ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.EXPORT],
  [MODULES.SCIENTIFIC_TITLE]: [...CRUD_ACTIONS, ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.EXPORT],
  [MODULES.DEFENSE]: [...CRUD_ACTIONS, ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.EXPORT],
  [MODULES.SCIENTIFIC_PORTAL]: [ACTIONS.READ, ACTIONS.READ_ALL],

  [MODULES.GIFTED_STUDENT]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
  [MODULES.SCHOLARSHIP]: [...CRUD_ACTIONS],
  [MODULES.SCHOLARSHIP_APPLICATION]: [...APPROVAL_ACTIONS, ACTIONS.SCORE],
  [MODULES.STUDENT_ACHIEVEMENT]: [...CRUD_ACTIONS, ACTIONS.APPROVE, ACTIONS.REJECT],
  [MODULES.DOCUMENT_TYPE]: [...CRUD_ACTIONS],

  [MODULES.INDICATOR]: [...CRUD_ACTIONS, ACTIONS.CHANGE_STATUS],
  [MODULES.EQ_INDICATOR]: EQ.get(MODULES.EQ_INDICATOR).actionKeys,
  [MODULES.EQ_SUBMISSION]: EQ.get(MODULES.EQ_SUBMISSION).actionKeys,
  [MODULES.EQ_ANNOUNCEMENT]: EQ.get(MODULES.EQ_ANNOUNCEMENT).actionKeys,
  [MODULES.EQ_REPORT]: EQ.get(MODULES.EQ_REPORT).actionKeys,
  [MODULES.INDICATOR_SUBMISSION]: [
    ...CRUD_ACTIONS,
    ACTIONS.APPROVE,
    ACTIONS.REJECT,
    ACTIONS.EXPORT,
  ],

  [MODULES.PRACTICE]: APPROVAL_WITH_STATUS,
  [MODULES.MEDICAL_ORGANIZATION]: CRUD_ACTIONS,
  [MODULES.PRACTICE_STUDENT]: [...CRUD_ACTIONS, ACTIONS.EXPORT],

  [MODULES.APPROVAL_CHAIN]: [...CRUD_ACTIONS, ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.SIGN],
  [MODULES.ANNOUNCEMENT]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
  [MODULES.CHAT]: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.DELETE],
  [MODULES.REPORT]: [
    ACTIONS.CREATE,
    ACTIONS.READ,
    ACTIONS.READ_ALL,
    ACTIONS.UPDATE,
    ACTIONS.DELETE,
    ACTIONS.EXPORT,
    ACTIONS.SEARCH,
    ACTIONS.FILTER,
  ],
  [MODULES.DASHBOARD]: [ACTIONS.READ],
  [MODULES.STATISTICS]: [ACTIONS.READ],
  [MODULES.NOTIFICATION]: [
    ACTIONS.READ,
    ACTIONS.READ_ALL,
    ACTIONS.UPDATE,
    ACTIONS.DELETE,
  ],
  [MODULES.NOTIFICATION_PREFERENCE]: [ACTIONS.READ, ACTIONS.UPDATE],
  [MODULES.SLA_CONFIG]: CRUD_ACTIONS,
  [MODULES.GRADEBOOK]: [...CRUD_ACTIONS, ACTIONS.EXPORT, ACTIONS.CHANGE_STATUS],
  [MODULES.EXAM]: [...CRUD_ACTIONS, ACTIONS.CHANGE_STATUS],

  [MODULES.STUDENT]: [...CRUD_ACTIONS, ACTIONS.EXPORT, ACTIONS.CHANGE_STATUS],
  [MODULES.STUDENT_ATTENDANCE]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
};

const MODULE_TITLES = {
  [MODULES.AUTH]: "Autentifikatsiya",
  [MODULES.USER]: "Foydalanuvchilar",
  [MODULES.ROLE]: "Rollar",
  [MODULES.PERMISSION]: "Ruxsatlar",
  [MODULES.AUDIT_LOG]: "Loglar (audit jurnali)",
  [MODULES.PERMISSION_GROUP]: "Ruxsat guruhlari",
  [MODULES.STAFF]: "Xodimlar",
  [MODULES.QUAL_PAYMENT]: "Malaka oshirish to'lovlari",
  [MODULES.FACULTY]: "Fakultetlar",
  [MODULES.DEPARTMENT]: "Kafedralar",
  [MODULES.COURSE]: "Kurslar",
  [MODULES.GROUP]: "Guruhlar",
  [MODULES.ROOM]: "Xonalar",
  [MODULES.POSITION]: "Lavozimlar",
  [MODULES.DIRECTION]: "Yo'nalishlar",
  [MODULES.DIVISION]: "Bo'limlar",
  [MODULES.SCIENCE]: "Fanlar",
  [MODULES.SCIENCE_BRANCH]: "Fan tarmog'i",
  [MODULES.ACADEMIC_LEVEL]: "Akademik daraja",
  [MODULES.ACADEMIC_TITLE]: "Ilmiy unvon",
  [MODULES.AUDITORIUM_HOUR]: "Auditoriya soat normasi",
  [MODULES.EDUCATION_FORM]: "Ta'lim shakli",
  [MODULES.EDUCATION_ACTIVITY_TYPE]: "Ta'lim faoliyat turi",
  [MODULES.READING_FORM]: "O'qish shakli",
  [MODULES.SPECIALIZATION]: "Mutaxassislik",
  [MODULES.STUDY_PERIOD]: "O'qish muddati",
  [MODULES.ACADEMIC_YEAR]: "O'quv yili",
  [MODULES.ASSESSMENT_TYPE]: "Yakuniy baholash turi",
  [MODULES.WORKLOAD]: "O'quv yuklamasi",
  [MODULES.WORKLOAD_DISTRIBUTION]: "Yuklama taqsimoti",
  [MODULES.WORKLOAD_SUMMARY]: "Kafedralar soatlar hisobi",
  [MODULES.CONTINGENT_REPORT]: "Talabalar kontingenti hisoboti",
  [MODULES.DEPARTMENT_CONTINGENT]: "Kafedra kontingenti",
  [MODULES.WORKING_PLAN]: "Ishchi o'quv reja",
  [MODULES.WORKING_SCHEDULE]: "Ishchi o'quv jadval",
  [MODULES.STUDY_PLAN]: "O'quv reja",
  [MODULES.SYLLABUS]: "Sillabus",
  [MODULES.SCIENCE_PROGRAM]: "Fan dasturi",
  [MODULES.LEARNING_PROCESS]: "O'quv jarayoni",
  [MODULES.TEACHER_LEAVE]: "O'qituvchi arizalari (4.2.9)",
  [MODULES.SCHEDULE]: "Dars jadvali",
  [MODULES.TIME_SLOT]: "Vaqt oraliqlari",
  [MODULES.TEACHER]: "O'qituvchilar",
  [MODULES.PERSONAL_WORK_PLAN]: "Shaxsiy ish reja",
  [MODULES.STUDENT]: "Talabalar",
  [MODULES.STUDENT_ATTENDANCE]: "Talaba davomati",
  [MODULES.GRADEBOOK]: "Baho jurnali",
  [MODULES.EXAM]: "Imtihonlar",
  [MODULES.QUAL_COURSE]: "Malaka kurslari",
  [MODULES.QUAL_COURSE_TYPE]: "Kurs turlari",
  [MODULES.QUAL_COURSE_SUBSCRIPTION]: "Kurs obunalari",
  [MODULES.QUAL_CALENDAR_PLAN]: "Kalendar reja",
  [MODULES.QUAL_CONTRACT]: "Malaka shartnomalari",
  [MODULES.QUAL_PETITION]: "Malaka arizalari",
  [MODULES.QUAL_SOURCE]: "Malaka manbalari",
  [MODULES.QUAL_TEACHER]: "Malaka o'qituvchilari",
  [MODULES.QUAL_TOPIC]: "Mavzular",
  [MODULES.QUAL_NOTIFICATION]: "Malaka bildirishnomalari",
  [MODULES.QUAL_ACCESS_TEST_RESULT]: "Kirish test natijalari",
  [MODULES.QUAL_FINAL_TEST_RESULT]: "Yakuniy test natijalari",
  [MODULES.QUAL_EXIT_TEST_RESULT]: "Chiqish test natijalari",
  [MODULES.QUAL_TOPIC_COMPLETION]: "Mavzu o'zlashtirishi",
  [MODULES.QUAL_TOPIC_LECTURE]: "Mavzu ma'ruzalari",
  [MODULES.QUAL_TOPIC_PRACTICAL]: "Mavzu amaliy materiallari",
  [MODULES.QUAL_TOPIC_VIDEO]: "Mavzu video darslari",
  [MODULES.QUAL_TOPIC_SCENARIO]: "Mavzu vaziyatli masalalari",
  [MODULES.QUAL_TOPIC_FINAL_TEST]: "Mavzu yakuniy testi",
  [MODULES.QUAL_ACCESS_TEST]: "Kirish testi savollari",
  [MODULES.QUAL_EXIT_TEST]: "Chiqish testi savollari",
  [MODULES.QUAL_TEST_CONFIG]: "Test sozlamalari",
  [MODULES.QUAL_LISTENER_PORTAL]: "Tinglovchi portali (menyu belgisi)",
  [MODULES.RESIDENT]: "Rezidentlar",
  [MODULES.RESIDENCY_SPECIALTY]: "Rezidentura mutaxassisliklari",
  [MODULES.RESIDENCY_ACTIVITY_PLAN]: "Faoliyat rejasi",
  [MODULES.RESIDENCY_DISSERTATION_PLAN]: "Dissertatsiya rejasi",
  [MODULES.RESIDENCY_THEORY_TOPIC]: "Nazariy va umumiy bilim",
  [MODULES.RESIDENCY_SKILL]: "Klinik ko'nikmalar",
  [MODULES.RESIDENCY_ATTESTATION]: "Attestatsiyalar",
  [MODULES.RESIDENCY_CURRICULUM]: "O'quv reja",
  [MODULES.RESIDENCY_LESSON]: "Umumiy darslar",
  [MODULES.RESIDENCY_NOTICE]: "Bildirgilar",
  [MODULES.RESIDENCY_PROBLEM_STUDENT]: "Muammoli talabalar",
  [MODULES.RESIDENCY_ANNOUNCEMENT]: "Rezidentura e'lonlari",
  [MODULES.RESIDENCY_REPORT]: "Rezidentura hisobotlari",
  [MODULES.RESIDENT_APPLICATION]: "Rezident arizalari",
  [MODULES.RESIDENT_ATTENDANCE]: "Rezident davomati",
  [MODULES.RESIDENT_DAILY_LOG]: "Klinik kundalik",
  [MODULES.RESIDENT_ASSESSMENT]: "Rezident baholash",
  [MODULES.RESIDENT_RESOURCE]: "Rezident manbalari",
  [MODULES.RESIDENCY_OPEN_LESSON]: "Ochiq dars biriktirish",
  [MODULES.DISSERTATION]: "Dissertatsiya",
  [MODULES.COUNCIL_MEMBER]: "Kengash a'zolari",
  [MODULES.COUNCIL_TASK]: "Kengash topshiriqlari",
  [MODULES.RANK_APPLICATION]: "Unvon arizalari",
  [MODULES.VOTING_SESSION]: "Ovoz berish",
  [MODULES.ANONYMOUS_VOTE]: "Anonim ovozlar",
  [MODULES.SCIENCE_COUNCIL]: "Ilmiy kengash (modul)",
  [MODULES.SCIENTIFIC_WORK]: "Ilmiy ishlar",
  [MODULES.WORK_REVIEW]: "Ish taqrizlari",
  [MODULES.WORK_DECISION]: "Ish qarorlari",
  [MODULES.ARTICLE]: "Ilmiy maqolalar",
  [MODULES.MONOGRAPH]: "Monografiyalar",
  [MODULES.THESIS]: "Tezislar",
  [MODULES.PATENT]: "Patentlar",
  [MODULES.COPYRIGHT]: "Mualliflik huquqi",
  [MODULES.CONFERENCE]: "Konferensiyalar",
  [MODULES.METHODICAL_RECOMMENDATION]: "Uslubiy tavsiyalar",
  [MODULES.ANNUAL_REPORT]: "Yillik hisobotlar",
  [MODULES.DEPARTMENT_WORK_PLAN]: "Kafedra ish rejasi",
  [MODULES.QUALIFYING_APPLICANT]: "Malakaviy talabgorlar",
  [MODULES.ECONOMIC_CONTRACT]: "X/Sh shartnomalar (4.10.9)",
  [MODULES.OAK_JOURNAL]: "OAK jurnallari",
  [MODULES.THESIS_CATEGORY]: "Tezis toifalari",
  [MODULES.SCIENTIFIC_TEMPLATE]: "Ilmiy namunalar",
  [MODULES.H_INDEX]: "H-indeks",
  [MODULES.SCIENTIFIC_DEGREE]: "Ilmiy darajalar",
  [MODULES.SCIENTIFIC_TITLE]: "Ilmiy unvonlar",
  [MODULES.DEFENSE]: "Himoya",
  [MODULES.EXAM_SPECIALTY]: "Imtihon mutaxassisliklari",
  [MODULES.SCIENTIFIC_POST]: "Ilmiy bo'lim e'lonlari",
  [MODULES.SCIENTIFIC_PORTAL]: "Ilmiy bo'lim portali (menyu belgisi)",
  [MODULES.METHODICAL_SPECIALTY]: "Uslubiy ixtisosliklar",
  [MODULES.STARTUP]: "Startaplar",
  [MODULES.STARTUP_TYPE]: "Startap loyiha turlari",
  [MODULES.INDICATOR]: "Sifat indikatorlari",
  [MODULES.INDICATOR_SUBMISSION]: "Indikator yuborilmalari",
  [MODULES.EQ_INDICATOR]: EQ.get(MODULES.EQ_INDICATOR).title,
  [MODULES.EQ_SUBMISSION]: EQ.get(MODULES.EQ_SUBMISSION).title,
  [MODULES.EQ_ANNOUNCEMENT]: EQ.get(MODULES.EQ_ANNOUNCEMENT).title,
  [MODULES.EQ_REPORT]: EQ.get(MODULES.EQ_REPORT).title,
  [MODULES.GIFTED_STUDENT]: "Iqtidorli talabalar",
  [MODULES.EVALUATION_CRITERIA]: "Baholash mezonlari",
  [MODULES.STUDENT_ACHIEVEMENT]: "Talaba yutuqlari",
  [MODULES.SCHOLARSHIP_APPLICATION]: "Stipendiya arizasi",
  [MODULES.SCHOLARSHIP]: "Stipendiyalar",
  [MODULES.DOCUMENT_TYPE]: "Faoliyat/hujjat turlari",
  [MODULES.PRACTICE]: "Amaliyot",
  [MODULES.MEDICAL_ORGANIZATION]: "Tibbiyot tashkilotlari",
  [MODULES.ORG_TYPE]: "Tashkilot turlari",
  [MODULES.PROVINCE]: "Viloyatlar",
  [MODULES.REGION]: "Shahar / Tumanlar",
  [MODULES.PRACTICE_STUDENT]: "Amaliyot talabalari",
  [MODULES.TASK]: "Topshiriqlar (4.7)",
  [MODULES.TASK_CATEGORY]: "Topshiriq kategoriyalari (4.7)",
  [MODULES.ANNOUNCEMENT]: "E'lonlar",
  [MODULES.CHAT]: "Chat",
  [MODULES.APPROVAL_CHAIN]: "Tasdiqlash zanjiri",
  [MODULES.REPORT]: "Hisobotlar",
  [MODULES.DASHBOARD]: "Boshqaruv paneli (rektor)",
  [MODULES.STATISTICS]: "Statistika (O'UB, 4.2)",
  [MODULES.INTERNATIONAL_ADMISSION]: "Xorijiy qabul (4.8)",
  [MODULES.ADMISSION_SEASON]: "Qabul mavsumlari (4.8)",
  [MODULES.ADMISSION_DIRECTION]: "Qabul yo'nalishlari (4.8)",
  [MODULES.ADMISSION_EDUCATION_FORM]: "Qabul ta'lim shakllari (4.8)",
  [MODULES.ADMISSION_EDUCATION_LANGUAGE]: "Qabul ta'lim tillari (4.8)",
  [MODULES.ADMISSION_COUNTRY]: "Qabul davlatlari (4.8)",
  [MODULES.ADMISSION_OFFER]: "Qabul ommaviy ofertasi (4.8)",
  [MODULES.ADMISSION_MESSAGE]: "Abituriyent xabarlari (4.8)",
  [MODULES.COUNTRY]: "Davlatlar",
  [MODULES.PUBLIC_OFFER]: "Ommaviy oferta",
  [MODULES.LANGUAGE_OF_INSTRUCTION]: "O'qish tili",
  [MODULES.NOTIFICATION]: "In-app bildirishnomalar",
  [MODULES.NOTIFICATION_PREFERENCE]: "Bildirishnoma sozlamalari",
  [MODULES.SLA_CONFIG]: "SLA konfiguratsiyalari",
};

const getActionKeysForModule = (section) => {
  return MODULE_ACTIONS_OVERRIDE[section] || CRUD_ACTIONS;
};

const getTitleForModule = (section) =>
  MODULE_TITLES[section] || section;

async function seed() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[Permissions Seed] Connected to MongoDB");

  const canonicalSections = Object.values(MODULES);
  const canonicalSet = new Set(canonicalSections);

  const groups = await PermissionGroup.find({ active: true })
    .select("code")
    .lean();
  const groupCodeToId = new Map(groups.map((g) => [g.code, g._id]));
  console.log(`[Permissions Seed] PermissionGroups loaded: ${groupCodeToId.size}`);
  if (groupCodeToId.size === 0) {
    console.warn(
      `[Permissions Seed] ⚠ PermissionGroups bo'sh — avval permissionGroups.seed.js ni ishga tushiring`,
    );
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let deactivated = 0;
  let linked = 0;
  let unlinked = 0;

  for (const section of canonicalSections) {
    const actionKeys = getActionKeysForModule(section);
    const title = getTitleForModule(section);
    const groupCodes = SECTION_TO_GROUPS[section] || [];
    const groupIds = groupCodes
      .map((code) => groupCodeToId.get(code))
      .filter(Boolean);
    if (groupIds.length > 0) linked++;
    else unlinked++;

    const existing = await Permission.findOne({ section });

    if (!existing) {
      await Permission.create({
        section,
        title,
        actionKeys,
        groups: groupIds,
        active: true,
      });
      created++;
      console.log(
        `  + ${section.padEnd(35)} [CREATED] ${actionKeys.length} action ${groupCodes.length ? "→ [" + groupCodes.join(",") + "]" : ""}`,
      );
    } else {
      const existingGroupIds = (existing.groups || []).map((g) => String(g));
      const newGroupIds = groupIds.map((g) => String(g));
      const sameGroups =
        existingGroupIds.length === newGroupIds.length &&
        existingGroupIds.every((id) => newGroupIds.includes(id));

      const needsUpdate =
        existing.title !== title ||
        existing.active !== true ||
        !sameGroups ||
        !arraysEqual(existing.actionKeys || [], actionKeys);

      if (needsUpdate) {
        existing.title = title;
        existing.actionKeys = actionKeys;
        existing.groups = groupIds;
        existing.active = true;
        if (existing.group !== undefined) {
          existing.group = undefined;
        }
        await existing.save();
        updated++;
        console.log(
          `  ~ ${section.padEnd(35)} [UPDATED] ${actionKeys.length} action ${groupCodes.length ? "→ [" + groupCodes.join(",") + "]" : ""}`,
        );
      } else {
        unchanged++;
      }
    }
  }

  const dbAll = await Permission.find({}, { section: 1, active: 1 });
  for (const doc of dbAll) {
    if (!canonicalSet.has(doc.section) && doc.active !== false) {
      doc.active = false;
      await doc.save();
      deactivated++;
      console.log(`  - ${doc.section.padEnd(35)} [DEACTIVATED] (constants'da yo'q)`);
    }
  }

  const total = await Permission.countDocuments({});
  const activeTotal = await Permission.countDocuments({ active: true });

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Created:      ${created}`);
  console.log(`  Updated:      ${updated}`);
  console.log(`  Unchanged:    ${unchanged}`);
  console.log(`  Deactivated:  ${deactivated}`);
  console.log("───────────────────────────────────────────────────");
  console.log(`  Group linked:   ${linked}/${canonicalSections.length}`);
  console.log(`  Group unlinked: ${unlinked} (mapping yo'q)`);
  console.log("───────────────────────────────────────────────────");
  console.log(`  DB total:     ${total}`);
  console.log(`  DB active:    ${activeTotal}`);
  console.log(`  Canonical:    ${canonicalSections.length}`);
  console.log("═══════════════════════════════════════════════════\n");

  if (activeTotal === canonicalSections.length) {
    console.log("✅ RBAC INTEGRITY: DB va constants to'liq mos");
  } else {
    console.log(
      `⚠ RBAC drift: active=${activeTotal} vs canonical=${canonicalSections.length}`,
    );
  }

  await mongoose.disconnect();
  process.exit(0);
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

seed().catch((err) => {
  console.error("[Permissions Seed] ERROR:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
