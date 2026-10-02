import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Formik, useFormikContext } from 'formik';
import { Form } from 'antd';
import { renderWithProviders } from '@/test/test-utils';
import type { PlanHourItem, V142FormValues } from '../../model/types';
import { V142_INITIAL_VALUES } from '../../lib/v142-defaults';
import { summarizeTopicHours } from '../../lib/topic-hours';
import TopicHoursSummary from '../topic-hours-summary';
import TopicsByTypeRepeater from './index';

const PLAN: PlanHourItem[] = [
  { slug: 'maruza', title: "Ma'ruza", value: 10 },
  { slug: 'amaliy', title: 'Amaliy', value: 20 },
];

const Harness = ({ plan }: { plan: PlanHourItem[] | null }) => {
  const { values } = useFormikContext<V142FormValues>();
  const rows = summarizeTopicHours(values.topics, plan);
  return (
    <>
      <TopicHoursSummary rows={rows} hasPlan={Boolean(plan && plan.length > 0)} />
      <TopicsByTypeRepeater />
    </>
  );
};

function renderRepeater(plan: PlanHourItem[] | null = PLAN) {
  const initial: V142FormValues = {
    ...V142_INITIAL_VALUES,
    topics: [{ type: 'maruza', code: '', title: 'Anesteziologiya tarixi', hours: 8, refs: '' }],
  };
  return renderWithProviders(
    <Formik initialValues={initial} onSubmit={() => undefined}>
      <Form layout="vertical">
        <Harness plan={plan} />
      </Form>
    </Formik>,
  );
}

function openTypeDropdown(rowIdx: number): void {
  const row = screen.getByTestId(`topic-row-${rowIdx}`);
  const selector = row.querySelector('.ant-select-selector');
  if (!selector) throw new Error('Tur select topilmadi');
  fireEvent.mouseDown(selector);
}

const summaryText = () => screen.getByTestId('topic-hours-summary').textContent ?? '';

describe('TopicsByTypeRepeater + TopicHoursSummary — §5 mavzular (DOM)', () => {
  it("tur select'ida 5 ta variant ko'rinadi (TOPIC_TYPES tartibida)", async () => {
    renderRepeater();
    openTypeDropdown(0);

    await waitFor(() => {
      expect(document.querySelectorAll('.ant-select-item-option')).toHaveLength(5);
    });
    const labels = Array.from(document.querySelectorAll('.ant-select-item-option')).map(
      (el) => el.getAttribute('title'),
    );
    expect(labels).toEqual(["Ma'ruza", 'Amaliy', 'Seminar', 'Laboratoriya', 'Klinik amaliyot']);
  });

  it("boshlang'ich holat: `8/10` + ⚠ (rejadan kam) va avto kod `M1` (placeholder, tahrirlanadi)", () => {
    renderRepeater();

    expect(summaryText()).toContain('8/10');
    expect(summaryText()).toContain('⚠');
    expect(within(screen.getByTestId('topic-row-0')).getByPlaceholderText('M1')).toBeInTheDocument();
  });

  it("qator qo'shilsa yig'indi JONLI yangilanadi (8 → 9) va yangi kod `M2`", async () => {
    renderRepeater();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mavzu qo'shish/ }));
    });

    expect(screen.getByTestId('topic-row-1')).toBeInTheDocument();
    expect(within(screen.getByTestId('topic-row-1')).getByPlaceholderText('M2')).toBeInTheDocument();
    expect(summaryText()).toContain('9/10');
  });

  it("qator o'chirilsa yig'indi kamayadi va ogohlantirish yo'qolmaydi — blok yo'q (D-10)", async () => {
    renderRepeater();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mavzu qo'shish/ }));
    });
    expect(summaryText()).toContain('9/10');

    const deleteButtons = screen.getAllByRole('button', { name: "O'chirish" });
    await act(async () => {
      fireEvent.click(deleteButtons[1]!);
    });

    expect(screen.queryByTestId('topic-row-1')).not.toBeInTheDocument();
    expect(summaryText()).toContain('8/10');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it("reja yo'q (`planHours: null`) — yig'indi belgisiz (`8`, `/` yo'q), ⚠ chiqmaydi", () => {
    renderRepeater(null);

    const chipValue = screen
      .getByTestId('topic-hours-summary')
      .querySelector('.chip-value')?.textContent;
    expect(chipValue).toBe('8');
    expect(summaryText()).not.toContain('⚠');
  });
});
