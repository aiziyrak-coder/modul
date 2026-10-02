import type {
  Contract,
  ContractTemplate,
  DistrictRef,
  EriKey,
  NotificationItem,
  PracticeBase,
  PracticeStudent,
  RefItem,
} from '../model/types';

const r = (id: string, title: string): RefItem => ({ id, title });

const otTB = r('ot1', 'Tibbiyot birlashmasi');
const otSEM = r('ot2', 'Sanitariya-epidemiologik osoyishtalik markazi');
const otClinic = r('ot3', "Ko'p tarmoqli klinika");
const otTuman = r('ot4', 'Tuman markaziy shifoxonasi');
const otSpecial = r('ot5', 'Ixtisoslashtirilgan markaz');
export const ORG_TYPES: RefItem[] = [otTB, otSEM, otClinic, otTuman, otSpecial];

const rgTashkent = r('rg1', 'Toshkent shahri');
const rgFargona = r('rg2', "Farg'ona viloyati");
const rgAndijon = r('rg3', 'Andijon viloyati');
const rgNamangan = r('rg4', 'Namangan viloyati');
const rgSamarqand = r('rg5', 'Samarqand viloyati');
export const REGIONS: RefItem[] = [rgTashkent, rgFargona, rgAndijon, rgNamangan, rgSamarqand];

const ds = (id: string, title: string, region: RefItem): DistrictRef => ({ id, title, region });
const dsChilonzor = ds('ds1', 'Chilonzor tumani', rgTashkent);
const dsYunusobod = ds('ds2', 'Yunusobod tumani', rgTashkent);
const dsFargonaSh = ds('ds3', "Farg'ona shahri", rgFargona);
const dsMargilon = ds('ds4', "Marg'ilon shahri", rgFargona);
const dsQuvasoy = ds('ds5', 'Quvasoy shahri', rgFargona);
const dsAndijonSh = ds('ds6', 'Andijon shahri', rgAndijon);
const dsAsaka = ds('ds7', 'Asaka tumani', rgAndijon);
const dsNamanganSh = ds('ds8', 'Namangan shahri', rgNamangan);
const dsSamarqandSh = ds('ds9', 'Samarqand shahri', rgSamarqand);
export const DISTRICTS: DistrictRef[] = [
  dsChilonzor,
  dsYunusobod,
  dsFargonaSh,
  dsMargilon,
  dsQuvasoy,
  dsAndijonSh,
  dsAsaka,
  dsNamanganSh,
  dsSamarqandSh,
];

const drDavolash = r('dr1', 'Davolash ishi');
const drStom = r('dr2', 'Stomatologiya');
const drPediatr = r('dr3', 'Pediatriya');
const drProfil = r('dr4', 'Tibbiy profilaktika');
const drFarm = r('dr5', 'Farmatsiya');
const drHamshira = r('dr6', 'Hamshiralik ishi');
export const DIRECTIONS: RefItem[] = [drDavolash, drStom, drPediatr, drProfil, drFarm, drHamshira];

const ay2425 = r('ay1', '2024-2025');
const ay2526 = r('ay2', '2025-2026');
const ay2627 = r('ay3', '2026-2027');
const ay2728 = r('ay4', '2027-2028');
export const ACADEMIC_YEARS: RefItem[] = [ay2425, ay2526, ay2627, ay2728];

export const COURSES: RefItem[] = [
  r('c1', '1'),
  r('c2', '2'),
  r('c3', '3'),
  r('c4', '4'),
  r('c5', '5'),
  r('c6', '6'),
];

export const ERI_KEYS: EriKey[] = [
  { serialNumber: '5E0F1A2B3C4D', subject: 'Karimov A. (Rektor)' },
  { serialNumber: '7A1B2C3D4E5F', subject: "Yo'ldoshev B. (Rahbar)" },
  { serialNumber: '9C2D3E4F5061', subject: 'Zaxira kalit' },
];

