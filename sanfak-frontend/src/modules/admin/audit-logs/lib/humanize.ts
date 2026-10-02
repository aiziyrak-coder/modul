import type { AuditLogEntry } from '../api/audit-log-api';

export const cleanSegment = (raw: string): string => (raw || '').split('?')[0] ?? '';

const IRREGULAR: Record<string, string> = {
  syllabi: 'syllabus',
  theses: 'thesis',
  'thesis-categories': 'thesisCategory',
  faculties: 'faculty',
  specialties: 'residencySpecialty',
  'academic-levels': 'academicLevel',
  'academic-titles': 'academicTitle',
  'academic-years': 'academicYear',
  studyPeriods: 'studyPeriod',
  'auditorium-hour': 'auditoriumHour',
  'language-of-instruction': 'languageOfInstruction',
  'evaluation-criterias': 'evaluationCriteria',
  'learning-process': 'learningProcess',
  'approval-inbox': 'workload',
  'approval-chains': 'approvalChain',
  'international-admission': 'internationalAdmission',
  'admission-offer': 'admissionOffer',
  'public-offer': 'publicOffer',
  'personal-work-plans': 'personalWorkPlan',
  'personal-reports': 'personalReport',
  'student-attendance': 'studentAttendance',
  'student-achievements': 'studentAchievement',
  'audit-logs': 'auditLog',
  'permission-groups': 'permissionGroup',
  staff: 'staff',
  auth: 'auth',
  chat: 'chat',
  schedule: 'schedule',
  scienceProgram: 'scienceProgram',
  'science-programs': 'scienceProgram',
  'working-schedules': 'workingSchedule',
  'working-plans': 'workingPlan',
  'study-plans': 'studyPlan',
  'time-slots': 'timeSlot',
  'teacher-leaves': 'teacherLeave',
  distributions: 'workloadDistribution',
  'medical-organizations': 'medicalOrganization',
  'org-types': 'orgType',
  'practice-students': 'practiceStudent',
  'document-types': 'documentType',
  'gifted-students': 'giftedStudent',
  'scholarship-applications': 'scholarshipApplication',
  'council-tasks': 'councilTask',
  'council-announcements': 'announcement',
  'voting-sessions': 'votingSession',
  'anonymous-votes': 'anonymousVote',
  'rank-applications': 'rankApplication',
  'annual-reports': 'annualReport',
  'economic-contracts': 'economicContract',
  'methodical-recommendations': 'methodicalRecommendation',
  'oak-journals': 'oakJournal',
  'exam-specialties': 'examSpecialty',
  'scientific-posts': 'scientificPost',
  'scientific-degrees': 'scientificDegree',
  'scientific-templates': 'scientificTemplate',
  'qualifying-applicants': 'qualifyingApplicant',
  'department-work-plans': 'departmentWorkPlan',
  'h-index-profiles': 'hIndex',
  'indicator-submissions': 'indicatorSubmission',
  'task-categories': 'taskCategory',
  'sla-configs': 'slaConfig',
  'notification-preferences': 'notificationPreference',
  'reading-forms': 'readingForm',
};

const QUAL_PREFIX = /^qualification-/;

const singular = (w: string): string => {
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.endsWith('sses') || w.endsWith('ches') || w.endsWith('shes')) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
};

const kebabToCamel = (s: string): string =>
  s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export const toSectionKey = (rawSegment: string): string => {
  const seg = cleanSegment(rawSegment);
  if (!seg) return '';
  if (IRREGULAR[seg]) return IRREGULAR[seg];
  if (QUAL_PREFIX.test(seg)) {
    return `qual${kebabToCamel(singular(seg.replace(QUAL_PREFIX, '')))
      .replace(/^([a-z])/, (_, c: string) => c.toUpperCase())}`;
  }
  return kebabToCamel(singular(seg));
};

