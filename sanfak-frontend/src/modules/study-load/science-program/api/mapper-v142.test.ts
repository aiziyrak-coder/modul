import { describe, expect, it } from 'vitest';
import {
  ASSIGNED_HOURS_KEY_BY_TYPE,
  dedupeScienceOptions,
  mapAssignedHours,
  mapScienceOption,
  mapStaffPerson,
  mapV142Detail,
  mapWorkingPlanStatus,
  parseRefs,
  shortPersonName,
  staffPersonToInput,
  toV142Payload,
  type BackendScienceProgramDetail,
} from './mapper';
import { INDEPENDENT_NOTE_DEFAULT, LITERATURE_GROUP_TITLES } from '../lib/v142-defaults';
import type { ScienceOption } from '../model/types';

const RECORD: BackendScienceProgramDetail = {
  _id: 'sp-142',
  formVersion: 'v142',
  status: 'draft',
  science: { _id: 'sci-1', title: 'Anesteziologiya' },
  directions: [{ _id: 'dir-1', title: 'Davolash ishi' }],
  knowledgeArea: ["500 000 – Sog'liqni saqlash va ijtimoiy ta'minot"],
  educationArea: ["510 000 – Sog'liqni saqlash"],
  language: "O'zbek",
  scienceEssence: {
    sciencePurpose: { desc: 'Maqsad matni' },
    scienceTasks: { desc: 'Vazifa matni' },
  },
  creditRequirements: { title: null, desc: 'Kredit talablari matni' },
  literatureGroups: [
    { slug: 'primary', title: 'Asosiy adabiyotlar', literatures: ['Kitob 1', 'Kitob 2'] },
    { slug: 'additional', title: "Qo'shimcha adabiyotlar", literatures: ['Kitob 3'] },
    { slug: 'information', title: 'Axborot manbalari', literatures: ['https://example.uz'] },
  ],
  v142: {
    educationForm: 'kunduzgi',
    prerequisites: [{ code: '2.07', title: 'Fiziologiya' }],
    outcomes: {
      competencies: [{ code: 'TN1', text: 'Kompetensiya 1' }],
      skills: [{ code: 'TN2', text: "Ko'nikma 1" }],
    },
    topics: [
      { type: 'maruza', code: 'M1', title: 'Anesteziologiya tarixi', hours: 2, refs: [1, 2] },
      { type: 'amaliy', code: 'A1', title: "Og'riqsizlantirish usullari", hours: 6, refs: [] },
      { type: 'maruza', code: 'M2', title: 'Umumiy anesteziya', hours: 4, refs: [3] },
    ],
    independentTasks: [{ order: 1, title: 'Mustaqil ish 1', hours: 12 }],
    techMethods: ["ma'ruzalar", 'interfaol keys-stadilar'],
    grading: { a: ['a-1'], b: ['b-1'], d: ['d-1'], e: ['e-1'] },
    authors: [
      {
        fio: 'Axmadaliyev Sh.Sh.',
        degree: 'PhD',
        title: null,
        department: 'Anesteziologiya',
        position: 'Kafedra mudiri',
      },
    ],
    reviewers: [
      {
        fio: 'Fattoxov N.X.',
        degree: 'DSc',
        title: null,
        department: 'Fakultet va gospital jarrohlik',
        position: 'Kafedra mudiri',
      },
    ],
    councilProtocol: { date: '2026-08-20T00:00:00.000Z', number: '6' },
    departmentProtocol: { date: '2026-08-15T00:00:00.000Z', number: '7' },
  },
};

const SCIENCE: ScienceOption = {
  id: 'sci-1',
  name: 'Anesteziologiya',
  code: '3.07',
  academicYear: 'ay-1',
  semester: '9',
  programExists: false,
  programId: null,
  programStatus: null,
  programCode: null,
  assignedHours: null,
};

