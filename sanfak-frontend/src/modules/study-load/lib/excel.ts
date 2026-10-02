import * as XLSX from 'xlsx';
import { getStatusMeta } from '../model/status-workflow';
import type { WorkingSchedule } from '../working-schedule/model/types';
import type { Contingent } from '../contingent/model/types';
import type { Vacancy } from '../distribution/model/types';
import type { Workload } from '../workload/model/types';

interface ColWidth {
  wch: number;
}

function buildAndDownloadWorkbook(
  rows: Record<string, string | number>[],
  sheetName: string,
  fileName: string,
  colWidths?: ColWidth[],
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths) {
    ws['!cols'] = colWidths;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

const WORKING_SCHEDULE_COL_WIDTHS: ColWidth[] = [
  { wch: 5 },
  { wch: 40 },
  { wch: 30 },
  { wch: 10 },
  { wch: 15 },
  { wch: 16 },
  { wch: 18 },
];

export function buildWorkingScheduleRows(items: WorkingSchedule[]) {
  return items.map((item, idx) => ({
    '#': idx + 1,
    Nomi: item.title ?? '—',
    "Yo'nalish": item.directionTitle ?? '—',
    Kurs: item.courseTitle ?? item.stage ?? '—',
    "O'quv yili": item.academicYearTitle ?? '—',
    'Yuklangan sana': item.date
      ? new Date(item.date).toLocaleDateString('uz-UZ')
      : item.createdAt
        ? new Date(item.createdAt).toLocaleDateString('uz-UZ')
        : '—',
    Status: getStatusMeta(item.status).label,
  }));
}

export function exportWorkingSchedulesToExcel(
  items: WorkingSchedule[],
  fileName = 'Ishchi_oquv_reja.xlsx',
): void {
  buildAndDownloadWorkbook(
    buildWorkingScheduleRows(items),
    "Ishchi o'quv reja",
    fileName,
    WORKING_SCHEDULE_COL_WIDTHS,
  );
}

const CONTINGENT_COL_WIDTHS: ColWidth[] = [
  { wch: 5 },
  { wch: 30 },
  { wch: 30 },
  { wch: 10 },
  { wch: 15 },
  { wch: 15 },
  { wch: 15 },
];

export function buildContingentRows(items: Contingent[]) {
  return items.map((item, idx) => ({
    '#': idx + 1,
    'Guruh nomi': item.title,
    "Yo'nalish": item.directionTitle ?? '—',
    Kurs: item.courseTitle ?? '—',
    "O'quv yili": item.academicYearTitle ?? '—',
    'Talabalar soni': item.studentNumber,
    "Ta'lim tili": item.langTitle ?? '—',
  }));
}

export function exportContingentsToExcel(
  items: Contingent[],
  fileName = 'Kontingent.xlsx',
): void {
  buildAndDownloadWorkbook(
    buildContingentRows(items),
    'Kontingent',
    fileName,
    CONTINGENT_COL_WIDTHS,
  );
}

export interface DistributionExcelRow {
  title: string | null;
  course: number | null;
  scienceNumber: number;
  totalHour: number;
  residueHour: number;
  academicYearTitle: string | null;
  date: string | null;
  status: string;
}

const DISTRIBUTION_COL_WIDTHS: ColWidth[] = [
  { wch: 5 },
  { wch: 35 },
  { wch: 10 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 15 },
  { wch: 14 },
  { wch: 18 },
];

export function buildDistributionRows(items: DistributionExcelRow[]) {
  return items.map((item, idx) => ({
    '#': idx + 1,
    Nomi: item.title ?? '—',
    Kurs: item.course != null && item.course > 0 ? `${item.course}-kurs` : '—',
    'Fanlar soni': item.scienceNumber,
    'Jami soat': item.totalHour,
    'Qoldiq soat': item.residueHour,
    "O'quv yili": item.academicYearTitle ?? '—',
    Sana: item.date ?? '—',
    Status: getStatusMeta(item.status).label,
  }));
}

export function exportDistributionsToExcel(
  items: DistributionExcelRow[],
  fileName = 'Taqsimot.xlsx',
): void {
  buildAndDownloadWorkbook(
    buildDistributionRows(items),
    'Taqsimot',
    fileName,
    DISTRIBUTION_COL_WIDTHS,
  );
}

const WORKLOAD_COL_WIDTHS: ColWidth[] = [
  { wch: 5 },
  { wch: 34 },
  { wch: 14 },
  { wch: 12 },
  { wch: 15 },
  { wch: 16 },
  { wch: 18 },
];

export function buildWorkloadRows(items: Workload[]) {
  return items.map((item, idx) => ({
    '#': idx + 1,
    Kafedra: item.departmentTitle ?? '—',
    'Fanlar soni': item.totalLectures,
    'Jami soat': item.totalHours,
    "O'quv yili": item.academicYearTitle ?? '—',
    Sana: item.date ?? '—',
    Status: getStatusMeta(item.status).label,
  }));
}

export function exportWorkloadsToExcel(
  items: Workload[],
  fileName = 'Yuklamalar.xlsx',
): void {
  buildAndDownloadWorkbook(
    buildWorkloadRows(items),
    'Yuklamalar',
    fileName,
    WORKLOAD_COL_WIDTHS,
  );
}

const VACANCY_COL_WIDTHS: ColWidth[] = [
  { wch: 5 },
  { wch: 16 },
  { wch: 28 },
  { wch: 30 },
  { wch: 10 },
  { wch: 40 },
  { wch: 12 },
  { wch: 28 },
  { wch: 14 },
];

const ACADEMIC_TITLE_LABELS: Record<string, string> = {
  phd: 'PhD',
  docent: 'Dotsent',
  professor: 'Professor',
};

function vacancyRequirementLabel(item: Vacancy): string {
  const academicTitle = item.requiredAcademicTitle
    ? (ACADEMIC_TITLE_LABELS[item.requiredAcademicTitle] ?? item.requiredAcademicTitle)
    : null;
  return (
    [item.requiredSpecialization, item.requiredPosition, academicTitle].filter(Boolean).join(', ') ||
    '—'
  );
}

export function buildVacancyRows(items: Vacancy[]) {
  return items.map((item, idx) => ({
    '#': idx + 1,
    'Vakant nomi':
      item.vacantLabel ?? (item.vacancyNumber != null ? `Vakant-${item.vacancyNumber}` : '—'),
    Kafedra: item.department?.title ?? '—',
    Taqsimot: item.distributionTitle ?? '—',
    Kurs: item.course > 0 ? `${item.course}-kurs` : '—',
    Fanlar: item.blocks.map((b) => b.scienceTitle ?? '—').join(', ') || '—',
    'Jami soat': item.totalHour,
    Talab: vacancyRequirementLabel(item),
    Muddat: item.deadline ? new Date(item.deadline).toLocaleDateString('uz-UZ') : '—',
  }));
}

export function exportVacanciesToExcel(
  items: Vacancy[],
  fileName = 'Vakant_yuklamalar.xlsx',
): void {
  buildAndDownloadWorkbook(buildVacancyRows(items), 'Vakant yuklamalar', fileName, VACANCY_COL_WIDTHS);
}