const SUFFIX_VERBS: Array<[RegExp, string]> = [
  [/\/approve$/, 'admin.auditLog.verb.approve'],
  [/\/reject$/, 'admin.auditLog.verb.reject'],
  [/\/return$/, 'admin.auditLog.verb.return'],
  [/\/sign$/, 'admin.auditLog.verb.sign'],
  [/\/submit$/, 'admin.auditLog.verb.submit'],
  [/\/generate(-stream)?$/, 'admin.auditLog.verb.generate'],
  [/\/export$/, 'admin.auditLog.verb.export'],
  [/\/pdf$/, 'admin.auditLog.verb.pdf'],
  [/\/complete$/, 'admin.auditLog.verb.complete'],
  [/\/reopen$/, 'admin.auditLog.verb.reopen'],
  [/\/accept$/, 'admin.auditLog.verb.accept'],
  [/\/active\/[0-9a-f]{24}$/i, 'admin.auditLog.verb.changeStatus'],
];

const PATH_OVERRIDES: Array<[RegExp, string, string]> = [
  [/^\/api\/auth$/, 'admin.auditLog.section.system', 'admin.auditLog.action.login'],
  [/^\/api\/auth\/logout$/, 'admin.auditLog.section.system', 'admin.auditLog.action.logout'],
  [/^\/api\/auth\/refresh$/, 'admin.auditLog.section.system', 'admin.auditLog.action.refresh'],
  [/^\/api\/auth\/profile$/, 'admin.auditLog.section.system', 'admin.auditLog.action.viewProfile'],
  [/^\/api\/auth\/eri-attach$/, 'admin.auditLog.section.eri', 'admin.auditLog.action.eriAttach'],
  [/^\/api\/auth\/eri-detach$/, 'admin.auditLog.section.eri', 'admin.auditLog.action.eriDetach'],
];

const METHOD_VERBS: Record<string, string> = {
  POST: 'admin.auditLog.verb.create',
  PUT: 'admin.auditLog.verb.update',
  PATCH: 'admin.auditLog.verb.update',
  DELETE: 'admin.auditLog.verb.delete',
};

const hasId = (p: string): boolean => /[0-9a-f]{24}/i.test(p);

export interface HumanAction {
  section: string;
  verb: string;
  text: string;
}

export type Translate = (key: string, params?: Record<string, unknown>) => string;

const SENTENCE_KEY = 'admin.auditLog.sentence';

export function humanizeAction(
  entry: AuditLogEntry,
  titles: Record<string, string>,
  t: Translate,
): HumanAction {
  const path = (entry.path || '').split('?')[0] ?? '';

  if (entry.module === 'files' || entry.action.startsWith('DOWNLOAD')) {
    const name = entry.files[0] || t('admin.auditLog.action.fileFallbackName');
    const text = t('admin.auditLog.action.fileDownload', { name });
    return { section: t('admin.auditLog.section.files'), verb: text, text };
  }

  for (const [re, sectionKey, verbKey] of PATH_OVERRIDES) {
    if (re.test(path)) {
      const verb = t(verbKey);
      return { section: t(sectionKey), verb, text: verb };
    }
  }

  const key = toSectionKey(entry.module);
  const section = titles[key] || cleanSegment(entry.module) || t('admin.auditLog.section.unknown');

  for (const [re, verbKey] of SUFFIX_VERBS) {
    if (re.test(path)) {
      const verb = t(verbKey);
      return { section, verb, text: t(SENTENCE_KEY, { section, verb }) };
    }
  }

  const verbKey = METHOD_VERBS[entry.method];
  let verb = verbKey ? t(verbKey) : entry.method.toLowerCase();
  if (entry.method === 'GET') {
    verb = t(hasId(path) ? 'admin.auditLog.verb.viewOne' : 'admin.auditLog.verb.viewList');
  }

  return { section, verb, text: t(SENTENCE_KEY, { section, verb }) };
}

export const isDenied = (status: number | null): boolean =>
  status === 401 || status === 403;
