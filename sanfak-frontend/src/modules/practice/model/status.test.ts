import { describe, it, expect } from 'vitest';
import {
  STATUS_META,
  STATUS_ORDER,
  statusLabelForRole,
  tabsForRole,
  visibleStatusesForRole,
  matchesTab,
  isEditable,
  type TabDef,
} from './status';
import type { Contract, ContractStatus } from './types';

const ALL_STATUSES: ContractStatus[] = [
  'draft',
  'in_progress',
  'rektor_approved',
  'both_approved',
  'rejected',
];

function makeContract(status: ContractStatus): Contract {
  const ref = { id: 'r1', title: 'ref' };
  const sig = { signed: false };
  return {
    id: 'c1',
    number: 'N-1',
    organization: { id: 'o1', title: 'Org', region: ref, district: ref },
    direction: ref,
    academicYear: ref,
    students: [],
    studentsCount: 0,
    startDate: '2026-01-01',
    endDate: '2026-06-01',
    status,
    rector: sig,
    orgHead: sig,
    history: [],
  };
}

describe('STATUS_META', () => {
  it('barcha 5 statusni label + color bilan qamraydi', () => {
    expect(Object.keys(STATUS_META).sort()).toEqual([...ALL_STATUSES].sort());
    for (const status of ALL_STATUSES) {
      const meta = STATUS_META[status];
      expect(typeof meta.label).toBe('string');
      expect(meta.label.length).toBeGreaterThan(0);
      expect(typeof meta.color).toBe('string');
      expect(meta.color.length).toBeGreaterThan(0);
    }
  });
});

describe('STATUS_ORDER', () => {
  it('5 ta elementdan iborat', () => {
    expect(STATUS_ORDER).toHaveLength(5);
    expect([...STATUS_ORDER].sort()).toEqual([...ALL_STATUSES].sort());
  });
});

describe('statusLabelForRole', () => {
  it("rektor uchun rektor_approved -> 'Tasdiqlagan'", () => {
    expect(statusLabelForRole('rektor_approved', 'rektor')).toBe('Tasdiqlagan');
  });

  it("amaliyot_bolimi uchun rektor_approved -> 'Rektor tasdiqlagan'", () => {
    expect(statusLabelForRole('rektor_approved', 'amaliyot_bolimi')).toBe(
      'Rektor tasdiqlagan',
    );
  });
});

describe('tabsForRole', () => {
  it("amaliyot_bolimi 7 ta tab, 'Arxiv' ham bor", () => {
    const tabs = tabsForRole('amaliyot_bolimi');
    expect(tabs).toHaveLength(7);
    expect(tabs.some((t) => t.label === 'Arxiv')).toBe(true);
  });

  it("rektor 5 ta tab, 'new' tab statusi in_progress", () => {
    const tabs = tabsForRole('rektor');
    expect(tabs).toHaveLength(5);
    const newTab = tabs.find((t) => t.key === 'new');
    expect(newTab?.statuses).toEqual(['in_progress']);
  });

  it("tibbiyot_birlashmasi_rahbari 'new' tab statusi rektor_approved", () => {
    const tabs = tabsForRole('tibbiyot_birlashmasi_rahbari');
    const newTab = tabs.find((t) => t.key === 'new');
    expect(newTab?.statuses).toEqual(['rektor_approved']);
  });

  it("rektor 'Tasdiqlangan' tabida rektor_approved ham bor", () => {
    const approved = tabsForRole('rektor').find((t) => t.key === 'approved');
    expect(approved?.statuses).toEqual(['rektor_approved', 'both_approved']);
  });

  it("rahbar 'Tasdiqlangan' tabi faqat both_approved", () => {
    const approved = tabsForRole('tibbiyot_birlashmasi_rahbari').find((t) => t.key === 'approved');
    expect(approved?.statuses).toEqual(['both_approved']);
  });

  it('rektor imzolagan shartnoma kamida bitta tabga tushadi', () => {
    const tabs = tabsForRole('rektor').filter((t) => t.key !== 'all');
    const hit = tabs.filter((t) => t.statuses?.includes('rektor_approved'));
    expect(hit.length).toBeGreaterThan(0);
  });
});

describe('visibleStatusesForRole', () => {
  it("rektor uchun 'draft' ko'rinmaydi", () => {
    const visible = visibleStatusesForRole('rektor');
    expect(visible).not.toBeNull();
    expect(visible).not.toContain('draft');
  });

  it('amaliyot_bolimi uchun null (barchasi)', () => {
    expect(visibleStatusesForRole('amaliyot_bolimi')).toBeNull();
  });
});

describe('matchesTab', () => {
  it("'all' tab (statuses null) har doim true", () => {
    const allTab: TabDef = { key: 'all', label: 'Barchasi', statuses: null };
    expect(matchesTab(makeContract('draft'), allTab)).toBe(true);
    expect(matchesTab(makeContract('rejected'), allTab)).toBe(true);
  });

  it('aniq-status tab faqat mos statusda true', () => {
    const draftTab: TabDef = { key: 'draft', label: 'Yangi', statuses: ['draft'] };
    expect(matchesTab(makeContract('draft'), draftTab)).toBe(true);
    expect(matchesTab(makeContract('in_progress'), draftTab)).toBe(false);
  });
});

describe('isEditable', () => {
  it("draft va rejected -> true, in_progress -> false", () => {
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('rejected')).toBe(true);
    expect(isEditable('in_progress')).toBe(false);
  });
});
