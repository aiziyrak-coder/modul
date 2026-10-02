import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type { BackendPreferences, PreferencesInput } from '../../model/types';
import * as queries from '../../api/queries';
import SettingsPage from './index';

vi.mock('@/shared/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'uz' }),
}));

vi.mock('../../api/queries', () => ({
  usePreferences: vi.fn(),
  useUpdatePreferences: vi.fn(),
}));

const mutateAsync = vi.fn<(input: PreferencesInput) => Promise<{ message: string }>>();

function prefsResult(data: BackendPreferences): ReturnType<typeof queries.usePreferences> {
  return {
    data,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof queries.usePreferences>;
}

function makeBackendPrefs(preferences: BackendPreferences['preferences']): BackendPreferences {
  return {
    preferences,
    digest: { enabled: false, frequency: 'daily', time: '09:00', lastSentAt: null },
    paused: false,
    pausedUntil: null,
  };
}

function openTaskGroup() {
  fireEvent.click(screen.getByText('notif.mod.task'));
}

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({ message: 'Yangilandi' });
  vi.mocked(queries.useUpdatePreferences).mockReturnValue({
    mutate: vi.fn(),
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof queries.useUpdatePreferences>);
});

describe('SettingsPage — "tizim sozlamasi" shartnomasi', () => {
  it('sozlanmagan event indeterminate — checked EMAS (backend DEFAULT_PREFS FE\'da nusxalanmaydi)', () => {
    vi.mocked(queries.usePreferences).mockReturnValue(prefsResult(makeBackendPrefs({})));
    renderWithProviders(<SettingsPage />);
    openTaskGroup();

    const box = screen.getByLabelText('task_assigned — inApp') as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.closest('.ant-checkbox-indeterminate')).not.toBeNull();
  });

  it('sozlangan event indeterminate EMAS va serverdagi qiymatni ko\'rsatadi', () => {
    vi.mocked(queries.usePreferences).mockReturnValue(
      prefsResult(
        makeBackendPrefs({
          task_assigned: { inApp: true, telegram: false, email: false, sms: false },
        }),
      ),
    );
    renderWithProviders(<SettingsPage />);
    openTaskGroup();

    const inApp = screen.getByLabelText('task_assigned — inApp') as HTMLInputElement;
    const email = screen.getByLabelText('task_assigned — email') as HTMLInputElement;
    expect(inApp.checked).toBe(true);
    expect(email.checked).toBe(false);
    expect(inApp.closest('.ant-checkbox-indeterminate')).toBeNull();
  });

  it('saqlashda FAQAT tegilgan event yuboriladi — qolganlari default holatida qoladi', async () => {
    vi.mocked(queries.usePreferences).mockReturnValue(prefsResult(makeBackendPrefs({})));
    renderWithProviders(<SettingsPage />);
    openTaskGroup();

    fireEvent.click(screen.getByLabelText('task_assigned — telegram'));
    fireEvent.click(screen.getByText('notif.settings.save'));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const payload = mutateAsync.mock.calls[0]?.[0];
    expect(Object.keys(payload?.preferences ?? {})).toEqual(['task_assigned']);
    expect(payload?.preferences?.task_assigned).toEqual({
      inApp: false,
      telegram: true,
      email: false,
      sms: false,
    });
  });

  it('"Saqlash" paneli faqat o\'zgarish bo\'lganda chiqadi', () => {
    vi.mocked(queries.usePreferences).mockReturnValue(prefsResult(makeBackendPrefs({})));
    renderWithProviders(<SettingsPage />);
    openTaskGroup();

    expect(screen.queryByText('notif.settings.save')).toBeNull();
    fireEvent.click(screen.getByLabelText('task_assigned — sms'));
    expect(screen.getByText('notif.settings.save')).toBeTruthy();
  });
});