describe('mapV142Detail — GET /:id → forma qiymatlari (EDIT)', () => {
  it('top-level maydonlar: science id, language (D-1), sohalar, yo`nalishlar, mazmun', () => {
    const v = mapV142Detail(RECORD);

    expect(v.science).toBe('sci-1');
    expect(v.language).toBe("O'zbek");
    expect(v.knowledgeArea).toEqual(["500 000 – Sog'liqni saqlash va ijtimoiy ta'minot"]);
    expect(v.directions).toEqual(['dir-1']);
    expect(v.sciencePurpose).toBe('Maqsad matni');
    expect(v.creditRequirements).toBe('Kredit talablari matni');
  });

  it('`refs` [1,2] → "1, 2" (forma matni); protokol raqami/sanasi o`qiladi', () => {
    const v = mapV142Detail(RECORD);

    expect(v.topics[0]?.refs).toBe('1, 2');
    expect(v.topics[1]?.refs).toBe('');
    expect(v.councilProtocol).toEqual({ date: '2026-08-20T00:00:00.000Z', number: '6' });
  });

  it('adabiyot guruhlari slug bo`yicha 3 ro`yxatga ajraladi', () => {
    const v = mapV142Detail(RECORD);

    expect(v.primaryLiterature).toEqual(['Kitob 1', 'Kitob 2']);
    expect(v.additionalLiterature).toEqual(['Kitob 3']);
    expect(v.informationSources).toEqual(['https://example.uz']);
  });

  it("`v142` bloki YO'Q (eski hujjat) — bo'sh forma, crash yo'q", () => {
    const v = mapV142Detail({ _id: 'legacy', formVersion: 'v142', language: 'Rus' });

    expect(v.language).toBe('Rus');
    expect(v.educationForm).toBe('kunduzgi');
    expect(v.topics).toHaveLength(1);
    expect(v.authors).toHaveLength(1);
    expect(v.prerequisites).toEqual([]);
  });
});

