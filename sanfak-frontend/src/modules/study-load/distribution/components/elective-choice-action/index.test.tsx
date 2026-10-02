import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useSessionStore } from '@/app/session';
import type * as SharedApi from '@/shared/api';
import ElectiveChoiceAction from './index';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn<(url: string, config?: unknown) => Promise<{ data: unknown }>>(),
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    apiClient: { get: getMock, put: vi.fn() },
  };
});

const ACTION_LABEL = 'Fan tanlash';
const DEFAULT_PERMISSIONS = useSessionStore.getState().permissions;

function renderAction() {
  return renderWithProviders(
    <ElectiveChoiceAction
      distributionId="d-1"
      blockId="blk-1"
      currentScienceId="science-1"
    />,
  );
}

beforeEach(() => {
  getMock.mockReset();
  useSessionStore.setState({ permissions: DEFAULT_PERMISSIONS });
});

afterEach(() => {
  useSessionStore.setState({ permissions: DEFAULT_PERMISSIONS });
  vi.restoreAllMocks();
});

describe('ElectiveChoiceAction', () => {
  it('`main: null` → tugma KO`RSATILMAYDI', async () => {
    getMock.mockResolvedValue({ data: { data: { main: null, alternatives: [] } } });

    renderAction();

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(screen.queryByLabelText(ACTION_LABEL)).toBeNull();
  });

  it('tanlov sloti bo`lsa → tugma BOR', async () => {
    getMock.mockResolvedValue({
      data: {
        data: {
          main: { science: 'science-1', code: 'FA1024', title: 'Anatomiya' },
          alternatives: [],
        },
      },
    });

    renderAction();

    expect(await screen.findByLabelText(ACTION_LABEL)).toBeTruthy();
  });

  it('`workloadDistribution:update` granti yo`q → tugma ham, so`rov ham YO`Q', () => {
    useSessionStore.setState({ permissions: ['workloadDistribution:read'] });

    renderAction();

    expect(screen.queryByLabelText(ACTION_LABEL)).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });
});
