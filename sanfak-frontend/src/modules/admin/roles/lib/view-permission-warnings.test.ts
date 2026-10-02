import { describe, expect, it } from 'vitest';
import { i18n } from '@/shared/lib/i18n';
import {
  findViewPermissionWarnings,
  sectionViewWarning,
  VIEW_WARNING_MESSAGE_KEYS,
  VIEW_WARNING_ACTION_KEYS,
} from './view-permission-warnings';
import { actionLabelKey } from './action-labels';
import type { PermissionSection } from '../model/types';

function renderMessage(kind: 'missingReadAll' | 'missingRead'): string {
  return i18n.t(VIEW_WARNING_MESSAGE_KEYS[kind], {
    lng: 'uz',
    action: i18n.t(actionLabelKey(VIEW_WARNING_ACTION_KEYS[kind]), { lng: 'uz' }),
  });
}

const section = (
  key: string,
  actionKeys: string[],
  title?: string,
): PermissionSection => ({ section: key, actionKeys, title });

describe('sectionViewWarning', () => {
  it('W1: `read` bor, `readAll` yo`q -> "ro`yxat sahifasi ochilmaydi"', () => {
    const sec = section('personalWorkPlan', ['read', 'readAll', 'update']);
    const map = { personalWorkPlan: new Set(['read']) };
    const w = sectionViewWarning(sec, map);
    expect(w).not.toBeNull();
    expect(w?.kind).toBe('missingReadAll');
    expect(renderMessage('missingReadAll')).toContain("Ro'yxat ko'rish");
  });

  it('W2: `readAll` bor, `read` yo`q -> "yozuv kartochkasi ochilmaydi"', () => {
    const sec = section('report', ['read', 'readAll']);
    const map = { report: new Set(['readAll']) };
    const w = sectionViewWarning(sec, map);
    expect(w).not.toBeNull();
    expect(w?.kind).toBe('missingRead');
    expect(renderMessage('missingRead')).toContain("Ko'rish");
  });

  it('ikkalasi ham bor -> ogohlantirish yo`q', () => {
    const sec = section('user', ['read', 'readAll']);
    const map = { user: new Set(['read', 'readAll']) };
    expect(sectionViewWarning(sec, map)).toBeNull();
  });

  it('hech narsa belgilanmagan -> ogohlantirish yo`q (ataylab berilmagan vakolat)', () => {
    const sec = section('user', ['read', 'readAll']);
    expect(sectionViewWarning(sec, {})).toBeNull();
    expect(sectionViewWarning(sec, { user: new Set() })).toBeNull();
  });

  it('bo`limda `readAll` umuman yo`q -> `read` yolg`iz bo`lsa ham ogohlantirish yo`q', () => {
    const sec = section('profile', ['read', 'update']);
    const map = { profile: new Set(['read']) };
    expect(sectionViewWarning(sec, map)).toBeNull();
  });

  it('bo`limda `read` umuman yo`q -> `readAll` yolg`iz bo`lsa ham ogohlantirish yo`q', () => {
    const sec = section('auditLog', ['readAll', 'export']);
    const map = { auditLog: new Set(['readAll']) };
    expect(sectionViewWarning(sec, map)).toBeNull();
  });

  it('boshqa amallar (masalan faqat `create`) belgilangan, read juftligi yo`q -> ogohlantirish yo`q', () => {
    const sec = section('user', ['create', 'read', 'readAll']);
    const map = { user: new Set(['create']) };
    expect(sectionViewWarning(sec, map)).toBeNull();
  });
});

describe('findViewPermissionWarnings', () => {
  it('bir nechta bo`lim aralash — faqat haqiqiy ogohlantirishlarni qaytaradi', () => {
    const sections = [
      section('personalWorkPlan', ['read', 'readAll']),
      section('report', ['read', 'readAll']),
      section('user', ['create', 'read', 'readAll', 'update']),
    ];
    const map = {
      personalWorkPlan: new Set(['read']),
      report: new Set(['readAll']),
      user: new Set(['read', 'readAll', 'update']),
    };
    const warnings = findViewPermissionWarnings(sections, map);
    expect(warnings).toHaveLength(2);
    expect(warnings.map((w) => w.section)).toEqual(['personalWorkPlan', 'report']);
    expect(warnings.map((w) => w.kind)).toEqual(['missingReadAll', 'missingRead']);
  });

  it('hech qaysi bo`limda muammo yo`q -> bo`sh massiv', () => {
    const sections = [section('user', ['read', 'readAll'])];
    const map = { user: new Set(['read', 'readAll']) };
    expect(findViewPermissionWarnings(sections, map)).toEqual([]);
  });

  it('sectionTitle — `title` bo`lsa undan, bo`lmasa kalitdan oladi', () => {
    const withTitle = section('report', ['read', 'readAll'], "Hisobotlar");
    const withoutTitle = section('auditLog', ['read', 'readAll']);
    const map = { report: new Set(['read']), auditLog: new Set(['readAll']) };
    const warnings = findViewPermissionWarnings([withTitle, withoutTitle], map);
    expect(warnings.find((w) => w.section === 'report')?.sectionTitle).toBe("Hisobotlar");
    expect(warnings.find((w) => w.section === 'auditLog')?.sectionTitle).toBe('auditLog');
  });
});

describe('ogohlantirish og`irligi (severity)', () => {
  it('W1 (ro`yxat ochilmaydi) -> `blocking`', () => {
    const w = sectionViewWarning(section('report', ['read', 'readAll']), {
      report: new Set(['read']),
    });
    expect(w?.kind).toBe('missingReadAll');
    expect(w?.severity).toBe('blocking');
  });

  it('W2 (kartochka ochilmaydi) -> `info`', () => {
    const w = sectionViewWarning(section('department', ['read', 'readAll']), {
      department: new Set(['readAll']),
    });
    expect(w?.kind).toBe('missingRead');
    expect(w?.severity).toBe('info');
  });

  it('banner filtri: aralash ro`yxatdan faqat `blocking` qoladi', () => {
    const sections = [
      section('faculty', ['read', 'readAll']),
      section('department', ['read', 'readAll']),
      section('position', ['read', 'readAll']),
      section('workloadDistribution', ['read', 'readAll'], 'Yuklama taqsimoti'),
    ];
    const map = {
      faculty: new Set(['readAll']),
      department: new Set(['readAll']),
      position: new Set(['readAll']),
      workloadDistribution: new Set(['read']),
    };
    const all = findViewPermissionWarnings(sections, map);
    expect(all).toHaveLength(4);

    const blocking = all.filter((w) => w.severity === 'blocking');
    expect(blocking).toHaveLength(1);
    expect(blocking[0]?.sectionTitle).toBe('Yuklama taqsimoti');
  });
});
