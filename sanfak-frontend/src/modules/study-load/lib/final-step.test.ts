import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/app/session';
import {
  canRevokeFinal,
  extractRevokeDependents,
  finalStep,
  finalStepRole,
  FIXED_FINAL_STEP,
  revocableStatuses,
  scienceProgramFinalStep,
  useRevokeFinalGate,
} from './final-step';
import {
  DISTRIBUTION_STEP_ROLES,
  SCIENCE_PROGRAM_STEP_ROLES,
  SYLLABUS_STEP_ROLES,
  WORKING_SCHEDULE_STEP_ROLES,
} from './use-has-pending-step';

const steps = (...keys: string[]) => keys.map((step) => ({ step }));

describe('finalStep / finalStepRole', () => {
  it("oxirgi element — yakuniy bosqich; bo'sh massiv → null", () => {
    expect(finalStep(steps('methodical', 'dean', 'prorektor', 'rektor'))).toBe('rektor');
    expect(finalStep([])).toBeNull();
    expect(finalStep(undefined)).toBeNull();
  });

  it('fan dasturi: ADR-035 v259 / v142 → dekan, legacy 6 bosqichli v259 → rektor', () => {
    expect(finalStepRole(steps('teacher', 'kafedra', 'dean'), SCIENCE_PROGRAM_STEP_ROLES)).toBe('dekan');
    expect(
      finalStepRole(
        steps('teacher', 'kafedra', 'arm', 'methodical', 'prorektor', 'rektor'),
        SCIENCE_PROGRAM_STEP_ROLES,
      ),
    ).toBe('rektor');
  });

  it("bosqichlar bo'lmasa (ro'yxat) — fallback bosqich; bosqichlar bor bo'lsa — ular ustun", () => {
    expect(
      finalStepRole(null, WORKING_SCHEDULE_STEP_ROLES, FIXED_FINAL_STEP.workingSchedule),
    ).toBe('rektor');
    expect(
      finalStepRole(null, DISTRIBUTION_STEP_ROLES, FIXED_FINAL_STEP.workloadDistribution),
    ).toBe('prorektor');
    expect(finalStepRole(null, SYLLABUS_STEP_ROLES, FIXED_FINAL_STEP.syllabus)).toBe('prorektor');
    expect(
      finalStepRole(steps('methodical', 'dean'), WORKING_SCHEDULE_STEP_ROLES, 'rektor'),
    ).toBe('dekan');
  });

  it("noma'lum bosqich / na bosqich na fallback → null", () => {
    expect(finalStepRole(steps('unknown'), WORKING_SCHEDULE_STEP_ROLES)).toBeNull();
    expect(finalStepRole(null, WORKING_SCHEDULE_STEP_ROLES)).toBeNull();
  });

  it("fan dasturi ro'yxati: v142 → dean; v259/undefined → null (bosqichlardan aniqlanadi)", () => {
    expect(scienceProgramFinalStep('v142')).toBe('dean');
    expect(scienceProgramFinalStep('v259')).toBeNull();
    expect(scienceProgramFinalStep(undefined)).toBeNull();
  });
});