describe('toV142Payload — forma → POST/PUT body (kontrakt §4.1)', () => {
  it('ROUND-TRIP: GET /:id → forma → payload, `v142` bloki kontrakt bilan bir xil', () => {
    const payload = toV142Payload(mapV142Detail(RECORD), SCIENCE, false, LITERATURE_GROUP_TITLES);

    expect(payload.v142).toEqual({
      educationForm: 'kunduzgi',
      prerequisites: [{ code: '2.07', title: 'Fiziologiya' }],
      outcomes: {
        competencies: [{ code: 'TN1', text: 'Kompetensiya 1' }],
        skills: [{ code: 'TN2', text: "Ko'nikma 1" }],
      },
      topics: [
        { type: 'maruza', code: 'M1', title: 'Anesteziologiya tarixi', hours: 2, refs: [1, 2] },
        { type: 'amaliy', code: 'A1', title: "Og'riqsizlantirish usullari", hours: 6, refs: [] },
        { type: 'maruza', code: 'M2', title: 'Umumiy anesteziya', hours: 4, refs: [3] },
      ],
      independentTasks: [{ order: 1, title: 'Mustaqil ish 1', hours: 12 }],
      independentNote: INDEPENDENT_NOTE_DEFAULT,
      techMethods: ["ma'ruzalar", 'interfaol keys-stadilar'],
      grading: { a: ['a-1'], b: ['b-1'], d: ['d-1'], e: ['e-1'] },
      authors: [
        {
          fio: 'Axmadaliyev Sh.Sh.',
          degree: 'PhD',
          title: null,
          department: 'Anesteziologiya',
          position: 'Kafedra mudiri',
        },
      ],
      reviewers: [
        {
          fio: 'Fattoxov N.X.',
          degree: 'DSc',
          title: null,
          department: 'Fakultet va gospital jarrohlik',
          position: 'Kafedra mudiri',
        },
      ],
      councilProtocol: { date: '2026-08-20', number: '6' },
      departmentProtocol: { date: '2026-08-15', number: '7' },
    });
  });

  it('top-level kalitlar — aynan kontrakt to`plami, `language` v142 ICHIDA EMAS (D-1)', () => {
    const payload = toV142Payload(mapV142Detail(RECORD), SCIENCE, true, LITERATURE_GROUP_TITLES);

    expect(Object.keys(payload).sort()).toEqual(
      [
        'academicYear',
        'creditRequirements',
        'directions',
        'educationArea',
        'formVersion',
        'knowledgeArea',
        'language',
        'literatureGroups',
        'science',
        'scienceTasks',
        'sciencePurpose',
        'semester',
        'v142',
      ].sort(),
    );
    expect(payload.language).toBe("O'zbek");
    expect('language' in payload.v142).toBe(false);
    expect(payload.academicYear).toBe('ay-1');
    expect(payload.semester).toBe('9');
    expect(payload.sciencePurpose).toEqual({ desc: 'Maqsad matni' });
    expect(payload.creditRequirements).toEqual({ desc: 'Kredit talablari matni' });
  });

  it("`formVersion: 'v142'` FAQAT create'da; PUT body'da YO'Q (Joi forbidden qulfi)", () => {
    const values = mapV142Detail(RECORD);

    expect(toV142Payload(values, SCIENCE, true, LITERATURE_GROUP_TITLES).formVersion).toBe('v142');
    expect('formVersion' in toV142Payload(values, SCIENCE, false, LITERATURE_GROUP_TITLES)).toBe(
      false,
    );
  });

  it('literatureGroups — 3 guruh, slug tartibi primary/additional/information, hujjat sarlavhalari', () => {
    const payload = toV142Payload(mapV142Detail(RECORD), SCIENCE, false, LITERATURE_GROUP_TITLES);

    expect(payload.literatureGroups).toEqual([
      { slug: 'primary', title: 'Asosiy adabiyotlar', literatures: ['Kitob 1', 'Kitob 2'] },
      { slug: 'additional', title: "Qo'shimcha adabiyotlar", literatures: ['Kitob 3'] },
      { slug: 'information', title: 'Axborot manbalari', literatures: ['https://example.uz'] },
    ]);
  });

  it('kodlar HOSILA (D-11): tur o`zgarsa payload qayta raqamlaydi, TN uzluksiz davom etadi', () => {
    const values = mapV142Detail(RECORD);
    values.topics[1] = { ...values.topics[1]!, type: 'maruza' };
    values.competencies.push({ code: '', text: 'Kompetensiya 2' });

    const payload = toV142Payload(values, SCIENCE, false, LITERATURE_GROUP_TITLES);

    expect(payload.v142.topics.map((t) => t.code)).toEqual(['M1', 'M2', 'M3']);
    expect(payload.v142.outcomes.competencies.map((c) => c.code)).toEqual(['TN1', 'TN2']);
    expect(payload.v142.outcomes.skills.map((c) => c.code)).toEqual(['TN3']);
  });

  it("bo'sh qatorlar payloadga kirmaydi: turi/nomi bo'sh mavzu, F.I.O'siz shaxs, bo'sh band", () => {
    const values = mapV142Detail(RECORD);
    values.topics.push({ type: '', code: '', title: 'Turi yo`q', hours: 2, refs: '' });
    values.topics.push({ type: 'seminar', code: '', title: '   ', hours: 2, refs: '' });
    values.authors.push({ fio: '  ', degree: 'PhD', title: '', department: '', position: '' });
    values.techMethods.push('', '  ');

    const payload = toV142Payload(values, SCIENCE, false, LITERATURE_GROUP_TITLES);

    expect(payload.v142.topics).toHaveLength(3);
    expect(payload.v142.authors).toHaveLength(1);
    expect(payload.v142.techMethods).toEqual(["ma'ruzalar", 'interfaol keys-stadilar']);
  });

  it("protokol raqami bo'sh bo'lsa `null`, sana bo'lmasa `null` (Joi allow(null))", () => {
    const values = mapV142Detail(RECORD);
    values.councilProtocol = { date: null, number: '' };

    const payload = toV142Payload(values, SCIENCE, false, LITERATURE_GROUP_TITLES);

    expect(payload.v142.councilProtocol).toEqual({ date: null, number: null });
  });

  it('D-22: DateField qiymati (mahalliy yarim tun) — aynan tanlangan kun ketadi', () => {
    const values = mapV142Detail(RECORD);
    values.councilProtocol = { date: new Date(2026, 8, 25).toISOString(), number: '6' };
    values.departmentProtocol = { date: new Date(2026, 0, 1).toISOString(), number: '7' };

    const payload = toV142Payload(values, SCIENCE, false, LITERATURE_GROUP_TITLES);

    expect(payload.v142.councilProtocol.date).toBe('2026-09-25');
    expect(payload.v142.departmentProtocol.date).toBe('2026-01-01');
  });

  it('D-22: allaqachon `YYYY-MM-DD` bo`lsa o`zgarishsiz, yaroqsiz sana — `null`', () => {
    const values = mapV142Detail(RECORD);
    values.councilProtocol = { date: '2026-09-25', number: '6' };
    values.departmentProtocol = { date: 'sana emas', number: '7' };

    const payload = toV142Payload(values, SCIENCE, false, LITERATURE_GROUP_TITLES);

    expect(payload.v142.councilProtocol.date).toBe('2026-09-25');
    expect(payload.v142.departmentProtocol.date).toBeNull();
  });
});

describe('parseRefs — "1, 2" ↔ [1,2]', () => {
  it('vergul/nuqta-vergul/bo`shliq ajratgichlari, takror va noraqam tashlanadi, 0 va manfiy yo`q', () => {
    expect(parseRefs('1, 2')).toEqual([1, 2]);
    expect(parseRefs('3;1 2,2 abc 0 -4')).toEqual([3, 1, 2]);
    expect(parseRefs('')).toEqual([]);
    expect(parseRefs(null)).toEqual([]);
  });
});

