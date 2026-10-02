import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import type * as RouterDom from 'react-router-dom';
import WorkloadDetailPage from './workload-detail-page';

const { fetchOneMock, postJsonMock } = vi.hoisted(() => ({
  fetchOneMock: vi.fn(),
  postJsonMock: vi.fn(),
}));

vi.mock('@/shared/api', async () => {
  const actual = await vi.importActual<typeof SharedApi>('@/shared/api');
  return { ...actual, fetchOne: fetchOneMock, postJson: postJsonMock };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof RouterDom>('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'w1' }), useNavigate: () => vi.fn() };
});

function mockDetail(
  status: string,
  lastEditedAfterApprovalAt: string | null = null,
  extra: Record<string, unknown> = {},
) {
  fetchOneMock.mockResolvedValue({
    _id: 'w1',
    title: 'Ichki kasalliklar kafedrasi',
    department: null,
    academicYear: null,
    status,
    directions: [
      {
        _id: 'dir1',
        direction: { _id: 'dr1', title: 'Davolash ishi' },
        blocks: [
          {
            _id: 'blk1',
            section: 'DAVOLASH ISHI',
            science: { _id: 'sc1', title: 'Anatomiya' },
            course: 1,
            student: 60,
            studyWork: { group: 3, stream: 1, semester: 1, classTypes: [], items: [] },
            otherWork: { items: [] },
            leadership: 0,
            totalHour: 120,
          },
        ],
      },
    ],
    staffPositions: { items: [], totalPositions: 0, hourly: 0 },
    lastEditedAfterApprovalAt,
    ...extra,
  });
}

describe('WorkloadDetailPage — ADR-012 kontent tahriri qamrovi', () => {
  it("`approved` — tahrir YOPIQ (to'liq tasdiqlangan hujjat o'zgarmaydi)", async () => {
    mockDetail('approved');
    renderWithProviders(<WorkloadDetailPage />);

    await screen.findByText(/Tasdiqlangan/);
    expect(screen.queryByText('Qayta hisoblash')).not.toBeInTheDocument();
    expect(screen.queryByText('Amallar')).not.toBeInTheDocument();
  });

  it("`draft` — tahrir OCHIQ (canEdit true: 'Qayta hisoblash' + 'Amallar' ustuni bor)", async () => {
    mockDetail('draft');
    renderWithProviders(<WorkloadDetailPage />);

    expect(await screen.findByText('Qayta hisoblash')).toBeInTheDocument();
    expect(screen.getByText('Amallar')).toBeInTheDocument();
  });

  it("`in_review` — tahrir YOPIQ (backend 400 beradi, FE ham ko'rsatmaydi)", async () => {
    mockDetail('in_review');
    renderWithProviders(<WorkloadDetailPage />);

    await screen.findByText('Ichki kasalliklar kafedrasi');
    expect(screen.queryByText('Qayta hisoblash')).not.toBeInTheDocument();
    expect(screen.queryByText('Amallar')).not.toBeInTheDocument();
  });

  it('`rejected` — tahrir YOPIQ (avval "qayta ochish" kerak)', async () => {
    mockDetail('rejected');
    renderWithProviders(<WorkloadDetailPage />);

    await screen.findByText('Ichki kasalliklar kafedrasi');
    expect(screen.queryByText('Qayta hisoblash')).not.toBeInTheDocument();
    expect(screen.queryByText('Amallar')).not.toBeInTheDocument();
  });

  it("`lastEditedAfterApprovalAt` bor — belgi ko'rinadi (sana bilan, ismSIZ)", async () => {
    mockDetail('approved', '2026-08-19T09:12:00.000Z');
    renderWithProviders(<WorkloadDetailPage />);

    const badge = await screen.findByText(/Tasdiqlangandan keyin tahrirlangan/);
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('2026');
  });

  it("`lastEditedAfterApprovalAt` `null` — belgi KO'RINMAYDI", async () => {
    mockDetail('approved', null);
    renderWithProviders(<WorkloadDetailPage />);

    await screen.findByText('Ichki kasalliklar kafedrasi');
    expect(screen.queryByText(/Tasdiqlangandan keyin tahrirlangan/)).not.toBeInTheDocument();
  });
});

describe('WorkloadDetailPage — D1: `skipped` muvaffaqiyat deb ko`rsatilmaydi', () => {
  it('`skipped: true` → "blok yangilandi" xabari CHIQMAYDI', async () => {
    mockDetail('draft');
    postJsonMock.mockResolvedValue({
      results: [
        {
          workloadId: 'w1',
          skipped: true,
          success: true,
          reason: 'status="approved" — ERI himoyasi tufayli qayta hisoblanmadi',
        },
      ],
    });

    const user = userEvent.setup();
    renderWithProviders(<WorkloadDetailPage />);

    await user.click(await screen.findByText('Qayta hisoblash'));

    expect(await screen.findByText(/qayta hisoblanmadi/i)).toBeInTheDocument();
    expect(screen.queryByText(/blok yangilandi/i)).not.toBeInTheDocument();
  });
});

describe('WorkloadDetailPage — ADR-043 versiyalar', () => {
  it("`superseded` — ogohlantirish + yangi versiya havolasi, tahrir/qayta hisoblash YO'Q", async () => {
    mockDetail('superseded', null, { version: 1, supersededBy: 'w2' });
    renderWithProviders(<WorkloadDetailPage />);

    expect(await screen.findByText(/o'z kuchini yo'qotgan/)).toBeInTheDocument();
    expect(screen.getByText("Yangi versiyani ko'rish")).toBeInTheDocument();
    expect(screen.getByText('Almashtirilgan')).toBeInTheDocument();
    expect(screen.queryByText('Qayta hisoblash')).not.toBeInTheDocument();
    expect(screen.queryByText('Amallar')).not.toBeInTheDocument();
    expect(screen.queryByText('v1')).not.toBeInTheDocument();
  });

  it("`superseded` + `supersededBy` yo'q — ogohlantirish bor, havola YO'Q", async () => {
    mockDetail('superseded');
    renderWithProviders(<WorkloadDetailPage />);

    expect(await screen.findByText(/o'z kuchini yo'qotgan/)).toBeInTheDocument();
    expect(screen.queryByText("Yangi versiyani ko'rish")).not.toBeInTheDocument();
  });

  it("v2 `draft` — `v2` belgisi bor, ogohlantirish YO'Q", async () => {
    mockDetail('draft', null, { version: 2, previousVersion: 'w0' });
    renderWithProviders(<WorkloadDetailPage />);

    expect(await screen.findByText('v2')).toBeInTheDocument();
    expect(screen.queryByText(/o'z kuchini yo'qotgan/)).not.toBeInTheDocument();
  });
});
