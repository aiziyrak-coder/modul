import * as XLSX from 'xlsx';

export type ExcelCell = string | number;
export type ExcelRow = Record<string, ExcelCell>;

export function downloadExcel(
  rows: ExcelRow[],
  fileName: string,
  sheetName = 'Sheet1',
  colWidths?: number[],
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths) ws['!cols'] = colWidths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));
  XLSX.writeFile(wb, withExt(fileName));
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1';
}

function withExt(fileName: string): string {
  return fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
}

export function datedFileName(base: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${base}_${stamp}.xlsx`;
}
