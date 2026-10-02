export interface ExcelAoaSheet {
  name: string;
  aoa: Array<Array<string | number>>;
  colWidths?: number[];
}

const safeSheetName = (name: string): string =>
  name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

export async function downloadExcelAoa(
  sheets: ExcelAoaSheet[],
  fileName: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    if (s.colWidths) ws['!cols'] = s.colWidths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(s.name));
  }

  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

export function reportFileName(prefix: string, academicYear?: string): string {
  const d = new Date();
  const stamp = [d.getDate(), d.getMonth() + 1, d.getFullYear()]
    .map((n) => String(n).padStart(2, '0'))
    .join('-');
  const safeYear = academicYear
    ? academicYear.replace(/[\\/:*?"<>|]/g, '-').trim()
    : '';
  return [prefix, safeYear, stamp].filter(Boolean).join('_');
}
