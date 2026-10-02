import type {
  PersonInput,
  TopicType,
  V142FormValues,
  V142TopicInput,
} from '../model/types';

export const TOPIC_TYPES: readonly TopicType[] = [
  'maruza',
  'amaliy',
  'seminar',
  'laboratoriya',
  'klinik_amaliyot',
] as const;

export const TOPIC_TYPE_OPTION_KEYS: { labelKey: string; value: TopicType }[] = [
  { labelKey: 'scienceProgram.v142.option.topicType.maruza', value: 'maruza' },
  { labelKey: 'scienceProgram.v142.option.topicType.amaliy', value: 'amaliy' },
  { labelKey: 'scienceProgram.v142.option.topicType.seminar', value: 'seminar' },
  { labelKey: 'scienceProgram.v142.option.topicType.laboratoriya', value: 'laboratoriya' },
  {
    labelKey: 'scienceProgram.v142.option.topicType.klinikAmaliyot',
    value: 'klinik_amaliyot',
  },
];

export const TOPIC_TYPE_LABEL_KEY: Record<TopicType, string> = TOPIC_TYPE_OPTION_KEYS.reduce(
  (acc, o) => {
    acc[o.value] = o.labelKey;
    return acc;
  },
  {} as Record<TopicType, string>,
);

export const EDUCATION_FORM_OPTION_KEYS: { labelKey: string; value: string }[] = [
  { labelKey: 'scienceProgram.v142.option.educationForm.kunduzgi', value: 'kunduzgi' },
  { labelKey: 'scienceProgram.v142.option.educationForm.sirtqi', value: 'sirtqi' },
  { labelKey: 'scienceProgram.v142.option.educationForm.kechki', value: 'kechki' },
  { labelKey: 'scienceProgram.v142.option.educationForm.masofaviy', value: 'masofaviy' },
];

export const LANGUAGE_OPTION_KEYS: { labelKey: string; value: string }[] = [
  { labelKey: 'scienceProgram.v142.option.language.uz', value: "O'zbek" },
  { labelKey: 'scienceProgram.v142.option.language.ru', value: 'Rus' },
  { labelKey: 'scienceProgram.v142.option.language.en', value: 'Ingliz' },
  { labelKey: 'scienceProgram.v142.option.language.uzRu', value: "O'zbek/rus" },
];

export const LITERATURE_GROUP_TITLES = {
  primary: 'Asosiy adabiyotlar',
  additional: "Qo'shimcha adabiyotlar",
  information: 'Axborot manbalari',
} as const;

export const INDEPENDENT_NOTE_DEFAULT =
  "*Izoh: Fan (modul) yuzasidan talabalar bajaradigan mustaqil ish topshiriqlari variativ tavsifga ega bo'lishi lozim. " +
  "Mustaqil ish topshiriqlarining 1/3 qismi kichik guruhlarda hamkorlikda ishlash (kooperativlik)ga mo'ljallangan bo'lishi kerak.";

