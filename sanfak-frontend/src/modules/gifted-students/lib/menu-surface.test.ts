import { describe, expect, it } from 'vitest';
import { hasAnyPermission, hasPermission } from '@/shared/lib/rbac';
import { MENU_SURFACES, SURFACE_HOME, menuForSurface } from './menu-surface';
import { surfaceFromPermissions } from './role-surface';

interface Item {
  path: string;
  permission?: string | readonly string[];
}

const MENU: Item[] = [
  { path: '/gifted-students/student/activities', permission: 'studentAchievement:readAll' },
  { path: '/gifted-students/student/scholarships', permission: 'scholarshipApplication:read' },
  { path: '/gifted-students/student/scholarships/nomdor', permission: 'scholarshipApplication:read' },
  { path: '/gifted-students/student/scholarships/rektor', permission: 'scholarshipApplication:read' },
  { path: '/gifted-students/student/advisor', permission: 'studentAchievement:create' },
  { path: '/gifted-students/student/profile', permission: 'studentAchievement:create' },
  { path: '/gifted-students/department/students', permission: 'giftedStudent:readAll' },
  { path: '/gifted-students/department/scholarships', permission: 'scholarshipApplication:readAll' },
  { path: '/gifted-students/department/scholarships/nomdor', permission: 'scholarshipApplication:readAll' },
  { path: '/gifted-students/department/scholarships/rektor', permission: 'scholarshipApplication:readAll' },
  { path: '/gifted-students/department/review', permission: 'studentAchievement:approve' },
  { path: '/gifted-students/department/criteria', permission: 'evaluationCriteria:create' },
  { path: '/gifted-students/management/reports', permission: 'giftedStudent:readAll' },
  { path: '/gifted-students/judge/scholarships', permission: 'scholarshipApplication:score' },
  { path: '/gifted-students/advisor/student', permission: 'giftedStudent:readAll' },
];

const GRANTS: Record<string, string[]> = {
  talaba: [
    'giftedStudent:read',
    'studentAchievement:create', 'studentAchievement:read', 'studentAchievement:readAll',
    'scholarshipApplication:create', 'scholarshipApplication:read',
    'scholarship:read', 'scholarship:readAll',
    'evaluationCriteria:readAll',
    'documentType:readAll',
    'chat:create', 'chat:read', 'chat:readAll', 'chat:delete',
  ],
  iqtidorli_bolim: [
    'giftedStudent:create', 'giftedStudent:read', 'giftedStudent:readAll',
    'giftedStudent:update', 'giftedStudent:approve', 'giftedStudent:reject',
    'giftedStudent:export', 'giftedStudent:delete',
    'evaluationCriteria:create', 'evaluationCriteria:read', 'evaluationCriteria:readAll',
    'evaluationCriteria:update', 'evaluationCriteria:delete',
    'studentAchievement:create', 'studentAchievement:read', 'studentAchievement:readAll',
    'studentAchievement:update', 'studentAchievement:approve', 'studentAchievement:reject',
    'studentAchievement:delete',
    'scholarshipApplication:create', 'scholarshipApplication:read',
    'scholarshipApplication:readAll', 'scholarshipApplication:update',
    'scholarshipApplication:approve', 'scholarshipApplication:reject',
    'scholarship:create', 'scholarship:read', 'scholarship:readAll',
    'documentType:create', 'documentType:read', 'documentType:readAll',
    'chat:create', 'chat:read', 'chat:readAll', 'chat:delete',
  ],
  oqituvchi: [
    'giftedStudent:read', 'giftedStudent:readAll',
    'studentAchievement:read', 'studentAchievement:readAll',
    'scholarshipApplication:read', 'scholarshipApplication:readAll',
    'documentType:read', 'documentType:readAll',
    'chat:create', 'chat:read', 'chat:readAll', 'chat:update',
  ],
  hakam: [
    'giftedStudent:read',
    'studentAchievement:readAll',
    'evaluationCriteria:readAll',
    'scholarship:readAll',
    'scholarshipApplication:readAll', 'scholarshipApplication:score',
  ],
  rektor: [
    'giftedStudent:read', 'giftedStudent:readAll',
    'evaluationCriteria:readAll',
  ],
};

const permissionSatisfied = (granted: string[], p?: string | readonly string[]) =>
  !p ? true : typeof p === 'string' ? hasPermission(granted, p) : hasAnyPermission(granted, p);

function visibleFor(roleTitle: string): string[] {
  const grants = GRANTS[roleTitle] ?? [];
  const byPermission = MENU.filter((i) => permissionSatisfied(grants, i.permission));
  return menuForSurface(byPermission, surfaceFromPermissions(grants)).map((i) => i.path);
}

const short = (paths: string[]) => paths.map((p) => p.replace('/gifted-students/', ''));

describe('menyu matritsasi — ruxsat ∩ yuza', () => {
  it('jadval menyu bandlarining HAMMASINI qamraydi', () => {
    for (const item of MENU) expect(MENU_SURFACES[item.path], item.path).toBeDefined();
    expect(Object.keys(MENU_SURFACES)).toHaveLength(MENU.length);
  });

  it('MD-03: bo‘lim xodimi TALABA yuzasini KO‘RMAYDI', () => {
    const paths = short(visibleFor('iqtidorli_bolim'));
    expect(paths.filter((p) => p.startsWith('student/'))).toEqual([]);
    expect(paths).toEqual([
      'department/students',
      'department/scholarships',
      'department/scholarships/nomdor',
      'department/scholarships/rektor',
      'department/review',
      'department/criteria',
      'management/reports',
    ]);
  });

  it('MD-03: dublikat sarlavhalar YO‘Q', () => {
    const paths = short(visibleFor('iqtidorli_bolim'));
    const leaf = paths.map((p) => p.split('/').slice(1).join('/'));
    expect(new Set(leaf).size).toBe(leaf.length);
  });

  it('MD-04 + MD-51: talaba FAQAT o‘z yuzasini ko‘radi', () => {
    expect(short(visibleFor('talaba'))).toEqual([
      'student/activities',
      'student/scholarships',
      'student/scholarships/nomdor',
      'student/scholarships/rektor',
      'student/advisor',
      'student/profile',
    ]);
  });

  it('maslahatchi (oqituvchi) — faqat o‘z sahifasi', () => {
    expect(short(visibleFor('oqituvchi'))).toEqual(['advisor/student']);
  });

  it('hakam — faqat baholash', () => {
    expect(short(visibleFor('hakam'))).toEqual(['judge/scholarships']);
  });

  it('rahbariyat — faqat hisobot', () => {
    expect(short(visibleFor('rektor'))).toEqual(['management/reports']);
  });

  it('super_admin (`*`) — HAMMASI (yuza aniqlanmaydi => filtrlanmaydi)', () => {
    const all = menuForSurface(MENU, surfaceFromPermissions(['*']));
    expect(all).toHaveLength(MENU.length);
  });
});

describe('yordamchi shartnomalar', () => {
  it('`management/reports` ni BO‘LIM ham ko‘radi', () => {
    expect(MENU_SURFACES['/gifted-students/management/reports']).toContain('department');
  });

  it('har yuzaning uyi o‘sha yuzaga tegishli', () => {
    for (const [surface, home] of Object.entries(SURFACE_HOME)) {
      expect(MENU_SURFACES[home], home).toContain(surface);
    }
  });

  it('jadvalda yo‘q band FILTRLANMAYDI', () => {
    const extra = [{ path: '/gifted-students/yangi-band' }];
    expect(menuForSurface(extra, 'student')).toHaveLength(1);
  });
});
