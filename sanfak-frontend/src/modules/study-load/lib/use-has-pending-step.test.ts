import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/app/session';
import type { ApprovalStep } from '../distribution/model/types';
import {
  DISTRIBUTION_STEP_ROLES,
  SCIENCE_PROGRAM_STEP_ROLES,
  SCIENCE_PROGRAM_SUBMIT_ROLE,
  SYLLABUS_STEP_ROLES,
  SYLLABUS_SUBMIT_ROLE,
  WORKING_SCHEDULE_STEP_ROLES,
  useChainRowGate,
  useHasPendingStep,
} from './use-has-pending-step';

const step = (
  name: string,
  status: ApprovalStep['status'],
): ApprovalStep => ({
  step: name,
  label: '',
  approverName: null,
  status,
  date: null,
  comment: null,
});

const AFTER_METHODICAL: ApprovalStep[] = [
  step('kafedra', 'approved'),
  step('methodical', 'approved'),
  step('financial', 'pending'),
  step('dean', 'pending'),
  step('prorektor', 'pending'),
];

const AT_KAFEDRA: ApprovalStep[] = [
  step('kafedra', 'pending'),
  step('methodical', 'pending'),
  step('financial', 'pending'),
];

function login(roleName: string, permissions: string[] = ['workloadDistribution:approve']) {
  act(() => {
    useSessionStore.setState({
      status: 'authenticated',
      user: {
        id: 'u1',
        email: 'u1@test.local',
        fullName: 'Test User',
        roles: [{ id: 'r1', name: roleName }],
      },
      permissions,
    });
  });
}

function logout() {
  act(() => {
    useSessionStore.setState({ status: 'unauthenticated', user: null, permissions: [] });
  });
}

const render = (history: ApprovalStep[] | undefined) =>
  renderHook(() => useHasPendingStep(history, DISTRIBUTION_STEP_ROLES)).result.current;

afterEach(() => {
  logout();
});

describe('useHasPendingStep', () => {
  it('O\'UB o\'z bosqichini imzolagach tugma YO\'Q (navbat reja_moliya\'da) — asosiy defekt', () => {
    login('oquv_uslubiy_boshqarma');

    expect(render(AFTER_METHODICAL)).toBe(false);
  });

  it('navbat egasi (reja_moliya) tugmani KO\'RADI', () => {
    login('reja_moliya');

    expect(render(AFTER_METHODICAL)).toBe(true);
  });

  it('navbati hali kelmagan keyingi bosqich egasi (dekan) tugmani ko\'rmaydi', () => {
    login('dekan');

    expect(render(AFTER_METHODICAL)).toBe(false);
  });

  it('zanjir boshida faqat kafedra mudiri ko\'radi', () => {
    login('kafedra_mudiri');
    expect(render(AT_KAFEDRA)).toBe(true);

    login('prorektor');
    expect(render(AT_KAFEDRA)).toBe(false);
  });

  it('barcha bosqich tasdiqlangan bo\'lsa hech kimga ko\'rinmaydi', () => {
    login('prorektor');

    expect(render(AFTER_METHODICAL.map((s) => ({ ...s, status: 'approved' as const })))).toBe(false);
  });

  it('zanjirda umuman qatnashmaydigan rol (oqituvchi) ko\'rmaydi', () => {
    login('oqituvchi');

    expect(render(AFTER_METHODICAL)).toBe(false);
  });

  it('noma\'lum bosqich slugi (map\'da yo\'q) — tugma ko\'rsatilmaydi', () => {
    login('reja_moliya');

    expect(render([step('kengash', 'pending')])).toBe(false);
  });

  it('bo\'sh yoki undefined zanjir — tugma yo\'q', () => {
    login('reja_moliya');

    expect(render([])).toBe(false);
    expect(render(undefined)).toBe(false);
  });

  it('sessiyasiz (rol yo\'q) — tugma yo\'q', () => {
    logout();

    expect(render(AFTER_METHODICAL)).toBe(false);
  });

  it('`*` (super_admin / dev mock) — har doim ko\'radi', () => {
    login('Developer', ['*']);

    expect(render(AFTER_METHODICAL)).toBe(true);
  });
});

describe('DISTRIBUTION_STEP_ROLES — backend STEP_ROLES nusxasi', () => {
  it('workloadDistribution.controller.js:74-80 bilan aynan bir xil', () => {
    expect(DISTRIBUTION_STEP_ROLES).toEqual({
      kafedra: 'kafedra_mudiri',
      methodical: 'oquv_uslubiy_boshqarma',
      financial: 'reja_moliya',
      dean: 'dekan',
      prorektor: 'prorektor',
    });
  });
});