const baseFargona: PracticeBase = {
  id: 'b1',
  title: "Farg'ona tibbiyot birlashmasi",
  orgType: otTB,
  stir: '301456789',
  region: rgFargona,
  district: dsFargonaSh,
  address: "Farg'ona sh., Mustaqillik ko'chasi 1",
  headName: 'Aliyev Vali Akramovich',
  headJshshir: '31904926710011',
  headPhone: '+998901112233',
  email: 'fargona.tb@example.uz',
  capacity: 60,
  responsibleUsers: [],
  active: true,
  createdAt: '2026-01-12',
};
const baseMargilon: PracticeBase = {
  id: 'b2',
  title: "Marg'ilon ko'p tarmoqli klinikasi",
  orgType: otClinic,
  stir: '302998877',
  region: rgFargona,
  district: dsMargilon,
  address: "Marg'ilon sh., Buyuk ipak yo'li 14",
  headName: 'Soliyev Botir Karimovich',
  headJshshir: '32107900550022',
  headPhone: '+998901445566',
  email: null,
  capacity: 35,
  responsibleUsers: [],
  active: true,
  createdAt: '2026-02-03',
};
const baseTashkentSEM: PracticeBase = {
  id: 'b3',
  title: 'Toshkent SEM markazi',
  orgType: otSEM,
  stir: '300112244',
  region: rgTashkent,
  district: dsChilonzor,
  address: 'Toshkent sh., Chilonzor 19-mavze',
  headName: 'Rahimova Nodira Salimovna',
  headJshshir: '42509880330044',
  headPhone: '+998939001122',
  email: 'tashkent.sem@example.uz',
  capacity: 50,
  responsibleUsers: [],
  active: true,
  createdAt: '2026-02-20',
};
export const BASES: PracticeBase[] = [baseFargona, baseMargilon, baseTashkentSEM];

const stAliyev: PracticeStudent = {
  id: 's1',
  fish: 'Aliyev Sardor Akmalovich',
  academicYear: ay2627,
  direction: drDavolash,
  course: 3,
  group: '301-A',
  region: rgFargona,
  district: dsFargonaSh,
  active: true,
};
const stKarimova: PracticeStudent = {
  id: 's2',
  fish: 'Karimova Dilnoza Bahromovna',
  academicYear: ay2627,
  direction: drDavolash,
  course: 3,
  group: '301-A',
  region: rgFargona,
  district: dsMargilon,
  active: true,
};
const stTursunov: PracticeStudent = {
  id: 's3',
  fish: 'Tursunov Jasur Olimovich',
  academicYear: ay2627,
  direction: drPediatr,
  course: 4,
  group: '402-B',
  region: rgTashkent,
  district: dsChilonzor,
  active: true,
};
const stYusupova: PracticeStudent = {
  id: 's4',
  fish: 'Yusupova Malika Shavkatovna',
  academicYear: ay2627,
  direction: drStom,
  course: 2,
  group: '201-S',
  region: rgAndijon,
  district: dsAndijonSh,
  active: true,
};
const stOlimov: PracticeStudent = {
  id: 's5',
  fish: 'Olimov Aziz Rustamovich',
  academicYear: ay2627,
  direction: drDavolash,
  course: 3,
  group: '301-A',
  region: rgFargona,
  district: dsQuvasoy,
  active: true,
};
export const STUDENTS: PracticeStudent[] = [
  stAliyev,
  stKarimova,
  stTursunov,
  stYusupova,
  stOlimov,
];

