import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { theme } from '../styles/theme';

const can = vi.fn<(key: string) => boolean>();
vi.mock('@/app/session', () => ({
  usePermission: () => can,
}));

const SPECIALTIES = [
  {
    id: 's1',
    title: 'Kardiologiya',
    code: 'KRD',
    program: 'ordinatura' as const,
    studyPeriod: 3,
    departmentId: 'd1',
    departmentTitle: 'Ichki kasalliklar',
    active: true,
  },
];

vi.mock('../api/residency-api', () => ({
  useSpecialties: () => ({ data: SPECIALTIES, isLoading: false }),
  useCreateSpecialty: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSpecialty: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSpecialty: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDepartments: () => ({ data: [] }),
  useGroups: () => ({ data: [] }),
}));

const SKILLS = [
  {
    id: 'k1',
    specialtyId: 's1',
    specialtyTitle: 'Kardiologiya',
    semester: '1-semestr',
    theoryTopicId: 't1',
    theoryTopicTitle: 'Yurak anatomiyasi',
    practicalSkill: 'EKG o‘qish',
    patientCount: 5,
  },
];
const TOPICS = [{ id: 't1', title: 'Yurak anatomiyasi', active: true }];

vi.mock('../api/skill-api', () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false }),
  useCreateSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTheoryTopics: () => ({ data: TOPICS, isLoading: false }),
  useCreateTheoryTopic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTheoryTopic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTheoryTopic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSkillProgress: () => ({ data: [], isLoading: false }),
}));

vi.mock('../api/reference-api', () => ({
  useCourses: () => ({ data: [] }),
  useAcademicYears: () => ({ data: [] }),
  withCurrent: (list: unknown[]) => list,
}));

const { default: Mutaxassisliklar } = await import('./Mutaxassisliklar');
const { default: Konikmalar } = await import('./Konikmalar');

const asDefaultTheme = theme as unknown as DefaultTheme;

function grant(...keys: string[]) {
  can.mockImplementation((key: string) => keys.includes(key));
}

function draw(node: React.ReactElement) {
  return render(<ThemeProvider theme={asDefaultTheme}>{node}</ThemeProvider>);
}

const editBtns = () => screen.queryAllByTitle('Tahrirlash');
const deleteBtns = () => screen.queryAllByTitle('O‘chirish');

beforeEach(() => can.mockReset());

describe('Mutaxassisliklar — yozish tugmalari (MD-16)', () => {
  it('faqat readAll bo‘lsa: qo‘shish/tahrirlash/o‘chirish YO‘Q', () => {
    grant('residencySpecialty:readAll');
    draw(<Mutaxassisliklar />);

    expect(screen.queryByText(/Mutaxassislik qo/)).toBeNull();
    expect(editBtns()).toHaveLength(0);
    expect(deleteBtns()).toHaveLength(0);
    expect(screen.queryByText('Amallar')).toBeNull();
  });

  it('katalogning O‘ZI baribir ko‘rinadi (gate faqat YOZISHNI yopadi)', () => {
    grant('residencySpecialty:readAll');
    draw(<Mutaxassisliklar />);

    expect(screen.getByText('Kardiologiya')).toBeTruthy();
    expect(screen.getByText('Ichki kasalliklar')).toBeTruthy();
  });

  it('to‘liq grant (bo‘lim xodimi): uchala amal ham bor', () => {
    grant(
      'residencySpecialty:readAll',
      'residencySpecialty:create',
      'residencySpecialty:update',
      'residencySpecialty:delete',
    );
    draw(<Mutaxassisliklar />);

    expect(screen.getByText(/Mutaxassislik qo/)).toBeTruthy();
    expect(editBtns()).toHaveLength(1);
    expect(deleteBtns()).toHaveLength(1);
    expect(screen.getByText('Amallar')).toBeTruthy();
  });

  it('kalitlar MUSTAQIL — `update` bor, `delete` yo‘q', () => {
    grant('residencySpecialty:readAll', 'residencySpecialty:update');
    draw(<Mutaxassisliklar />);

    expect(editBtns()).toHaveLength(1);
    expect(deleteBtns()).toHaveLength(0);
    expect(screen.queryByText(/Mutaxassislik qo/)).toBeNull();
  });
});

describe('Ko‘nikmalar — yozish tugmalari (MD-16)', () => {
  function openTab(name: RegExp) {
    fireEvent.click(screen.getByRole('button', { name }));
  }

  it('klinik ustoz granti (read+readAll): ko‘nikma yozish tugmalari YO‘Q', () => {
    grant('residencySkill:read', 'residencySkill:readAll', 'residencyTheoryTopic:readAll');
    draw(<Konikmalar />);
    openTab(/^Ko‘nikmalar$/);

    expect(screen.queryByText(/Qo‘shish/)).toBeNull();
    expect(editBtns()).toHaveLength(0);
    expect(deleteBtns()).toHaveLength(0);
  });

  it('bo‘lim xodimi granti: ko‘nikma tugmalari bor', () => {
    grant(
      'residencySkill:readAll',
      'residencySkill:create',
      'residencySkill:update',
      'residencySkill:delete',
    );
    draw(<Konikmalar />);
    openTab(/^Ko‘nikmalar$/);

    expect(screen.getByText(/Qo‘shish/)).toBeTruthy();
    expect(editBtns()).toHaveLength(1);
    expect(deleteBtns()).toHaveLength(1);
  });

  it('nazariy bilim ALOHIDA bo‘lim — ko‘nikma granti uni ochmaydi', () => {
    grant(
      'residencySkill:readAll',
      'residencySkill:create',
      'residencySkill:update',
      'residencySkill:delete',
      'residencyTheoryTopic:readAll',
    );
    draw(<Konikmalar />);
    openTab(/Nazariy va umumiy bilim/);

    expect(screen.queryByText(/Qo‘shish/)).toBeNull();
    expect(editBtns()).toHaveLength(0);
    expect(deleteBtns()).toHaveLength(0);
  });

  it('status nishoni `update` siz BOSILMAYDI, lekin holat KO‘RINADI', () => {
    grant('residencyTheoryTopic:readAll');
    draw(<Konikmalar />);
    openTab(/Nazariy va umumiy bilim/);

    expect(screen.getByText('Faol')).toBeTruthy();
    expect(screen.queryByTitle('Statusni o‘zgartirish')).toBeNull();
  });

  it('`update` bor bo‘lsa status nishoni bosiladigan bo‘ladi', () => {
    grant('residencyTheoryTopic:readAll', 'residencyTheoryTopic:update');
    draw(<Konikmalar />);
    openTab(/Nazariy va umumiy bilim/);

    expect(screen.getByTitle('Statusni o‘zgartirish')).toBeTruthy();
  });
});
