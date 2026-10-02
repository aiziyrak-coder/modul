type Dict = Record<string, string>;

const uz: Dict = {
  'studyLoad.workload.version.badgeTooltip': 'Yuklama versiyasi',
  'studyLoad.workload.version.supersededAlert':
    "Bu yuklama o'z kuchini yo'qotgan — yangi versiya bilan almashtirilgan. Faqat ko'rish mumkin.",
  'studyLoad.workload.version.openNewVersion': "Yangi versiyani ko'rish",
  'studyLoad.workload.version.openExisting': "Ochiq versiyani ko'rish",
  'studyLoad.workload.version.openConflict':
    "Bu kafedra va o'quv yili uchun ochiq (yakunlanmagan) yuklama versiyasi bor",
  'studyLoad.workload.version.createHint':
    'Shu kafedra va yil uchun tasdiqlangan yuklama bor — yangi versiya yaratiladi (eski tarixda qoladi)',
  'studyLoad.myWorkload.supersededHint': 'Bu taqsimot yangi versiya bilan almashtirilgan — jamiga kirmaydi',
};

const ru: Dict = {
  'studyLoad.workload.version.badgeTooltip': 'Версия нагрузки',
  'studyLoad.workload.version.supersededAlert':
    'Эта нагрузка утратила силу — заменена новой версией. Доступен только просмотр.',
  'studyLoad.workload.version.openNewVersion': 'Открыть новую версию',
  'studyLoad.workload.version.openExisting': 'Открыть незавершённую версию',
  'studyLoad.workload.version.openConflict':
    'Для этой кафедры и учебного года уже есть незавершённая версия нагрузки',
  'studyLoad.workload.version.createHint':
    'Для этой кафедры и года есть утверждённая нагрузка — будет создана новая версия (старая останется в истории)',
  'studyLoad.myWorkload.supersededHint': 'Это распределение заменено новой версией — не входит в итог',
};

const en: Dict = {
  'studyLoad.workload.version.badgeTooltip': 'Workload version',
  'studyLoad.workload.version.supersededAlert':
    'This workload is no longer in effect — it was replaced by a new version. View only.',
  'studyLoad.workload.version.openNewVersion': 'Open the new version',
  'studyLoad.workload.version.openExisting': 'Open the unfinished version',
  'studyLoad.workload.version.openConflict':
    'An unfinished workload version already exists for this department and academic year',
  'studyLoad.workload.version.createHint':
    'An approved workload exists for this department and year — a new version will be created (the old one stays in history)',
  'studyLoad.myWorkload.supersededHint': 'This distribution was replaced by a new version — excluded from totals',
};

export const WORKLOAD_VERSION_I18N = { uz, ru, en } as const;
