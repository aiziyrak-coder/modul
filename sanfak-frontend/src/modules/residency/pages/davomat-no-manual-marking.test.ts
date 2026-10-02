import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const HERE = __dirname;
const MODULE_ROOT = resolve(HERE, '..');

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const read = (rel: string): string => readFileSync(join(HERE, rel), 'utf8');

const DAVOMAT = code(read('Davomat.tsx'));
const RESIDENCY_API = code(read('../api/residency-api.ts'));
const SESSION_API = read('../api/session-api.ts');

const SOURCES = (readdirSync(MODULE_ROOT, { recursive: true }) as unknown as string[])
  .map(String)
  .filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.(ts|tsx)$/.test(p) && !/fixtures/.test(p))
  .map((p) => ({ file: p, src: code(readFileSync(resolve(MODULE_ROOT, p), 'utf8')) }));

const MANUAL_ATT_POST = new RegExp(
  String.raw`\b(?:postJson|apiClient\s*\.\s*post)\s*(?:<[^>()]*>)?\s*\(\s*` +
    String.raw`(?:ATT\b|[\x60'"](?:\/attendance|\$\{ATT\})\/?[\x60'"?])`,
);

const ATT_URL_LITERAL = /[\x60'"](?:[\w.:${}-]*\/)*attendance(?=[\x60'"/?$])/;

const GENERIC = String.raw`(?:<(?:[^<>()]|<[^<>()]*>)*>)?`;
const ATT_ALLOWED: readonly RegExp[] = [
  /^const ATT = '\/attendance';$/gm,
  new RegExp(
    String.raw`\b(?:paginate|fetchList|fetchOne)\s*${GENERIC}\s*\(\s*(?:ATT\b|\x60\$\{ATT\})`,
    'g',
  ),
  /\bputJson\s*\(\s*\x60\$\{ATT\}\/\$\{/g,
];
const strayAttUses = (src: string): string[] => {
  const rest = ATT_ALLOWED.reduce((s, re) => s.replace(re, ''), src);
  return [...rest.matchAll(/.{0,40}\bATT\b.{0,40}/g)].map((m) => m[0].trim());
};

describe('D-R2 — Jurnal (Davomat) davomatni yozmaydi', () => {
  it.each([
    /useCreateAttendance/,
    /useUpdateAttendance/,
    /mutateAsync/,
    /\.mutate\s*\(/,
    /useMutation/,
    /AddLessonModal/,
    /\bNewLesson\b/,
    /handleCreate/,
    /Dars qo‘shish/,
  ])('Davomat.tsx da %s yo‘q', (re) => {
    expect(DAVOMAT).not.toMatch(re);
  });

  it('Davomat.tsx da HTTP yozuvchi (apiClient/axios/postJson/putJson/…) umuman yo‘q', () => {
    expect(DAVOMAT).not.toMatch(
      /\b(?:apiClient|axios|postJson|putJson|patchJson|deleteData|uploadMultipart)\b/,
    );
  });

  it('tasdiq kalitlari va qo‘lda tasdiq katagi yo‘q (D-PRE)', () => {
    expect(DAVOMAT).not.toMatch(/manualVerified|samsVerified/);
    expect(DAVOMAT).not.toMatch(/qo[‘']lda tasdiqlayman/);
  });

  it('«Keldi» tanlagichi yo‘q', () => {
    expect(DAVOMAT).not.toMatch(/value\s*[:=]\s*\{?\s*['"`]present['"`]/);
    expect(DAVOMAT).not.toMatch(/label\s*:\s*['"`]Keldi['"`]/);
    expect(DAVOMAT).not.toMatch(
      /label\s*:\s*STATUS_LABEL(?:\.present|\[\s*['"`]present['"`]\s*\])/,
    );
  });

  it('tugma «Mashg‘ulot e’lon qilish» e’lon oynasini ochadi, ro‘yxat — «Mashg‘ulotlar» tabi', () => {
    expect(DAVOMAT).toMatch(/Mashg‘ulot e’lon qilish/);
    expect(DAVOMAT).toMatch(/<AnnounceModal\b/);
    expect(DAVOMAT).toMatch(/<SessionList\s*\/>/);
    expect(DAVOMAT).not.toMatch(/navigate\('\/residency\/mashgulotlar'\)/);
  });
});

describe('D-R2 — API qatlamida qo‘lda davomat yozuvchisi yo‘q', () => {
  it('residency-api `useCreateAttendance` ni eksport qilmaydi, POST /attendance yo‘q', () => {
    expect(RESIDENCY_API).not.toMatch(/useCreateAttendance/);
    expect(RESIDENCY_API).not.toMatch(/postJson\(\s*ATT\b/);
  });

  it('modulning hech bir manba faylida `useCreateAttendance` yo‘q', () => {
    expect(SOURCES.some((x) => x.file.endsWith('Davomat.tsx'))).toBe(true);
    const offenders = SOURCES.filter((x) => /useCreateAttendance/.test(x.src)).map((x) => x.file);
    expect(offenders).toEqual([]);
  });

  it('🔴 modulning hech bir manba faylida POST /attendance yo‘q (hook nomidan qat’i nazar)', () => {
    const offenders = SOURCES.filter((x) => MANUAL_ATT_POST.test(x.src)).map((x) => x.file);
    expect(offenders).toEqual([]);
  });

  it('`useUpdateAttendance` faqat api qatlamida — UI iste’molchisi yo‘q', () => {
    expect(SOURCES.some((x) => /^api[\\/]residency-api\.ts$/.test(x.file))).toBe(true);
    const offenders = SOURCES.filter(
      (x) => !/^api[\\/]/.test(x.file) && /useUpdateAttendance/.test(x.src),
    ).map((x) => x.file);
    expect(offenders).toEqual([]);
  });

  it('`useApproveExcuse`/`useExcuseAbsence` faqat api/ va components/AttendanceExcuse/ da', () => {
    expect(SOURCES.some((x) => /^api[\\/]attendance-excuse-api\.ts$/.test(x.file))).toBe(true);
    expect(
      SOURCES.some((x) =>
        /^components[\\/]AttendanceExcuse[\\/]ExcuseAbsenceModal\.tsx$/.test(x.file),
      ),
    ).toBe(true);
    const offenders = SOURCES.filter(
      (x) =>
        !/^(?:api|components[\\/]AttendanceExcuse)[\\/]/.test(x.file) &&
        /\buse(?:ApproveExcuse|ExcuseAbsence)\b/.test(x.src),
    ).map((x) => x.file);
    expect(offenders).toEqual([]);
  });

  it('«Sababli qilish» tugmasi (`AttendanceExcuse/index.tsx`) api modulini import qilmaydi', () => {
    const button = SOURCES.find((x) =>
      /^components[\\/]AttendanceExcuse[\\/]index\.tsx$/.test(x.file),
    );
    expect(button, 'AttendanceExcuse/index.tsx topilmadi — skaner eskirgan').toBeDefined();
    const runtimeImports = [
      ...(button?.src ?? '').matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm),
    ].map((m) => m[1]);
    expect(runtimeImports).toContain('./ExcuseAbsenceModal');
    expect(runtimeImports.filter((p) => /(?:^|\/)api\//.test(p ?? ''))).toEqual([]);
  });

  it.each([
    "postJson('/attendance', a)",
    'postJson(ATT, toAttendancePayload(a))',
    'postJson<BackendAttendance>(ATT, a)',
    "apiClient.post('/attendance', { status: 'absent' })",
    'apiClient\n  .post(`${ATT}`, body)',
    'postJson("/attendance/", a)',
  ])('skaner ushlaydi: %s', (sample) => {
    expect(sample).toMatch(MANUAL_ATT_POST);
  });

  it.each([
    'putJson(`${ATT}/${id}`, toAttendancePayload(data))',
    'postJson(`${ASM}/grade`, toGradePayload(a))',
    "postJson('/residency-sessions', body)",
    'apiClient.post(ATT_KEY, x)',
    "postJson('/attendance-context', a)",
  ])('skaner qonuniy chaqiruvni ushlamaydi: %s', (sample) => {
    expect(sample).not.toMatch(MANUAL_ATT_POST);
  });

  it('🔴 davomat URL literali FAQAT api/residency-api.ts da', () => {
    const holders = SOURCES.filter((x) => ATT_URL_LITERAL.test(x.src)).map((x) =>
      x.file.split('\\').join('/'),
    );
    expect(holders).toEqual(['api/residency-api.ts']);
  });

  it('🔴 residency-api.ts da `ATT` faqat o‘qish va mavjud yozuv PUT i uchun (eksport yo‘q)', () => {
    expect(RESIDENCY_API).toMatch(/^const ATT = '\/attendance';$/m);
    expect(strayAttUses(RESIDENCY_API)).toEqual([]);
  });

  it.each([
    "const ROOT = '/attendance';",
    'const ATTENDANCE_URL = "/api/attendance";',
    'apiClient.request({ method: "post", url: `/attendance` })',
    "send('attendance', a)",
    'postJson(`${BASE}/attendance/`, a)',
  ])('URL literali ushlanadi: %s', (sample) => {
    expect(sample).toMatch(ATT_URL_LITERAL);
  });

  it.each(["'residency-attendance'", "'/attendance-context'", '`${ATT}/${id}`'])(
    'URL literali emas: %s',
    (sample) => {
      expect(sample).not.toMatch(ATT_URL_LITERAL);
    },
  );

  it.each([
    'postJson(ATT, a)',
    "apiClient.request({ method: 'post', url: ATT, data: a })",
    'const ROOT = ATT;',
    'export { ATT };',
    "export const ATT = '/attendance';",
    'send(`${ATT}`, a)',
    'putJson(ATT, a)',
  ])('`ATT` qoidabuzar ishlatilishi ushlanadi: %s', (sample) => {
    expect(strayAttUses(sample)).not.toEqual([]);
  });

  it.each([
    "const ATT = '/attendance';\nconst f = () => paginate<A, B>(ATT, params, map);",
    'fetchOne<BackendPaged<Row>>(\n  `${ATT}/stats/by-resident${qs(p)}`,\n)',
    'fetchList<BackendAttendance>(`${ATT}/resident/${residentId}`)',
    'putJson(`${ATT}/${id}/approve-excuse`, body)',
    "queryKey: [ATT_KEY, 'paginate']",
  ])('`ATT` ning ruxsat etilgan ishlatilishi: %s', (sample) => {
    expect(strayAttUses(sample)).toEqual([]);
  });

  it('e’lon tanasi — aynan 5 kalit; holat, ball, tasdiq va vaqt yo‘q', () => {
    const body = /export const toAnnouncePayload[\s\S]*?\n\}\);/.exec(SESSION_API)?.[0];
    expect(body, 'toAnnouncePayload topilmadi — regex eskirgan').toBeDefined();
    const keys = [...(body ?? '').matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]).sort();
    expect(keys).toEqual(['day', 'group', 'hours', 'lessonType', 'science']);
    expect(body).not.toMatch(
      /status|score|manualVerified|samsVerified|checkInTime|checkOutTime|\bdate\b/,
    );
  });
});