describe('canRevokeFinal', () => {
  const approvedRektor = { status: 'approved', finalRole: 'rektor' };

  it('approved + yakuniy rol → true', () => {
    expect(canRevokeFinal(approvedRektor, ['rektor'], false)).toBe(true);
    expect(canRevokeFinal(approvedRektor, ['oqituvchi', 'rektor'], false)).toBe(true);
  });

  it('approved + boshqa rol → false', () => {
    expect(canRevokeFinal(approvedRektor, ['prorektor'], false)).toBe(false);
    expect(canRevokeFinal(approvedRektor, [], false)).toBe(false);
    expect(canRevokeFinal(approvedRektor, undefined, false)).toBe(false);
  });

  it('super_admin — approved hujjatda har doim true (yakuniy rol noma\'lum bo\'lsa ham)', () => {
    expect(canRevokeFinal(approvedRektor, [], true)).toBe(true);
    expect(canRevokeFinal({ status: 'approved', finalRole: null }, [], true)).toBe(true);
  });

  it("approved emas — hech kimga (mavjud reject yo'li o'zgarmaydi)", () => {
    for (const status of ['draft', 'new', 'in_review', 'rejected', 'superseded']) {
      expect(canRevokeFinal({ status, finalRole: 'rektor' }, ['rektor'], false)).toBe(false);
      expect(canRevokeFinal({ status, finalRole: 'rektor' }, [], true)).toBe(false);
    }
  });

  it("yakuniy rol noma'lum → oddiy foydalanuvchiga false", () => {
    expect(canRevokeFinal({ status: 'approved', finalRole: null }, ['rektor'], false)).toBe(false);
  });

  it('ADR-043: workload — superseded ham bekor qilinadi (faqat yakuniy rol / super)', () => {
    const doc = { status: 'superseded', finalRole: 'rektor', entity: 'workload' };
    expect(canRevokeFinal(doc, ['rektor'], false)).toBe(true);
    expect(canRevokeFinal(doc, [], true)).toBe(true);
    expect(canRevokeFinal(doc, ['prorektor'], false)).toBe(false);
    expect(canRevokeFinal({ ...doc, status: 'in_review' }, ['rektor'], false)).toBe(false);
  });

  it("ADR-043: boshqa entity (taqsimot) superseded'da — false (backend 409)", () => {
    const doc = { status: 'superseded', finalRole: 'prorektor', entity: 'workloadDistribution' };
    expect(canRevokeFinal(doc, ['prorektor'], false)).toBe(false);
    expect(canRevokeFinal(doc, [], true)).toBe(false);
  });
});

describe('revocableStatuses', () => {
  it("default ['approved']; workload → approved + superseded", () => {
    expect(revocableStatuses()).toEqual(['approved']);
    expect(revocableStatuses('syllabus')).toEqual(['approved']);
    expect(revocableStatuses('workload')).toEqual(['approved', 'superseded']);
  });
});

describe('revocableStatuses — superseded opt-in (backend PR #272)', () => {
  it("workloadSummary + workload: approved + superseded; qolganlari va default — faqat approved", () => {
    expect(revocableStatuses('workloadSummary')).toEqual(['approved', 'superseded']);
    expect(revocableStatuses('workload')).toEqual(['approved', 'superseded']);
    expect(revocableStatuses()).toEqual(['approved']);
    for (const entity of Object.keys(FIXED_FINAL_STEP) as (keyof typeof FIXED_FINAL_STEP)[]) {
      if (entity === 'workloadSummary' || entity === 'workload') continue;
      expect(revocableStatuses(entity)).toEqual(['approved']);
    }
  });

  it('workloadSummary: superseded → rektorga true; draft/in_review/rejected → false', () => {
    const statuses = revocableStatuses('workloadSummary');
    const doc = (status: string) => ({ status, finalRole: 'rektor' });
    expect(canRevokeFinal(doc('approved'), ['rektor'], false, statuses)).toBe(true);
    expect(canRevokeFinal(doc('superseded'), ['rektor'], false, statuses)).toBe(true);
    expect(canRevokeFinal(doc('superseded'), ['prorektor'], false, statuses)).toBe(false);
    for (const s of ['draft', 'in_review', 'rejected']) {
      expect(canRevokeFinal(doc(s), ['rektor'], false, statuses)).toBe(false);
    }
    expect(canRevokeFinal(doc('superseded'), ['rektor'], false, revocableStatuses('syllabus'))).toBe(false);
  });
});

