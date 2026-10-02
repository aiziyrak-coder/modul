export type AccentKey = 'mint' | 'blue' | 'magenta' | 'orange';

export const ACCENT: Record<AccentKey, { solid: string; soft: string }> = {
  mint: { solid: '#34c18c', soft: '#e9f8f2' },
  blue: { solid: '#4a82c8', soft: '#eaf1fa' },
  magenta: { solid: '#d6409f', soft: '#fbeaf5' },
  orange: { solid: '#e8833a', soft: '#fdf0e6' },
};

export interface StatSource {
  label: string;
  url: string;
  params?: Record<string, string | number>;
  field?: string;
  format?: 'number' | 'money';
  tone?: 'good' | 'critical';
}

export interface ModuleCard {
  key: string;
  title: string;
  subtitle: string;
  ttRef: string;
  path: string;
  permission: string;
  accent: AccentKey;
  entries?: { path: string; permission: string }[];
  charts?:
    | 'admission'
    | 'task'
    | 'gifted'
    | 'residency'
    | 'quality'
    | 'council'
    | 'practice'
    | 'studyload'
    | 'teacher';
  stats: StatSource[];
  about: string;
  role: string[];
}

const STAT_OVERVIEW = '/qualification-statistics/overview';

const ADM_STATS = '/international-admission/stats';

const SCI_STATS = '/scientific-statistics/overview';

const TASK_STATS = '/task-statistics/overview';

const GIFTED_STATS = '/gifted-statistics/overview';

const RES_STATS = '/residency-statistics/overview';

const SC_STATS = '/scientific-council/statistics/overview';

const EQ_STATS = '/quality-statistics/overview';

const COUNCIL_STATS = '/council-statistics/overview';

const PRACTICE_STATS = '/practice-statistics/overview';

const SL_STATS = '/study-load-statistics/overview';

const TCH_STATS = '/teacher-statistics/overview';

export const STAT_PERMISSIONS: Readonly<Record<string, string>> = Object.freeze({
  [SL_STATS]: 'workload:readAll',
  [TCH_STATS]: 'teacher:read',
  [STAT_OVERVIEW]: 'qualCourse:readAll',
  [RES_STATS]: 'resident:readAll',
  [SC_STATS]: 'scientificWork:readAll',
  [TASK_STATS]: 'task:readAll',
  [ADM_STATS]: 'internationalAdmission:readAll',
  [COUNCIL_STATS]: 'councilTask:readAll',
  [SCI_STATS]: 'article:readAll',
  [GIFTED_STATS]: 'giftedStudent:readAll',
  [EQ_STATS]: 'indicatorSubmission:readAll',
  [PRACTICE_STATS]: 'practice:readAll',
});

export function statPermission(url: string, cardPermission: string): string {
  return STAT_PERMISSIONS[url] ?? cardPermission;
}

export function chartsPermission(card: Pick<ModuleCard, 'stats' | 'permission'>): string {
  return statPermission(card.stats[0]?.url ?? '', card.permission);
}