describe("mapAssignedHours — `hoursByType` YORLIQ xaritasi (seam tuzog'i qulfi, §4.2)", () => {
  it("xarita: seminar kaliti → AMALIY, practical kaliti → KLINIK AMALIYOT, haqiqiy seminar → manba yo'q", () => {
    expect(ASSIGNED_HOURS_KEY_BY_TYPE).toEqual({
      maruza: 'lecture',
      amaliy: 'seminar',
      seminar: null,
      laboratoriya: 'laboratory',
      klinik_amaliyot: 'practical',
    });
  });

  it('kontrakt misoli: {lecture:10, seminar:20, laboratory:0, practical:24, independent:54}, total 108', () => {
    const hours = mapAssignedHours(
      { lecture: 10, seminar: 20, laboratory: 0, practical: 24, independent: 54 },
      108,
    );

    expect(hours).toEqual({
      byType: { maruza: 10, amaliy: 20, seminar: null, laboratoriya: 0, klinik_amaliyot: 24 },
      independent: 54,
      total: 108,
    });
  });

  it("`hoursByType` yo'q (eski backend) → null; `mapScienceOption` ham shu qulf bilan", () => {
    expect(mapAssignedHours(undefined, 108)).toBeNull();
    expect(mapScienceOption({ science: 'sci-1' }).assignedHours).toBeNull();
    expect(
      mapScienceOption({ science: 'sci-1', hoursByType: { seminar: 20 }, totalHour: 20 })
        .assignedHours?.byType.amaliy,
    ).toBe(20);
  });
});

describe('dedupeScienceOptions — bir fan = bitta qator', () => {
  const row = (semester: number, lecture: number, seminar: number, total: number) =>
    mapScienceOption({
      science: 'sci-1',
      scienceName: 'Odam anatomiyasi 1,2,3',
      scienceCode: 'AN112312',
      academicYear: 'ay-1',
      semester,
      totalHour: total,
      hoursByType: { lecture, seminar, laboratory: 0, practical: 0, independent: 30 },
      programExists: false,
    });

  it("bir xil `science` — bitta qator, semestrlar «1, 2», soatlar YIG'ILADI", () => {
    const merged = dedupeScienceOptions([row(2, 6, 24, 60), row(1, 6, 24, 64)]);
    expect(merged).toHaveLength(1);
    const only = merged[0]!;
    expect(only.id).toBe('sci-1');
    expect(only.semester).toBe('1, 2');
    expect(only.assignedHours?.byType.maruza).toBe(12);
    expect(only.assignedHours?.byType.amaliy).toBe(48);
    expect(only.assignedHours?.independent).toBe(60);
    expect(only.assignedHours?.total).toBe(124);
  });

  it('boshqa fanlar alohida qoladi; `programExists` bittasida bo`lsa — bor', () => {
    const a = row(1, 6, 24, 60);
    const b = { ...row(2, 6, 24, 60), programExists: true, programId: 'sp-9' };
    const other = { ...row(1, 2, 2, 4), id: 'sci-2', name: 'Boshqa fan' };
    const merged = dedupeScienceOptions([a, b, other]);
    expect(merged.map((m) => m.id)).toEqual(['sci-1', 'sci-2']);
    expect(merged[0]!.programExists).toBe(true);
    expect(merged[0]!.programId).toBe('sp-9');
    expect(merged[1]!.semester).toBe('1');
  });

  it("soatlar bo'lmagan qator (eski backend) yig'indini buzmaydi", () => {
    const withHours = row(1, 6, 24, 60);
    const noHours = { ...row(2, 0, 0, 0), assignedHours: null };
    const only = dedupeScienceOptions([noHours, withHours])[0]!;
    expect(only.assignedHours?.byType.maruza).toBe(6);
    expect(only.semester).toBe('1, 2');
  });
});