export const CONTRACTS: Contract[] = [
  {
    id: 'k1',
    number: 'AM-0001/2026',
    organization: baseFargona,
    direction: drDavolash,
    academicYear: ay2627,
    course: 3,
    group: '301-A',
    students: [
      { id: 's1', fish: stAliyev.fish, group: '301-A' },
      { id: 's2', fish: stKarimova.fish, group: '301-A' },
    ],
    studentsCount: 2,
    startDate: '2026-09-01',
    endDate: '2026-10-15',
    note: 'Kuzgi amaliyot',
    status: 'draft',
    rector: { signed: false },
    orgHead: { signed: false },
    rejectReason: null,
    rejectedBy: null,
    history: [{ at: '2026-06-20T09:00:00.000Z', actor: "Amaliyot bo'limi", action: 'Shartnoma yaratildi' }],
    createdAt: '2026-06-20',
  },
  {
    id: 'k2',
    number: 'AM-0002/2026',
    organization: baseMargilon,
    direction: drDavolash,
    academicYear: ay2627,
    course: 3,
    group: '301-A',
    students: [{ id: 's5', fish: stOlimov.fish, group: '301-A' }],
    studentsCount: 1,
    startDate: '2026-09-01',
    endDate: '2026-10-30',
    note: null,
    status: 'in_progress',
    rector: { signed: false },
    orgHead: { signed: false },
    rejectReason: null,
    rejectedBy: null,
    history: [
      { at: '2026-06-18T09:00:00.000Z', actor: "Amaliyot bo'limi", action: 'Shartnoma yaratildi' },
      { at: '2026-06-19T10:00:00.000Z', actor: "Amaliyot bo'limi", action: 'Rektorga tasdiqlashga yuborildi' },
    ],
    createdAt: '2026-06-18',
  },
  {
    id: 'k3',
    number: 'AM-0003/2026',
    organization: baseTashkentSEM,
    direction: drPediatr,
    academicYear: ay2627,
    course: 4,
    group: '402-B',
    students: [{ id: 's3', fish: stTursunov.fish, group: '402-B' }],
    studentsCount: 1,
    startDate: '2026-09-10',
    endDate: '2026-11-10',
    note: null,
    status: 'rektor_approved',
    rector: {
      signed: true,
      signer: 'Karimov A.',
      signedAt: '2026-06-17T12:00:00.000Z',
      certInfo: { serialNumber: '5E0F1A2B3C4D', subject: 'Karimov A. (Rektor)' },
    },
    orgHead: { signed: false },
    rejectReason: null,
    rejectedBy: null,
    history: [
      { at: '2026-06-15T09:00:00.000Z', actor: "Amaliyot bo'limi", action: 'Shartnoma yaratildi' },
      { at: '2026-06-16T09:00:00.000Z', actor: "Amaliyot bo'limi", action: 'Rektorga tasdiqlashga yuborildi' },
      { at: '2026-06-17T12:00:00.000Z', actor: 'Rektor', action: 'Rektor ERI bilan tasdiqladi' },
    ],
    createdAt: '2026-06-15',
  },
  {
    id: 'k4',
    number: 'AM-0004/2026',
    organization: baseFargona,
    direction: drStom,
    academicYear: ay2627,
    course: 2,
    group: '201-S',
    students: [{ id: 's4', fish: stYusupova.fish, group: '201-S' }],
    studentsCount: 1,
    startDate: '2026-09-01',
    endDate: '2026-12-01',
    note: null,
    status: 'both_approved',
    rector: {
      signed: true,
      signer: 'Karimov A.',
      signedAt: '2026-05-20T12:00:00.000Z',
      certInfo: { serialNumber: '5E0F1A2B3C4D', subject: 'Karimov A. (Rektor)' },
    },
    orgHead: {
      signed: true,
      signer: "Yo'ldoshev B.",
      signedAt: '2026-05-22T14:00:00.000Z',
      certInfo: { serialNumber: '7A1B2C3D4E5F', subject: "Yo'ldoshev B. (Rahbar)" },
    },
    rejectReason: null,
    rejectedBy: null,
    history: [
      { at: '2026-05-18T09:00:00.000Z', actor: "Amaliyot bo'limi", action: 'Shartnoma yaratildi' },
      { at: '2026-05-19T09:00:00.000Z', actor: "Amaliyot bo'limi", action: 'Rektorga tasdiqlashga yuborildi' },
      { at: '2026-05-20T12:00:00.000Z', actor: 'Rektor', action: 'Rektor ERI bilan tasdiqladi' },
      { at: '2026-05-22T14:00:00.000Z', actor: 'Tibbiyot birlashmasi rahbari', action: 'Rahbar ERI bilan tasdiqladi (yakuniy)' },
    ],
    createdAt: '2026-05-18',
  },
  {
    id: 'k5',
    number: 'AM-0005/2026',
    organization: baseMargilon,
    direction: drDavolash,
    academicYear: ay2627,
    course: 3,
    group: '301-A',
    students: [{ id: 's1', fish: stAliyev.fish, group: '301-A' }],
    studentsCount: 1,
    startDate: '2026-09-01',
    endDate: '2026-10-01',
    note: null,
    status: 'rejected',
    rector: { signed: false },
    orgHead: { signed: false },
    rejectReason: "Amaliyot muddati noto'g'ri ko'rsatilgan",
    rejectedBy: 'rektor',
    history: [
      { at: '2026-06-10T09:00:00.000Z', actor: "Amaliyot bo'limi", action: 'Shartnoma yaratildi' },
      { at: '2026-06-11T09:00:00.000Z', actor: "Amaliyot bo'limi", action: 'Rektorga tasdiqlashga yuborildi' },
      { at: '2026-06-12T11:00:00.000Z', actor: 'Rektor', action: 'Rad etildi (sabab bilan)', reason: "Amaliyot muddati noto'g'ri ko'rsatilgan" },
    ],
    createdAt: '2026-06-10',
  },
];

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    eventType: 'contract_sent_to_rector',
    title: 'Yangi shartnoma tasdiqlashga keldi',
    body: 'AM-0002/2026 — rektor imzosi kutilmoqda',
    link: '/amaliyot/shartnomalar/k2',
    read: false,
    createdAt: '2026-06-19T10:00:00.000Z',
    forRole: 'rektor',
  },
  {
    id: 'n2',
    eventType: 'contract_rektor_approved',
    title: 'Rektor tasdiqlagan shartnoma imzo kutmoqda',
    body: 'AM-0003/2026 — rahbar imzosi kutilmoqda',
    link: '/amaliyot/shartnomalar/k3',
    read: false,
    createdAt: '2026-06-17T12:00:00.000Z',
    forRole: 'tibbiyot_birlashmasi_rahbari',
  },
  {
    id: 'n3',
    eventType: 'contract_rejected',
    title: 'Shartnoma rad etildi',
    body: "AM-0005/2026 — sabab: Amaliyot muddati noto'g'ri ko'rsatilgan",
    link: '/amaliyot/shartnomalar/k5',
    read: true,
    createdAt: '2026-06-12T11:00:00.000Z',
    forRole: 'amaliyot_bolimi',
  },
  {
    id: 'n4',
    eventType: 'contract_both_approved',
    title: 'Shartnoma ikki tomon tomonidan tasdiqlandi',
    body: 'AM-0004/2026 — yakuniy hujjat tayyor',
    link: '/amaliyot/shartnomalar/k4',
    read: true,
    createdAt: '2026-05-22T14:00:00.000Z',
    forRole: 'amaliyot_bolimi',
  },
];