describe('STEP_ROLES nusxalari — backend bilan aynan bir xil', () => {
  it('syllabus.controller.js STEP_ROLES (5 bosqich, `dean` bilan)', () => {
    expect(SYLLABUS_STEP_ROLES).toEqual({
      kafedra: 'kafedra_mudiri',
      arm: 'arm',
      methodical: 'oquv_uslubiy_boshqarma',
      dean: 'dekan',
      prorektor: 'prorektor',
    });
  });

  it('scienceProgram.controller.js STEP_ROLES (7 kalit, v259+v142 birlashmasi, `dean` bilan)', () => {
    expect(SCIENCE_PROGRAM_STEP_ROLES).toEqual({
      teacher: 'oqituvchi',
      kafedra: 'kafedra_mudiri',
      arm: 'arm',
      methodical: 'oquv_uslubiy_boshqarma',
      prorektor: 'prorektor',
      rektor: 'rektor',
      dean: 'dekan',
    });
  });

  it('workingSchedule.controller.js:147-152 (4 bosqich)', () => {
    expect(WORKING_SCHEDULE_STEP_ROLES).toEqual({
      methodical: 'oquv_uslubiy_boshqarma',
      dean: 'dekan',
      prorektor: 'prorektor',
      rektor: 'rektor',
    });
  });
});

const gate = (stepRoles: Record<string, string>, submitRole: string) =>
  renderHook(() => useChainRowGate(stepRoles, submitRole)).result.current;

describe('useChainRowGate', () => {
  it('sillabus: navbat ARM da — arm KO\'RADI, O\'UB ko\'rmaydi (asosiy defekt)', () => {
    login('arm');
    expect(gate(SYLLABUS_STEP_ROLES, SYLLABUS_SUBMIT_ROLE)('in_review', 'arm')).toBe(true);

    login('oquv_uslubiy_boshqarma');
    expect(gate(SYLLABUS_STEP_ROLES, SYLLABUS_SUBMIT_ROLE)('in_review', 'arm')).toBe(false);
  });

  it('fan dasturi: navbat rektorda — rektor ko\'radi, prorektor yo\'q', () => {
    login('rektor');
    expect(
      gate(SCIENCE_PROGRAM_STEP_ROLES, SCIENCE_PROGRAM_SUBMIT_ROLE)('in_review', 'rektor'),
    ).toBe(true);

    login('prorektor');
    expect(
      gate(SCIENCE_PROGRAM_STEP_ROLES, SCIENCE_PROGRAM_SUBMIT_ROLE)('in_review', 'rektor'),
    ).toBe(false);
  });

  it('`draft` — zanjir boshlanmagan: faqat submit roli (o\'qituvchi)', () => {
    login('oqituvchi');
    expect(gate(SYLLABUS_STEP_ROLES, SYLLABUS_SUBMIT_ROLE)('draft', 'kafedra')).toBe(true);

    login('kafedra_mudiri');
    expect(gate(SYLLABUS_STEP_ROLES, SYLLABUS_SUBMIT_ROLE)('draft', 'kafedra')).toBe(false);
  });

  it('yakuniy holatlar (`approved`/`rejected`) — hech kimda tugma yo\'q', () => {
    login('prorektor');
    const can = gate(SYLLABUS_STEP_ROLES, SYLLABUS_SUBMIT_ROLE);

    expect(can('approved', 'prorektor')).toBe(false);
    expect(can('rejected', 'prorektor')).toBe(false);
  });

  it('`currentStep` bo\'sh yoki noma\'lum — tugma yo\'q', () => {
    login('prorektor');
    const can = gate(SYLLABUS_STEP_ROLES, SYLLABUS_SUBMIT_ROLE);

    expect(can('in_review', null)).toBe(false);
    expect(can('in_review', undefined)).toBe(false);
    expect(can('in_review', 'kengash')).toBe(false);
  });

  it('sessiyasiz — tugma yo\'q', () => {
    logout();

    expect(gate(SYLLABUS_STEP_ROLES, SYLLABUS_SUBMIT_ROLE)('in_review', 'kafedra')).toBe(false);
  });

  it('`*` (super_admin / dev mock) — har doim ko\'radi, lekin yakuniy holatda YO\'Q', () => {
    login('Developer', ['*']);
    const can = gate(SYLLABUS_STEP_ROLES, SYLLABUS_SUBMIT_ROLE);

    expect(can('in_review', 'kafedra')).toBe(true);
    expect(can('draft', 'kafedra')).toBe(true);
    expect(can('approved', null)).toBe(false);
  });
});