export const MODULE_CARDS: readonly ModuleCard[] = [
  {
    key: 'study-load',
    title: "O'quv yuklamasi",
    subtitle: "Ishchi o'quv reja, yuklama va taqsimot",
    ttRef: 'TT 4.2',
    path: '/study-load/approval-inbox',
    permission: 'workload:readAll',
    entries: [
      { path: '/study-load/statistics', permission: 'statistics:read' },
      { path: '/study-load/approval-inbox', permission: 'workload:readAll' },
    ],
    accent: 'blue',
    stats: [
      { label: "Imzoingizni kutmoqda", url: SL_STATS, field: 'rectorInbox.total', tone: 'good' },
      { label: 'Ochiq vakansiyalar', url: SL_STATS, field: 'vacancies.count', tone: 'critical' },
      { label: "Taqsimlanmagan soat", url: SL_STATS, field: 'hours.residue' },
      { label: 'Hujjat tayyorligi, %', url: SL_STATS, field: 'documents.readiness' },
    ],
    charts: 'studyload',
    about:
      "O'quv yuklamalarini shakllantirish, kafedralar o'rtasida taqsimlash va " +
      'ERI orqali bosqichma-bosqich tasdiqlash.',
    role: ["Ishchi o'quv rejani ERI bilan yakuniy tasdiqlash", 'Yuklamani tasdiqlash'],
  },
  {
    key: 'teacher',
    title: "Professor-o'qituvchi",
    subtitle: 'Profil, ish rejalari va ilmiy ishlar',
    ttRef: 'TT 4.3',
    path: '/teacher/profile',
    permission: 'teacher:read',
    accent: 'magenta',
    stats: [
      { label: "O'qituvchilar", url: TCH_STATS, field: 'teachers.total' },
      { label: 'Ilmiy salohiyat, %', url: TCH_STATS, field: 'teachers.degreeRatio', tone: 'good' },
      { label: 'Reja topshirmagan', url: TCH_STATS, field: 'workPlans.missing', tone: 'critical' },
      { label: "Muddati o'tgan ishlar", url: TCH_STATS, field: 'workPlans.overdueItems', tone: 'critical' },
    ],
    charts: 'teacher',
    about:
      "Professor-o'qituvchilar profili, shaxsiy ish rejalari va ilmiy " +
      'faoliyat ko‘rsatkichlarini yuritish.',
    role: ['Xodimlar profillari va ish rejalarini kuzatish'],
  },
  {
    key: 'qualification',
    title: 'Malaka oshirish',
    subtitle: "Kurslar, tinglovchilar va o'zlashtirish",
    ttRef: 'TT 4.4',
    path: '/qualification/manager/courses',
    permission: 'qualCourse:readAll',
    accent: 'orange',
    stats: [
      { label: 'Online kurslar', url: STAT_OVERVIEW, field: 'onlineCourses' },
      { label: 'Offline kurslar', url: STAT_OVERVIEW, field: 'offlineCourses' },
      { label: 'Qabul qilingan tinglovchilar', url: STAT_OVERVIEW, field: 'acceptedListeners' },
      { label: 'Sertifikat olganlar', url: STAT_OVERVIEW, field: 'certificates' },
      { label: "Joriy oy to'lovlari", url: STAT_OVERVIEW, field: 'payments.month', format: 'money' },
      { label: "Yillik to'lovlar", url: STAT_OVERVIEW, field: 'payments.year', format: 'money' },
    ],
    about:
      'Malaka oshirish kurslarini rejalashtirish, tinglovchilarni qabul qilish ' +
      "va o'zlashtirishni nazorat qilish.",
    role: ['Kurslar va tinglovchilar statistikasini kuzatish'],
  },
  {
    key: 'residency',
    title: 'Magistratura va ordinatura',
    subtitle: 'Kontingent, logbuk va attestatsiya',
    ttRef: 'TT 4.5',
    path: '/residency/kontingent',
    permission: 'resident:readAll',
    accent: 'mint',
    stats: [
      { label: 'Umumiy kontingent', url: RES_STATS, field: 'contingent.total' },
      { label: "Davomat, o'rtacha %", url: RES_STATS, field: 'attendance.presentPercent' },
      { label: "Attestatsiya o'rtacha bali", url: RES_STATS, field: 'attestation.avgScore' },
      { label: 'Chetlatish buyruqlari', url: RES_STATS, field: 'risk.expelled', tone: 'critical' },
    ],
    charts: 'residency',
    about:
      'Magistrant va klinik ordinatorlarning taʼlim jarayoni, klinik amaliyoti ' +
      'va attestatsiyasini elektron yuritish.',
    role: ['Kontingent va attestatsiya natijalarini kuzatish'],
  },
  {
    key: 'science-council',
    title: 'Ilmiy kengash',
    subtitle: 'Ilmiy ishlar ekspertizasi va seminarlar',
    ttRef: 'TT 4.6',
    path: '/science-council/works',
    permission: 'scienceCouncil:readAll',
    accent: 'blue',
    stats: [
      { label: 'Jami ilmiy ishlar', url: SC_STATS, field: 'total' },
      { label: 'Yangi', url: SC_STATS, field: 'byStatus.new' },
      { label: 'Tekshirilmoqda', url: SC_STATS, field: 'byStatus.pending' },
      { label: 'Rad etilgan', url: SC_STATS, field: 'byStatus.rejected', tone: 'critical' },
      { label: 'Tashqi tadqiqotchilar', url: SC_STATS, field: 'externalResearchers' },
      { label: 'Himoya qilingan', url: SC_STATS, field: 'defended', tone: 'good' },
    ],
    about:
      'Ilmiy-tadqiqot ishlarini roʻyxatga olish, ekspertiza va seminarlar ' +
      'jarayonini ERI asosida rasmiylashtirish.',
    role: ['Ilmiy ishlar harakati va xulosalarni kuzatish'],
  },
  {
    key: 'task-management',
    title: 'Topshiriqlar',
    subtitle: 'Rahbariyat topshiriqlari va ijro nazorati',
    ttRef: 'TT 4.7',
    path: '/task-management/dashboard',
    permission: 'task:readAll',
    accent: 'magenta',
    stats: [
      { label: 'Jami topshiriqlar', url: TASK_STATS, field: 'total' },
      { label: "Muddati o'tgan", url: TASK_STATS, field: 'overdue.count', tone: 'critical' },
      { label: 'Ijro intizomi, %', url: TASK_STATS, field: 'discipline.percent', tone: 'good' },
      { label: "O'rtacha bajarish, kun", url: TASK_STATS, field: 'avgCompletionDays' },
    ],
    charts: 'task',
    about:
      'Rahbariyat topshiriqlarini ijrochilarga biriktirish, bajarilishini real ' +
      'vaqtda nazorat qilish va ijro intizomini baholash.',
    role: ['Topshiriq yaratish va biriktirish', 'Ijro monitoringi'],
  },
  {
    key: 'foreign-admission',
    title: 'Xorijiy qabul',
    subtitle: 'Xorijiy abituriyentlar onlayn qabuli',
    ttRef: 'TT 4.8',
    path: '/foreign-admission/dashboard',
    permission: 'internationalAdmission:readAll',
    accent: 'orange',
    stats: [
      { label: 'Jami arizalar', url: ADM_STATS, field: 'total' },
      { label: 'Tasdiqlangan', url: ADM_STATS, field: 'byStatus.approved', tone: 'good' },
      { label: 'Rad etilgan', url: ADM_STATS, field: 'byStatus.rejected', tone: 'critical' },
    ],
    charts: 'admission',
    about:
      'Xorijiy abituriyentlarning hujjat topshirishi, arizalarni elektron ' +
      "ko'rib chiqish va qabul statistikasi.",
    role: ['Qabul statistikasi va arizalar holatini kuzatish'],
  },
  {
    key: 'council',
    title: 'Institut ilmiy kengashi',
    subtitle: 'Kengash tarkibi, unvonlar va ovoz berish',
    ttRef: 'TT 4.9',
    path: '/kengash/topshiriqlar',
    permission: 'councilTask:readAll',
    accent: 'mint',
    stats: [
      { label: 'Topshiriqlar', url: COUNCIL_STATS, field: 'tasks.total' },
      { label: "Muddati o'tgan", url: COUNCIL_STATS, field: 'tasks.overdue', tone: 'critical' },
      { label: 'Unvon arizalari', url: COUNCIL_STATS, field: 'ranks.total' },
      { label: 'Faol ovoz berish', url: COUNCIL_STATS, field: 'votings.active', tone: 'good' },
    ],
    charts: 'council',
    about:
      'Kengash tarkibini yuritish, aʼzolarga topshiriq berish, unvon arizalari ' +
      'va nomzodlar boʻyicha anonim ovoz berish.',
    role: ["Topshiriqlar hisobotini ko'rish (TT §4.9.1)", 'Ovoz berish natijalarini kuzatish'],
  },
  {
    key: 'scientific-department',
    title: "Ilmiy bo'lim",
    subtitle: 'Uslubiy tavsiyanoma, monografiya, maqolalar',
    ttRef: 'TT 4.10',
    path: '/scientific-department/methodical',
    permission: 'methodicalRecommendation:readAll',
    accent: 'blue',
    stats: [
      { label: 'Jami ilmiy maqolalar', url: SCI_STATS, field: 'articles.total' },
      { label: 'Tasdiqlangan maqolalar', url: SCI_STATS, field: 'articles.approved', tone: 'good' },
      { label: 'Jami tezislar', url: SCI_STATS, field: 'theses.total' },
      { label: 'Uslubiy tavsiyanomalar', url: SCI_STATS, field: 'methodical.total' },
      { label: 'Ilmiy darajalar', url: SCI_STATS, field: 'degrees.total' },
      { label: 'Ilmiy unvonlar', url: SCI_STATS, field: 'titles.total' },
      { label: "Malakaviy imtihondan o'tganlar", url: SCI_STATS, field: 'qualifying.passed', tone: 'good' },
    ],
    about:
      'Uslubiy tavsiyanomalar, monografiyalar va ilmiy maqolalarni qabul ' +
      'qilish, taqriz va tasdiqlash jarayoni.',
    role: ['Uslubiy tavsiyanomani ERI bilan tasdiqlash (TT §4.10.2)'],
  },
  {
    key: 'gifted-students',
    title: 'Iqtidorli talabalar',
    subtitle: 'Yutuqlar, reyting va stipendiyalar',
    ttRef: 'TT 4.11',
    path: '/gifted-students/student/activities',
    permission: 'studentAchievement:readAll',
    entries: [
      { path: '/gifted-students/department/students', permission: 'giftedStudent:readAll' },
      { path: '/gifted-students/student/activities', permission: 'studentAchievement:readAll' },
    ],
    accent: 'magenta',
    stats: [
      { label: 'Iqtidorli talabalar', url: GIFTED_STATS, field: 'students.total' },
      { label: "O'rtacha ball", url: GIFTED_STATS, field: 'students.avgScore' },
      { label: 'Tasdiqlangan yutuqlar', url: GIFTED_STATS, field: 'achievements.byStatus.approved', tone: 'good' },
      { label: "Ko'rilmagan yutuqlar", url: GIFTED_STATS, field: 'achievements.pending.count', tone: 'critical' },
    ],
    charts: 'gifted',
    about:
      'Iqtidorli talabalarni aniqlash, yutuqlarini baholash va stipendiya ' +
      'jarayonlarini boshqarish.',
    role: ['Reyting va stipendiya jarayonini kuzatish'],
  },
  {
    key: 'education-quality',
    title: "Ta'lim sifati",
    subtitle: "Indikatorlar va o'qituvchilar reytingi",
    ttRef: 'TT 4.12',
    path: '/education-quality/indicators',
    permission: 'eqIndicator:read',
    accent: 'orange',
    stats: [
      { label: 'Faol indikatorlar', url: EQ_STATS, field: 'indicators.active' },
      { label: "Topshirilgan ma'lumotlar", url: EQ_STATS, field: 'submissions.total' },
      { label: 'Tasdiqlangan', url: EQ_STATS, field: 'submissions.byStatus.approved', tone: 'good' },
      { label: 'Tekshiruvda', url: EQ_STATS, field: 'submissions.byStatus.pending' },
    ],
    charts: 'quality',
    about:
      "Indikatorlar asosida professor-o'qituvchilar faoliyatini baholash va " +
      'reyting shakllantirish.',
    role: ['Fakultet/kafedra kesimida reytingni kuzatish'],
  },
  {
    key: 'practice',
    title: 'Amaliyot',
    subtitle: 'Amaliyot bazalari va shartnomalar',
    ttRef: 'TT 4.13',
    path: '/amaliyot/shartnomalar',
    permission: 'practice:readAll',
    accent: 'mint',
    stats: [
      { label: 'Shartnomalar', url: PRACTICE_STATS, field: 'contracts.total' },
      { label: "Imzoingizni kutmoqda", url: PRACTICE_STATS, field: 'contracts.awaitingRector', tone: 'good' },
      { label: 'Amaliyot bazalari', url: PRACTICE_STATS, field: 'organizations.total' },
      { label: 'Talabalar', url: PRACTICE_STATS, field: 'students.total' },
    ],
    charts: 'practice',
    about:
      'Talabalar amaliyotini tashkil etish, bazalar bilan shartnoma tuzish va ' +
      'ERI orqali rasmiylashtirish.',
    role: ['Shartnomani ERI bilan tasdiqlash (TT §4.13.1)', 'Rad etish — sabab bilan'],
  },
];

export const SITE_CARD = {
  title: 'FJSTI — institut sayti',
  subtitle: "Rasmiy veb-sayt va ochiq ma'lumotlar",
  url: 'https://sanfak.aqllishahar.uz/uz',
  about:
    "Farg'ona jamoat salomatligi tibbiyot institutining rasmiy sayti. " +
    "Yangiliklar, e'lonlar, qabul ma'lumotlari va institut hujjatlari shu yerda.",
  links: [{ label: 'Yangiliklar' }, { label: "E'lonlar" }, { label: 'Qabul' }],
} as const;