describe('useRevokeFinalGate', () => {
  const DEV_SESSION = {
    user: { id: 'dev-user', email: 'dev@platform.local', fullName: 'Developer', roles: [{ id: 'dev', name: 'Developer' }] },
    permissions: ['*'],
  };
  afterEach(() => {
    useSessionStore.setState(DEV_SESSION);
  });

  it("sessiya rollari va '*' ni o'qiydi", () => {
    act(() => {
      useSessionStore.setState({
        user: { id: 'u', email: 'r@x.uz', fullName: 'Rektor', roles: [{ id: 'r', name: 'rektor' }] },
        permissions: ['workload:reject'],
      });
    });
    const { result } = renderHook(() => useRevokeFinalGate());
    expect(result.current({ status: 'approved', finalRole: 'rektor' })).toBe(true);
    expect(result.current({ status: 'approved', finalRole: 'prorektor' })).toBe(false);

    act(() => {
      useSessionStore.setState(DEV_SESSION);
    });
    const { result: superGate } = renderHook(() => useRevokeFinalGate());
    expect(superGate.current({ status: 'approved', finalRole: 'prorektor' })).toBe(true);
  });

  it("entity opt-in: workloadSummary gate superseded'ni ochadi, default gate — yo'q", () => {
    act(() => {
      useSessionStore.setState({
        user: { id: 'u', email: 'r@x.uz', fullName: 'Rektor', roles: [{ id: 'r', name: 'rektor' }] },
        permissions: ['workloadSummary:reject'],
      });
    });
    const superseded = { status: 'superseded', finalRole: 'rektor' };
    const { result: summaryGate } = renderHook(() => useRevokeFinalGate('workloadSummary'));
    expect(summaryGate.current(superseded)).toBe(true);
    expect(summaryGate.current({ status: 'rejected', finalRole: 'rektor' })).toBe(false);
    const { result: defaultGate } = renderHook(() => useRevokeFinalGate());
    expect(defaultGate.current(superseded)).toBe(false);
    const { result: syllabusGate } = renderHook(() => useRevokeFinalGate('syllabus'));
    expect(syllabusGate.current(superseded)).toBe(false);
  });
});

describe('extractRevokeDependents', () => {
  const axiosLike = (status: number, data: unknown) => ({ response: { status, data } });

  it("409 active_dependents → ro'yxat (bo'sh nom → null)", () => {
    const err = axiosLike(409, {
      statusCode: 409,
      message: '...',
      reason: 'active_dependents',
      dependents: [
        { type: 'workload', id: 'w1', title: 'Anatomiya kafedrasi', status: 'approved' },
        { type: 'workloadSummary', id: 's1', title: '', status: 'in_review' },
      ],
    });
    expect(extractRevokeDependents(err)).toEqual([
      { hidden: false, type: 'workload', id: 'w1', title: 'Anatomiya kafedrasi', status: 'approved' },
      { hidden: false, type: 'workloadSummary', id: 's1', title: null, status: 'in_review' },
    ]);
  });

  it("scope'dan tashqari element — faqat tur + son (nom/id/holat yo'q)", () => {
    const err = axiosLike(409, {
      reason: 'active_dependents',
      dependents: [
        { type: 'workload', id: 'w1', title: 'Anatomiya', status: 'approved' },
        { type: 'workloadDistribution', count: 3, hidden: true },
        { type: 'syllabus', count: 'x', hidden: true },
      ],
    });
    expect(extractRevokeDependents(err)).toEqual([
      { hidden: false, type: 'workload', id: 'w1', title: 'Anatomiya', status: 'approved' },
      { hidden: true, type: 'workloadDistribution', count: 3 },
      { hidden: true, type: 'syllabus', count: 1 },
    ]);
  });

  it("boshqa xatolar → bo'sh massiv", () => {
    expect(extractRevokeDependents(axiosLike(409, { message: 'Hujjat holati o\'zgargan' }))).toEqual([]);
    expect(extractRevokeDependents(axiosLike(403, { dependents: [{ type: 'x' }] }))).toEqual([]);
    expect(extractRevokeDependents(new Error('network'))).toEqual([]);
    expect(extractRevokeDependents(undefined)).toEqual([]);
  });
});