export const DEFAULT_TEMPLATE: ContractTemplate = {
  id: 't1',
  body: `AMALIYOT SHARTNOMASI № {{raqam}}

Sana: {{sana}}        O'quv yili: {{oquv_yili}}

Farg'ona jamoat salomatligi tibbiyot instituti (bundan keyin "Institut") bir tomondan, va {{baza}} ({{viloyat}}, {{tuman}}) (bundan keyin "Amaliyot bazasi") ikkinchi tomondan, quyidagilar haqida ushbu shartnomani tuzdilar:

1. SHARTNOMA PREDMETI
1.1. Institutning {{yonalish}} yo'nalishi {{kurs}}-kurs {{guruh}}-guruh talabalari amaliyotini {{baza}}da tashkil etish.
1.2. Amaliyotga jami {{talabalar_soni}} nafar talaba biriktiriladi.

2. AMALIYOT MUDDATI
2.1. Amaliyot {{muddat_boshlanish}} dan {{muddat_tugash}} gacha o'tkaziladi.

3. BIRIKTIRILGAN TALABALAR RO'YXATI
{{talabalar_royxati}}

4. TOMONLARNING IMZOLARI
Institut nomidan (Rektor): ____________________ (ERI bilan tasdiqlangan)
Amaliyot bazasi nomidan (Rahbar): ____________________ (ERI bilan tasdiqlangan)`,
};

export const TEMPLATE_PLACEHOLDERS = [
  'raqam',
  'sana',
  'oquv_yili',
  'baza',
  'viloyat',
  'tuman',
  'yonalish',
  'kurs',
  'guruh',
  'muddat_boshlanish',
  'muddat_tugash',
  'talabalar_soni',
  'talabalar_royxati',
];
