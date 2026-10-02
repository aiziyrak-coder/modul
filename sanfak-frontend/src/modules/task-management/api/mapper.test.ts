import { describe, expect, it } from 'vitest';
import { statusByUz, TASK_STATUSES } from '../model/status-workflow';
import {
  adaptAssigner,
  adaptNotification,
  adaptRoleOption,
  adaptTask,
  statsToUz,
  toEnPriority,
  toEnStatus,
  toUzPriority,
  toUzStatus,
} from './mapper';
import { completionPercent } from '../lib/completion';

describe('task-management mapper — status/priority', () => {
  it('maps EN↔UZ status round-trip', () => {
    expect(toUzStatus('in_progress')).toBe('jarayonda');
    expect(toEnStatus('jarayonda')).toBe('in_progress');
  });

  it('maps EN↔UZ priority round-trip', () => {
    expect(toUzPriority('high')).toBe('yuqori');
    expect(toEnPriority('yuqori')).toBe('high');
  });

  it("NOTANISH status JIMGINA 'yangi' ga aylanmaydi", () => {
    expect(toUzStatus('archived')).toBe('archived');
    expect(statusByUz('archived').label).toBe('archived');
    expect(statusByUz('archived').color).toBe('#8c8c8c');
  });

  it('NOTANISH ustuvorlik ham jimgina tushirilmaydi', () => {
    expect(toUzPriority('critical')).toBe('critical');
    expect(toEnPriority('critical')).toBe('critical');
  });

  it("bo'sh/berilmagan qiymat — bo'sh qaytadi, taxmin qilinmaydi", () => {
    expect(toUzStatus(undefined)).toBe('');
    expect(toEnPriority(undefined)).toBe('');
  });

  it("lug'at yagona manbadan keladi — hosila xaritalar mos", () => {
    for (const meta of TASK_STATUSES) {
      expect(toUzStatus(meta.en)).toBe(meta.uz);
      expect(toEnStatus(meta.uz)).toBe(meta.en);
    }
  });
});

describe('task-management mapper — documents', () => {
  it('adaptTask maps _id → id, derives status, lifts assignee', () => {
    const task = adaptTask({
      _id: 'abc',
      title: 'Hisobot tayyorlash',
      deadline: '2026-07-01',
      createdAt: '2026-06-24',
      status: 'under_review',
      priority: 'high',
      assignee: { _id: 'u1', firstName: 'Ali', lastName: 'Valiyev' },
      category: { name: 'Hisobot' },
    });
    expect(task.id).toBe('abc');
    expect(task.status).toBe('tekshiruvda');
    expect(task.priority).toBe('yuqori');
    expect(task.assignees).toHaveLength(1);
    expect(task.assignees[0]?.name).toBe('Valiyev Ali');
    expect(task.category).toBe('Hisobot');
  });

  it('statsToUz remaps backend scope keys', () => {
    expect(statsToUz({ total: 5, in_progress: 2, overdue: 1 })).toMatchObject({
      total: 5,
      jarayonda: 2,
      kechikdi: 1,
      bajarildi: 0,
    });
  });

  it('adaptNotification composes message + flags', () => {
    const n = adaptNotification({ _id: 'n1', title: 'Yangi topshiriq', body: 'Hisobot', read: false, metadata: { taskId: 't9' } });
    expect(n.id).toBe('n1');
    expect(n.message).toBe('Yangi topshiriq: Hisobot');
    expect(n.read).toBe(false);
    expect(n.taskId).toBe('t9');
  });
});

