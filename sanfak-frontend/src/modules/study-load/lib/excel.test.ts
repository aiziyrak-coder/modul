import { describe, expect, it } from 'vitest';
import {
  buildWorkingScheduleRows,
  buildContingentRows,
  buildDistributionRows,
  buildWorkloadRows,
  buildVacancyRows,
  type DistributionExcelRow,
} from './excel';
import type { WorkingSchedule } from '../working-schedule/model/types';
import type { Contingent } from '../contingent/model/types';
import type { Workload } from '../workload/model/types';
import type { Vacancy } from '../distribution/model/types';

describe('buildWorkingScheduleRows', () => {
  it('maydonlarni Excel qatoriga to\'g\'ri o\'giradi (xulqi working-schedule/lib/excel.ts bilan bir xil)', () => {
    const items: WorkingSchedule[] = [
      {
        id: '1',
        title: 'Filologiya ishchi rejasi',
        directionTitle: 'Filologiya',
        courseTitle: '1-kurs',
        academicYearTitle: '2024-2025',
        stage: null,
        date: '2024-09-01T00:00:00.000Z',
        status: 'approved',
        createdAt: '2024-08-01T00:00:00.000Z',
        file: null,
      },
    ];

    const rows = buildWorkingScheduleRows(items);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      '#': 1,
      Nomi: 'Filologiya ishchi rejasi',
      "Yo'nalish": 'Filologiya',
      Kurs: '1-kurs',
      "O'quv yili": '2024-2025',
      Status: 'Tasdiqlangan',
    });
  });

  it('bo\'sh maydonlar uchun — chiziqcha, sana bo\'lmasa createdAt fallback', () => {
    const items: WorkingSchedule[] = [
      {
        id: '2',
        title: null,
        directionTitle: null,
        courseTitle: null,
        academicYearTitle: null,
        stage: null,
        date: null,
        status: 'draft',
        createdAt: '2024-08-01T00:00:00.000Z',
        file: null,
      },
    ];

    const rows = buildWorkingScheduleRows(items);

    expect(rows[0]?.['Nomi']).toBe('—');
    expect(rows[0]?.['Kurs']).toBe('—');
    expect(rows[0]?.['Status']).toBe('Yangi');
    expect(rows[0]?.['Yuklangan sana']).not.toBe('—');
  });
});

describe('buildContingentRows', () => {
  it('kontingent maydonlarini ekrandagi ustunlar tartibida chiqaradi', () => {
    const items: Contingent[] = [
      {
        id: '1',
        title: 'F-101',
        desc: null,
        directionId: 'd1',
        directionTitle: 'Farmatsiya',
        courseId: 'c1',
        courseTitle: '2-kurs',
        langId: 'l1',
        langTitle: "O'zbekcha",
        academicYearId: 'ay1',
        academicYearTitle: '2025/2026',
        studentNumber: 25,
        active: true,
      },
    ];

    const rows = buildContingentRows(items);

    expect(rows).toEqual([
      {
        '#': 1,
        'Guruh nomi': 'F-101',
        "Yo'nalish": 'Farmatsiya',
        Kurs: '2-kurs',
        "O'quv yili": '2025/2026',
        'Talabalar soni': 25,
        "Ta'lim tili": "O'zbekcha",
      },
    ]);
  });

  it('null reference maydonlar — chiziqcha bilan almashtiriladi', () => {
    const items: Contingent[] = [
      {
        id: '2',
        title: 'F-102',
        desc: null,
        directionId: null,
        directionTitle: null,
        courseId: null,
        courseTitle: null,
        langId: null,
        langTitle: null,
        academicYearId: null,
        academicYearTitle: null,
        studentNumber: 0,
        active: true,
      },
    ];

    const rows = buildContingentRows(items);

    expect(rows[0]).toMatchObject({
      "Yo'nalish": '—',
      Kurs: '—',
      "O'quv yili": '—',
      "Ta'lim tili": '—',
      'Talabalar soni': 0,
    });
  });
});

describe('buildDistributionRows', () => {
  it('taqsimot ro\'yxati qatorini to\'g\'ri o\'giradi (kurs mavjud bo\'lganda)', () => {
    const items: DistributionExcelRow[] = [
      {
        title: 'Filologiya kafedrasi',
        course: 2,
        scienceNumber: 5,
        totalHour: 320,
        residueHour: 40,
        academicYearTitle: '2024-2025',
        date: '2024-09-01',
        status: 'in_review',
      },
    ];

    const rows = buildDistributionRows(items);

    expect(rows).toEqual([
      {
        '#': 1,
        Nomi: 'Filologiya kafedrasi',
        Kurs: '2-kurs',
        'Fanlar soni': 5,
        'Jami soat': 320,
        'Qoldiq soat': 40,
        "O'quv yili": '2024-2025',
        Sana: '2024-09-01',
        Status: 'Tekshirilmoqda',
      },
    ]);
  });

  it('course=null (detail sahifadan) — chiziqcha, boshqa maydonlar saqlanadi', () => {
    const items: DistributionExcelRow[] = [
      {
        title: null,
        course: null,
        scienceNumber: 0,
        totalHour: 0,
        residueHour: 0,
        academicYearTitle: null,
        date: null,
        status: 'draft',
      },
    ];

    const rows = buildDistributionRows(items);

    expect(rows[0]).toMatchObject({
      Nomi: '—',
      Kurs: '—',
      "O'quv yili": '—',
      Sana: '—',
      Status: 'Yangi',
    });
  });
});


