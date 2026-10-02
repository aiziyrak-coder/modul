import * as XLSX from 'xlsx';

export function exportToExcel(
  rows: Record<string, unknown>[],
  fileName: string,
  sheetName = 'Hisobot',
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