describe('task-management mapper — ijrochi biriktirish', () => {
  it('adaptAssigner user maydonlarini oladi va grantCount qo`shadi', () => {
    const row = adaptAssigner({
      _id: 'u7',
      firstName: 'Rustam',
      lastName: 'Rahbarov',
      position: { title: 'Dekan' },
      department: { title: 'Davolash ishi' },
      role: { title: 'tm_rahbar' },
      grantCount: 4,
    });
    expect(row.id).toBe('u7');
    expect(row.name).toBe('Rahbarov Rustam');
    expect(row.position).toBe('Dekan');
    expect(row.roleTitle).toBe('tm_rahbar');
    expect(row.grantCount).toBe(4);
  });

  it('grantCount kelmasa 0 bo`ladi (umumiy qoida)', () => {
    expect(adaptAssigner({ _id: 'u8', firstName: 'A', lastName: 'B' }).grantCount).toBe(0);
  });

  it('adaptRoleOption _id → id, bo`sh maydonlar xavfsiz', () => {
    expect(adaptRoleOption({ _id: 'r1', title: 'dekan', description: 'Dekan' })).toEqual({
      id: 'r1',
      title: 'dekan',
      description: 'Dekan',
    });
    expect(adaptRoleOption({})).toEqual({ id: '', title: '', description: '' });
  });
});

describe('task-management mapper — ism shakli (F.I.Sh)', () => {
  it('sharif kelsa ism uch qismli bo`ladi', () => {
    const task = adaptTask({
      _id: 't1',
      title: 'Hisobot',
      deadline: '2026-09-10',
      createdAt: '2026-09-01',
      createdBy: { _id: 'u1', firstName: 'Aziz', lastName: 'Karimov', middleName: 'Akmalovich' },
    });
    expect(task.createdBy.name).toBe('Karimov Aziz Akmalovich');
  });

  it('lavozim populate qilinganda ism ostidagi qator to`ladi', () => {
    const task = adaptTask({
      _id: 't2',
      title: 'Hisobot',
      deadline: '2026-09-10',
      createdAt: '2026-09-01',
      assignee: { _id: 'u2', firstName: 'Ali', lastName: 'Valiyev', position: { title: 'Dotsent' } },
    });
    expect(task.assignees[0]?.position).toBe('Dotsent');
  });

  it('sharif kelmasa xulq avvalgidek (Familiya Ism)', () => {
    expect(adaptAssigner({ _id: 'u3', firstName: 'Ali', lastName: 'Valiyev' }).name).toBe(
      'Valiyev Ali',
    );
  });

  it('ism umuman bo`lmasa `name` zaxirasi, keyin chiziqcha', () => {
    expect(adaptAssigner({ _id: 'u4', name: 'Tizim' }).name).toBe('Tizim');
    expect(adaptAssigner({ _id: 'u5' }).name).toBe('—');
  });
});

describe('task-management mapper — `completedBy` faqat HAQIQIY bajarilishda', () => {
  const base = { _id: 't1', title: 'Hisobot', deadline: '2026-09-10', createdAt: '2026-09-01' };
  const assignee = { _id: 'u1', firstName: 'Ali', lastName: 'Valiyev' };

  it('"bajarilmadi" (not_needed) progressni to`ldirmaydi', () => {
    const task = adaptTask({ ...base, assignee, status: 'not_needed', completedAt: '2026-09-05' });
    expect(task.completedBy).toEqual([]);
  });

  it('"bajarildi" (completed) progressni to`ldiradi', () => {
    const task = adaptTask({ ...base, assignee, status: 'completed', completedAt: '2026-09-05' });
    expect(task.completedBy).toEqual(['u1']);
  });

  it('yopilmagan topshiriqda bo`sh', () => {
    expect(adaptTask({ ...base, assignee, status: 'in_progress' }).completedBy).toEqual([]);
  });

  it('`readBy` bu o`zgarishdan ta`sirlanmaydi', () => {
    const task = adaptTask({ ...base, assignee, status: 'not_needed', readAt: '2026-09-02' });
    expect(task.readBy).toEqual(['u1']);
  });
});

describe('task-management — bajarilish foizi YAGONA ta`rif', () => {
  it('maxraj JAMI (ochiq ishlar ham kiradi)', () => {
    expect(completionPercent(3, 100)).toBe(3);
  });

  it('hammasi bajarilganda 100%', () => {
    expect(completionPercent(7, 7)).toBe(100);
  });

  it('nolga bo`linish yo`q', () => {
    expect(completionPercent(0, 0)).toBe(0);
  });
});
