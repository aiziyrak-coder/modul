import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useSessionStore } from '@/app/session';
import type * as SharedApi from '@/shared/api';
import type { StudyPlanPlan } from '../../api/detail-api';
import StudyPlanPlanTab from './index';

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    fetchList: vi.fn().mockResolvedValue([]),
  };
});

function buildPlan(blockSemesters: StudyPlanPlan['blocks'][number]['semesters']): StudyPlanPlan {
  return {
    id: 'plan-1',
    particleLabels: [],
    distribution: { audience: [], semester: [] },
    blocks: [
      {
        id: 'blk-2',
        blockCode: 'TF2',
        code: 'TF2',
        title: 'Tanlov fanlari',
        totalCredit: 0,
        semesters: blockSemesters,
        sciences: [],
      },
    ],
    file: null,
  };
}

beforeEach(() => {
  useSessionStore.setState({
    status: 'authenticated',
    user: { id: 'u1', email: 'test@test.uz', fullName: 'Test', roles: [] },
    permissions: ['*'],
  });
});

afterEach(() => {
  useSessionStore.setState({ status: 'unauthenticated', user: null, permissions: [] });
  vi.restoreAllMocks();
});

describe('StudyPlanPlanTab — elective quota button', () => {
  it('kvota 0 bo`lsa tugma DISABLED', () => {
    renderWithProviders(
      <StudyPlanPlanTab
        isLoading={false}
        isError={false}
        data={buildPlan({ '3': { hour: 0, credit: 0 } })}
      />,
    );

    const btn = screen.getByRole('button', { name: /Tanlov fani qo'shish/ });
    expect(btn).toBeDisabled();
  });

  it('kvota bor bo`lsa tugma FAOL', () => {
    renderWithProviders(
      <StudyPlanPlanTab
        isLoading={false}
        isError={false}
        data={buildPlan({ '3': { hour: 30, credit: 4 } })}
      />,
    );

    const btn = screen.getByRole('button', { name: /Tanlov fani qo'shish/ });
    expect(btn).not.toBeDisabled();
  });
});
