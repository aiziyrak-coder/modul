import * as XLSX from 'xlsx';

export function downloadExcel(
  rows: Array<Record<string, string | number>>,
  fileName: string,
  sheetName = 'Sheet1',
  colWidths?: number[],
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths) ws['!cols'] = colWidths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

export interface ExcelSheet {
  name: string;
  rows: Array<Record<string, string | number>>;
  colWidths?: number[];
}

export function downloadExcelSheets(sheets: ExcelSheet[], fileName: string): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    if (s.colWidths) ws['!cols'] = s.colWidths.map((wch) => ({ wch }));
    const safe = s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safe);
  }
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

export interface ExcelAoaSheet {
  name: string;
  aoa: Array<Array<string | number>>;
  colWidths?: number[];
}

export function downloadExcelAoa(sheets: ExcelAoaSheet[], fileName: string): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    if (s.colWidths) ws['!cols'] = s.colWidths.map((wch) => ({ wch }));
    const safe = s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safe);
  }
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
