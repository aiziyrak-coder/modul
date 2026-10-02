export const SAMPLE_TXT = [
  "Malaka oshirish kursi necha soatdan iborat?",
  "+72 soat",
  "-36 soat",
  "-144 soat",
  "",
  "Kirish testidan o'tish uchun minimal foiz qancha?",
  "+60%",
  "-50%",
  "-70%",
  "",
  "Quyidagilardan qaysilari onlayn kurs shakliga tegishli? (bir nechta to'g'ri javob)",
  "+Video ma'ruzalar",
  "+Elektron manbalar",
  "-Auditoriyada davomat",
].join('\r\n');

const BOM = String.fromCharCode(0xfeff);

export function downloadSampleTxt(fileName: string) {
  const blob = new Blob([BOM + SAMPLE_TXT], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
