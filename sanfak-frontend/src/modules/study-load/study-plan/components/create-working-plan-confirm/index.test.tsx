import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import CreateWorkingPlanConfirm from './index';

const { previewMock, detailMock } = vi.hoisted(() => ({
  previewMock: vi.fn(),
  detailMock: vi.fn(),
}));

vi.mock('../../../working-schedule/api/working-schedule-api', () => ({
  useSupersedePreview: previewMock,
}));

vi.mock('../../api/detail-api', () => ({
  useStudyPlanDetail: detailMock,
}));

function mockDetail(courseNums: number[] | null) {
  detailMock.mockReturnValue(
    courseNums === null
      ? { data: undefined, isPending: false, isError: true }
      : {
          data: { courses: courseNums.map((n) => ({ courseNum: n, course: String(n) })) },
          isPending: false,
          isError: false,
        },
  );
}

beforeEach(() => {
  mockDetail([1, 2, 3, 4, 5, 6]);
});

interface IPreviewState {
  data?: { affected: unknown[]; totalExisting: number; totalLocked: number };
  isPending?: boolean;
  isError?: boolean;
}

function mockPreview({ data, isPending = false, isError = false }: IPreviewState) {
  previewMock.mockReturnValue({ data, isPending, isError });
}

function renderConfirm(onConfirm = vi.fn()) {
  return renderWithProviders(
    <CreateWorkingPlanConfirm
      open
      learningProcessId="lp-1"
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
}

describe('CreateWorkingPlanConfirm — almashtirish ogohlantirishi (AD-1c)', () => {
  it('tasdiqlangan hujjat o`chadigan bo`lsa — ogohlantirish IMZOLANGANLAR sonini ko`rsatadi', () => {
    mockPreview({ data: { affected: [], totalExisting: 5, totalLocked: 2 } });
    renderConfirm();

    expect(
      screen.getByText("Mavjud ishchi o'quv rejalar almashtiriladi"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Bu yo'nalish uchun allaqachon 5 ta ishchi o'quv reja mavjud, shundan 2 tasi tasdiqlangan. Davom etsangiz ular — tasdiqlanganlari ham — o'chiriladi va qayta yaratiladi.",
      ),
    ).toBeTruthy();
  });

  it("mavjud hujjat bo'lmasa — ogohlantirish umuman ko'rsatilmaydi", () => {
    mockPreview({ data: { affected: [], totalExisting: 0, totalLocked: 0 } });
    renderConfirm();

    expect(screen.queryByText("Mavjud ishchi o'quv rejalar almashtiriladi")).toBeNull();
  });

  it("preview xato bersa — jimgina yashirilmaydi, lekin tugma BLOKLANMAYDI", () => {
    mockPreview({ isError: true });
    renderConfirm();

    expect(screen.getByText("Ogohlantirishni yuklab bo'lmadi")).toBeTruthy();
    const confirmButton = screen.getByRole('button', { name: 'Yaratish' });
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton.className).not.toContain('ant-btn-loading');
  });
});

describe('CreateWorkingPlanConfirm — kurs tanlovi (variant B)', () => {
  it('default — hamma kurs belgilangan, courses YUBORILMAYDI (so`rov avvalgidek)', () => {
    mockPreview({ data: { affected: [], totalExisting: 0, totalLocked: 0 } });
    const onConfirm = vi.fn();
    renderConfirm(onConfirm);

    expect(screen.getByRole('checkbox', { name: '1-kurs' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '6-kurs' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Yaratish' }));
    expect(onConfirm).toHaveBeenCalledWith('', undefined);
  });

  it('qisman tanlov — faqat tanlangan kurslar uzatiladi', () => {
    mockPreview({ data: { affected: [], totalExisting: 0, totalLocked: 0 } });
    const onConfirm = vi.fn();
    renderConfirm(onConfirm);

    for (const n of [1, 2, 3, 4]) {
      fireEvent.click(screen.getByRole('checkbox', { name: `${n}-kurs` }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Yaratish' }));
    expect(onConfirm).toHaveBeenCalledWith('', [5, 6]);
  });

  it('hech bir kurs tanlanmasa — tugma o`chiq va izoh ko`rsatiladi', () => {
    mockPreview({ data: { affected: [], totalExisting: 0, totalLocked: 0 } });
    mockDetail([1, 2]);
    renderConfirm();

    fireEvent.click(screen.getByRole('checkbox', { name: '1-kurs' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '2-kurs' }));
    expect(screen.getByText('Kamida bitta kursni tanlang')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yaratish' })).toBeDisabled();
  });

  it('kurslar yuklanmasa — tanlov yo`q, bu ochiq aytiladi, tugma ishlaydi', () => {
    mockPreview({ data: { affected: [], totalExisting: 0, totalLocked: 0 } });
    mockDetail(null);
    const onConfirm = vi.fn();
    renderConfirm(onConfirm);

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(
      screen.getByText(
        "Kurslar ro'yxatini aniqlab bo'lmadi — ishchi reja barcha kurslar uchun yaratiladi.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yaratish' }));
    expect(onConfirm).toHaveBeenCalledWith('', undefined);
  });
});
