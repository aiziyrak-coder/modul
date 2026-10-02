import type { Contract } from '../model/types';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('uz-UZ') : '____.____.____';

export function fillTemplate(body: string, c: Contract): string {
  const studentsList = c.students
    .map((s, i) => `${i + 1}. ${s.fish} (${s.group ?? ''}-guruh)`)
    .join('\n');

  const map: Record<string, string> = {
    raqam: c.number,
    sana: fmtDate(new Date().toISOString()),
    oquv_yili: c.academicYear.title,
    baza: c.organization.title,
    yonalish: c.direction.title,
    kurs: c.course != null ? String(c.course) : '',
    guruh: c.group ?? '',
    viloyat: c.organization.region.title,
    tuman: c.organization.district.title,
    muddat_boshlanish: fmtDate(c.startDate),
    muddat_tugash: fmtDate(c.endDate),
    talabalar_soni: String(c.studentsCount),
    talabalar_royxati: studentsList,
  };

  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => {
    const v = map[key];
    return v !== undefined ? v : m;
  });
}

export function downloadDoc(text: string, number: string): void {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body style="font-family:'Times New Roman',serif;font-size:14px;line-height:1.5;">${safe}</body></html>`;
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shartnoma-${number.replace(/\W+/g, '-')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
