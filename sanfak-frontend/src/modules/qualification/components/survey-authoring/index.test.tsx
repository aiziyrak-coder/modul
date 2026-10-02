import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import SurveyAuthoring from './index';
import { SURVEY_TYPE, type SurveyQuestion } from '../../model/survey.types';

const onCreate = vi.fn().mockResolvedValue(undefined);
const onUpdate = vi.fn().mockResolvedValue(undefined);
const onDelete = vi.fn().mockResolvedValue(undefined);
const onPageChange = vi.fn();

vi.mock('@/app/session', () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const q = (over: Partial<SurveyQuestion> = {}): SurveyQuestion => ({
  _id: 'q1',
  question: 'Kurs sifatini baholang',
  type: SURVEY_TYPE.CHOICE,
  options: [{ text: 'Yaxshi' }, { text: "O'rtacha" }],
  required: true,
  order: 0,
  active: true,
  ...over,
});

const renderIt = (questions: SurveyQuestion[]) =>
  renderWithProviders(
    <SurveyAuthoring
      questions={questions}
      isLoading={false}
      page={1}
      limit={12}
      total={questions.length}
      onPageChange={onPageChange}
      onPageSizeChange={vi.fn()}
      createPerm="qualSurvey:create"
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />,
  );

beforeEach(() => {
  onCreate.mockClear();
  onUpdate.mockClear();
  onDelete.mockClear();
  onPageChange.mockClear();
});

describe("So'rovnoma muharriri", () => {
  it('mavjud savol kartochka sifatida chiqadi', async () => {
    renderIt([q()]);

    expect(await screen.findByText('1-savol')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kurs sifatini baholang')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Yaxshi')).toBeInTheDocument();
  });

  it("to'g'ri javob tanlagichi YO'Q (bu test emas)", async () => {
    renderIt([q()]);
    await screen.findByText('1-savol');

    const optionRow = screen.getByDisplayValue('Yaxshi').closest('div') as HTMLElement;
    expect(within(optionRow).queryByRole('radio')).toBeNull();
    expect(within(optionRow).queryByRole('checkbox')).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it("yangi savol qo'shiladi va bo'sh matn bilan saqlanmaydi", async () => {
    const user = userEvent.setup({ delay: null });
    renderIt([]);

    await user.click(await screen.findByRole('button', { name: /Savol qo'shish/ }));
    expect(await screen.findByText('1-savol')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Savolni saqlash'));
    await waitFor(() => expect(onCreate).not.toHaveBeenCalled());
  });

  it("variantli savol kamida IKKI variant talab qiladi", async () => {
    const user = userEvent.setup({ delay: null });
    renderIt([]);

    await user.click(await screen.findByRole('button', { name: /Savol qo'shish/ }));
    const card = (await screen.findByText('1-savol')).closest('.ant-card') as HTMLElement;

    await user.type(within(card).getByPlaceholderText(/Savol matnini/), 'Yangi savol');
    await user.type(within(card).getByPlaceholderText('A-variant'), 'Birinchi');
    await user.click(screen.getByLabelText('Savolni saqlash'));
    await waitFor(() => expect(onCreate).not.toHaveBeenCalled());

    await user.type(within(card).getByPlaceholderText('B-variant'), 'Ikkinchi');
    await user.click(screen.getByLabelText('Savolni saqlash'));
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          question: 'Yangi savol',
          type: SURVEY_TYPE.CHOICE,
          options: [{ text: 'Birinchi' }, { text: 'Ikkinchi' }],
        }),
      ),
    );
  }, 20000);

  it('2-sahifada savol raqami GLOBAL bo‘ladi (13, 14 …)', async () => {
    renderWithProviders(
      <SurveyAuthoring
        questions={[q({ _id: 'q13', question: "O'n uchinchi savol" })]}
        isLoading={false}
        page={2}
        limit={12}
        total={52}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
        createPerm="qualSurvey:create"
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    expect(await screen.findByText('13-savol')).toBeInTheDocument();
    expect(screen.getByText('Savollar: 52 ta')).toBeInTheDocument();
  });

  it('yangi savol 1-SAHIFAGA olib boradi va ro‘yxat BOSHIDA chiqadi', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(
      <SurveyAuthoring
        questions={[q({ _id: 'q13', question: "O'n uchinchi savol" })]}
        isLoading={false}
        page={2}
        limit={12}
        total={52}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
        createPerm="qualSurvey:create"
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    await screen.findByText('13-savol');

    await user.click(screen.getByRole('button', { name: /Savol qo'shish/ }));

    expect(onPageChange).toHaveBeenCalledWith(1);
    const existing = (await screen.findByDisplayValue("O'n uchinchi savol")).closest(
      '.ant-card',
    ) as HTMLElement;
    expect(within(existing).getByText('14-savol')).toBeInTheDocument();
    expect(screen.getByText('13-savol')).toBeInTheDocument();
  });

  it('yangi savol mavjudlaridan OLDIN saqlanadi (order kichikroq)', async () => {
    const user = userEvent.setup({ delay: null });
    renderIt([q({ order: 5 }), q({ _id: 'q2', order: 9 })]);
    await screen.findByText('1-savol');

    await user.click(screen.getByRole('button', { name: /Savol qo'shish/ }));
    const card = (await screen.findByText('1-savol')).closest('.ant-card') as HTMLElement;
    await user.type(within(card).getByPlaceholderText(/Savol matnini/), 'Yangi');
    await user.type(within(card).getByPlaceholderText('A-variant'), 'Bir');
    await user.type(within(card).getByPlaceholderText('B-variant'), 'Ikki');
    await user.click(within(card).getByLabelText('Savolni saqlash'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ order: 4 })),
    );
  }, 20000);

  it("10 variantli savolda HAR variant harfli (42-savol regressiyasi)", async () => {
    renderIt([
      q({
        question: 'Umumiy qoniqish darajangizni baholang',
        options: Array.from({ length: 10 }, (_, i) => ({ text: String(i + 1) })),
      }),
    ]);

    const card = (await screen.findByText('1-savol')).closest('.ant-card') as HTMLElement;
    for (const letter of ['A', 'E', 'H', 'I', 'J']) {
      expect(within(card).getByText(`${letter})`)).toBeInTheDocument();
    }
    expect(within(card).queryByText(')')).toBeNull();
  });

  it("tur tanlagichi IKKI holatli: variantli va matnli (baho/majburiy YO'Q)", async () => {
    const user = userEvent.setup({ delay: null });
    renderIt([]);

    await user.click(await screen.findByRole('button', { name: /Savol qo'shish/ }));
    const card = (await screen.findByText('1-savol')).closest('.ant-card') as HTMLElement;

    expect(within(card).getByText('Variantli')).toBeInTheDocument();
    expect(within(card).getByText('Ochiq matn')).toBeInTheDocument();
    expect(within(card).queryByText('Baho (1-5)')).toBeNull();
    expect(within(card).queryByText('Majburiy')).toBeNull();
  });

  it('matnli turga o‘tilganda variant maydonlari yo‘qoladi va type=3 saqlanadi', async () => {
    const user = userEvent.setup({ delay: null });
    renderIt([]);

    await user.click(await screen.findByRole('button', { name: /Savol qo'shish/ }));
    const card = (await screen.findByText('1-savol')).closest('.ant-card') as HTMLElement;
    expect(within(card).getByPlaceholderText('A-variant')).toBeInTheDocument();

    await user.click(within(card).getByText('Ochiq matn'));
    await waitFor(() =>
      expect(within(card).queryByPlaceholderText('A-variant')).not.toBeInTheDocument(),
    );

    await user.type(within(card).getByPlaceholderText(/Savol matnini/), 'Takliflaringiz');
    await user.click(screen.getByLabelText('Savolni saqlash'));
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          question: 'Takliflaringiz',
          type: SURVEY_TYPE.TEXT,
          options: [],
        }),
      ),
    );
  }, 20000);
});