describe('mapWorkingPlanStatus — `planHours` additiv, mavjud ikki kalit o`zgarmaydi (§4.3)', () => {
  it('jonli javob: items + meta; 0 qiymatli tur «rejada 0» sifatida qoladi', () => {
    const s = mapWorkingPlanStatus({
      hasWorkingPlan: true,
      warning: null,
      planHours: {
        items: [
          { slug: 'maruza', title: "Ma'ruza", value: 12 },
          { slug: 'amaliy', title: 'Amaliy', value: 48 },
          { slug: 'seminar', title: 'Seminar', value: 0 },
          { slug: 'laboratoriya', title: 'Laboratoriya', value: 0 },
        ],
        classroomHours: 60,
        independentHours: 60,
        totalHours: 120,
        credits: 4,
        weeklyHours: 4,
        semester: '1',
        code: 'AN112312',
        serialNumber: '1.10',
        moduleType: 'Majburiy',
        warnings: [],
      },
    });

    expect(s.hasWorkingPlan).toBe(true);
    expect(s.warning).toBeNull();
    expect(s.planHours?.items).toHaveLength(4);
    expect(s.planHours?.items[2]).toEqual({ slug: 'seminar', title: 'Seminar', value: 0 });
    expect(s.planHours?.totalHours).toBe(120);
    expect(s.planHours?.semester).toBe('1');
    expect(s.planHours?.clinicalUnknown).toBe(false);
  });

  it("reja yo'q: `planHours: null` → null, `warning` matni bayt-bayt saqlanadi (T-21)", () => {
    const s = mapWorkingPlanStatus({
      hasWorkingPlan: false,
      warning: 'Tasdiqlangan ishchi reja topilmadi',
      planHours: null,
    });

    expect(s).toEqual({
      hasWorkingPlan: false,
      warning: 'Tasdiqlangan ishchi reja topilmadi',
      planHours: null,
    });
  });

  it("eski backend (`planHours` maydoni umuman yo'q) → null, crash yo'q", () => {
    expect(mapWorkingPlanStatus({ hasWorkingPlan: true, warning: null }).planHours).toBeNull();
    expect(mapWorkingPlanStatus(undefined).hasWorkingPlan).toBe(false);
  });
});

describe('mapStaffPerson / shortPersonName — xodim → PersonInput', () => {
  it('«Familiya I.O.» qisqartma, daraja/unvon enum → hujjat matni, kafedra/lavozim nomi', () => {
    const p = mapStaffPerson({
      _id: 'tp-1',
      user: { _id: 'u-1', firstName: 'Ibrohim', lastName: 'Qodirjonov', middleName: 'Jabborovich' },
      department: { _id: 'd-1', title: 'Gigiyena va ekologiya kafedrasi' },
      position: { _id: 'p-1', title: 'Professor' },
      academicDegree: 'fan_doktori',
      academicTitle: 'professor',
    });
    expect(p).toEqual({
      id: 'u-1',
      fio: 'Qodirjonov I.J.',
      fullName: 'Qodirjonov Ibrohim Jabborovich',
      degree: 'DSc',
      title: 'professor',
      department: 'Gigiyena va ekologiya kafedrasi',
      position: 'Professor',
    });
    expect(staffPersonToInput(p!)).toEqual({
      fio: 'Qodirjonov I.J.',
      degree: 'DSc',
      title: 'professor',
      department: 'Gigiyena va ekologiya kafedrasi',
      position: 'Professor',
    });
  });

  it("otasining ismi yo'q, daraja/unvon null, ref string (populate yo'q) → bo'sh matn", () => {
    const p = mapStaffPerson({
      _id: 'tp-2',
      user: { _id: 'u-2', firstName: 'Aziz', lastName: "G'ofurov", middleName: null },
      department: 'd-9',
      position: null,
      academicDegree: null,
      academicTitle: null,
    });
    expect(p?.fio).toBe("G'ofurov A.");
    expect(p?.degree).toBe('');
    expect(p?.title).toBe('');
    expect(p?.department).toBe('');
    expect(p?.position).toBe('');
  });

  it('`user`i yo`q profil → null (select`ga kirmaydi)', () => {
    expect(mapStaffPerson({ _id: 'tp-3', user: null })).toBeNull();
    expect(shortPersonName('Axmadaliyev', 'Shoxrux', 'Shuxratovich')).toBe('Axmadaliyev S.S.');
  });
});

describe('independentNote — §6 izohi tahrirlanadi (egasi 2026-09-16)', () => {
  it("hujjatda `null` → formada default shablon matni; tahrirlangan matn payload'ga o'tadi", () => {
    const v = mapV142Detail({ _id: 'x', formVersion: 'v142', v142: { independentNote: null } });
    expect(v.independentNote).toBe(INDEPENDENT_NOTE_DEFAULT);
    const edited = { ...v, independentNote: '*Izoh: kafedra qoidasi bo`yicha.' };
    expect(toV142Payload(edited, SCIENCE, true, LITERATURE_GROUP_TITLES).v142.independentNote).toBe(
      '*Izoh: kafedra qoidasi bo`yicha.',
    );
  });
  it("bo'sh qoldirilsa payload'da `null` (PDF shablon matnini chizadi)", () => {
    const v = { ...mapV142Detail(RECORD), independentNote: '   ' };
    expect(toV142Payload(v, SCIENCE, false, LITERATURE_GROUP_TITLES).v142.independentNote).toBeNull();
  });
});