describe('buildWorkloadRows', () => {
  const base: Workload = {
    id: '1',
    title: null,
    currentStep: null,
    lastEditedAfterApprovalAt: null,
    needsRecalculation: false,
    version: 1,
    previousVersionId: null,
    supersededById: null,
    supersededAt: null,
    departmentId: 'd1',
    departmentTitle: 'Ichki kasalliklar kafedrasi',
    academicYearId: 'ay1',
    academicYearTitle: '2026/2027',
    totalLectures: 14,
    totalHours: 2340,
    status: 'approved',
    date: '2026-09-01',
  };

  it("maydonlarni Excel qatoriga to'g'ri o'giradi", () => {
    const rows = buildWorkloadRows([base]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      '#': 1,
      Kafedra: 'Ichki kasalliklar kafedrasi',
      'Fanlar soni': 14,
      'Jami soat': 2340,
      "O'quv yili": '2026/2027',
      Sana: '2026-09-01',
      Status: 'Tasdiqlangan',
    });
  });

  it("bo'sh maydonlar uchun chiziqcha qaytadi (sahifa yiqilmasin)", () => {
    const rows = buildWorkloadRows([
      { ...base, departmentTitle: null, academicYearTitle: null, date: null },
    ]);

    expect(rows[0]).toMatchObject({
      Kafedra: '—',
      "O'quv yili": '—',
      Sana: '—',
    });
  });

  it("ustunlar tartibi ro'yxat sahifasi bilan bir xil", () => {
    const [first] = buildWorkloadRows([base]);

    expect(first).toBeDefined();
    expect(Object.keys(first ?? {})).toEqual([
      '#',
      'Kafedra',
      'Fanlar soni',
      'Jami soat',
      "O'quv yili",
      'Sana',
      'Status',
    ]);
  });

  it('raqamlash 1 dan boshlanadi va ketma-ket ketadi', () => {
    const rows = buildWorkloadRows([base, { ...base, id: '2' }, { ...base, id: '3' }]);

    expect(rows.map((r) => r['#'])).toEqual([1, 2, 3]);
  });
});

describe('buildVacancyRows — "Talab" ustuni (Faza 2)', () => {
  const vacancy: Vacancy = {
    distributionId: 'd-1',
    distributionTitle: 'Taqsimot-1',
    distributionStatus: 'draft',
    course: 2,
    department: { id: 'dep-1', title: 'Terapiya kafedrasi' },
    academicYear: { id: 'ay-1', title: '2026-2027' },
    teacherEntryId: 'entry-1',
    vacancyNumber: 1,
    vacantLabel: 'Vakant',
    vacancyReason: null,
    vacantSince: null,
    leave: null,
    totalHour: 120,
    blocks: [],
    requiredPosition: null,
    requiredSpecialization: null,
    requiredAcademicTitle: null,
    deadline: null,
    postedAt: null,
  };

  it('requiredSpecialization ENG BIRINCHI — requiredPosition va requiredAcademicTitle bilan birga', () => {
    const rows = buildVacancyRows([
      {
        ...vacancy,
        requiredSpecialization: 'Kardiologiya',
        requiredPosition: 'Dotsent',
        requiredAcademicTitle: 'docent',
      },
    ]);
    expect(rows[0]?.['Talab']).toBe('Kardiologiya, Dotsent, Dotsent');
  });

  it('faqat requiredSpecialization berilgan — o\'shani ko\'rsatadi (ilgari umuman ko\'rinmasdi)', () => {
    const rows = buildVacancyRows([{ ...vacancy, requiredSpecialization: 'Kardiologiya' }]);
    expect(rows[0]?.['Talab']).toBe('Kardiologiya');
  });

  it('hech qaysi talab maydoni yo\'q — chiziqcha', () => {
    const rows = buildVacancyRows([vacancy]);
    expect(rows[0]?.['Talab']).toBe('—');
  });

  it('noma\'lum requiredAcademicTitle qiymati — xom qiymat ko\'rsatiladi (yiqilmaydi)', () => {
    const rows = buildVacancyRows([{ ...vacancy, requiredAcademicTitle: 'legacy_value' }]);
    expect(rows[0]?.['Talab']).toBe('legacy_value');
  });
});