export const GRADING_DEFAULT: { a: string[]; b: string[]; d: string[]; e: string[] } = {
  a: [
    '5 baho (90-100 ball) olish uchun talabaning bilim darajasi quyidagilarga javob berishi lozim:',
    'fanning mohiyati va mazmunini to‘liq yorita olsa;',
    'fandagi mavzularni bayon qilishda ilmiylik va mantiqiylik saqlanib, ilmiy xatolik va chalkashliklarga yo‘l qo‘ymasa;',
    'fan bo‘yicha mavzu materiallarining nazariy yoki amaliy ahamiyati haqida aniq tasavvurga ega bo‘lsa;',
    'fan doirasida mustaqil, erkin fikrlash qobiliyatini namoyon eta olsa;',
    'berilgan savollarga aniq va lo‘nda javob bera olsa;',
    'konspektga puxta tayyorlangan bo‘lsa;',
    'mustaqil topshiriqlarni to‘liq va aniq bajargan bo‘lsa;',
    'fanga tegishli qonunlar va boshqa me’yoriy-huquqiy hujjatlarni to‘liq o‘zlashtirgan bo‘lsa;',
    'fanga tegishli mavzulardan biri bo‘yicha ilmiy maqola chop ettirgan bo‘lsa;',
    'tarixiy jarayonlarni sharhlay bilsa.',
  ],
  b: [
    '4 baho (70-89,9 ball) olish uchun talabaning bilim darajasi quyidagilarga javob berishi lozim:',
    'fanning mohiyati va mazmunini tushungan, fandagi mavzularni bayon qilishda ilmiy va mantiqiy chalkashliklarga yo‘l qo‘ymasa;',
    'fanning mazmunini amaliy ahamiyatini tushungan bo‘lsa;',
    'fan bo‘yicha berilgan vazifa va topshiriqlarni o‘quv dasturi doirasida bajarsa;',
    'fan bo‘yicha berilgan savollarga to‘g‘ri javob bera olsa;',
    'fan bo‘yicha konspektini puxta shakllantirgan bo‘lsa;',
    'fan bo‘yicha mustaqil topshiriqlarni to‘liq bajargan bo‘lsa;',
    'fanga tegishli qonunlar va boshqa me’yoriy hujjatlarni o‘zlashtirgan bo‘lsa.',
  ],
  d: [
    '3 baho olish uchun talabaning bilim darajasi quyidagilarga javob berishi lozim:',
    'fan haqida umumiy tushunchaga ega bo‘lsa;',
    'fandagi mavzularni tor doirada yoritib, bayon qilishda ayrim chalkashliklarga yo‘l qo‘yilsa;',
    'bayon qilish ravon bo‘lmasa;',
    'fan bo‘yicha savollarga mujmal va chalkash javoblar olinsa;',
    'fan bo‘yicha matn puxta shakllantirilmagan bo‘lsa.',
  ],
  e: [
    'quyidagi hollarda talabaning bilim darajasi qoniqarsiz 2 baho bilan baholanishi mumkin:',
    'fan bo‘yicha mashg‘ulotlarga tayyorgarlik ko‘rilmagan bo‘lsa;',
    'fan bo‘yicha mashg‘ulotlarga doir hech qanday tasavvurga ega bo‘lmasa;',
    'fan bo‘yicha matnlarni boshqalardan ko‘chirib olganligi sezilib tursa;',
    'fan bo‘yicha matnda jiddiy xato va chalkashliklarga yo‘l qo‘yilgan bo‘lsa;',
    'fanga doir berilgan savollarga javob olinmasa;',
    'fanni bilmasa.',
  ],
};

export const EMPTY_PERSON: PersonInput = {
  fio: '',
  degree: '',
  title: '',
  department: '',
  position: '',
};

export const EMPTY_TOPIC: V142TopicInput = {
  type: 'maruza',
  code: '',
  title: '',
  hours: 1,
  refs: '',
};

export const V142_INITIAL_VALUES: V142FormValues = {
  science: '',
  language: "O'zbek",
  educationForm: 'kunduzgi',
  knowledgeArea: [''],
  educationArea: [''],
  directions: [],
  councilProtocol: { date: null, number: '' },
  departmentProtocol: { date: null, number: '' },
  authors: [{ ...EMPTY_PERSON }],
  reviewers: [{ ...EMPTY_PERSON }],

  sciencePurpose: '',
  scienceTasks: '',
  prerequisites: [],
  competencies: [],
  skills: [],

  topics: [{ ...EMPTY_TOPIC }],
  independentTasks: [],
  independentNote: INDEPENDENT_NOTE_DEFAULT,

  techMethods: [],
  creditRequirements: '',
  grading: {
    a: [...GRADING_DEFAULT.a],
    b: [...GRADING_DEFAULT.b],
    d: [...GRADING_DEFAULT.d],
    e: [...GRADING_DEFAULT.e],
  },

  primaryLiterature: [],
  additionalLiterature: [],
  informationSources: [],
};
