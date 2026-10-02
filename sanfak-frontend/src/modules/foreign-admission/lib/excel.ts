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
  XLSX.utils.book_append_sheet(wb, ws, sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

export function downloadExcelSheets(
  sheets: Array<{
    name: string;
    rows: Array<Record<string, string | number>>;
    colWidths?: number[];
  }>,
  fileName: string,
): void {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    if (s.colWidths) ws['!cols'] = s.colWidths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  });
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
