export interface DocCategory {
  key: string;
  labelUz: string;
  labelRu: string;
  format: string;
  required: boolean;
}

export const DOCUMENT_CATEGORIES: DocCategory[] = [
  { key: 'coverLetter', labelUz: "Yo'llanma xati", labelRu: 'Сопроводительное письмо', format: 'pdf', required: true },
  { key: 'passport', labelUz: 'Pasport nusxasi', labelRu: 'Копия паспорта', format: 'pdf', required: true },
  { key: 'cv', labelUz: "Ilmiy-pedagogik faoliyat haqida ma'lumot", labelRu: 'Сведения о научно-педагогической деятельности', format: 'word', required: true },
  { key: 'biography', labelUz: 'Tarjimai hol', labelRu: 'Автобиография', format: 'word', required: true },
  { key: 'dissertation', labelUz: 'Dissertatsiya', labelRu: 'Диссертация', format: 'word, pdf', required: true },
  { key: 'abstract', labelUz: 'Avtoreferat', labelRu: 'Автореферат', format: 'word, pdf', required: true },
  { key: 'antiplagiat', labelUz: 'Antiplagiat tekshiruvi', labelRu: 'Проверка антиплагиата', format: 'pdf', required: true },
  { key: 'supervisorReview', labelUz: 'Ilmiy rahbar taqrizi', labelRu: 'Отзыв научного руководителя', format: 'pdf', required: true },
  { key: 'examCertificates', labelUz: 'Imtihon natijalari', labelRu: 'Результаты экзаменов', format: 'pdf', required: true },
  { key: 'form34', labelUz: '34-shakl', labelRu: 'Форма 34', format: 'excel', required: true },
  { key: 'publishedWorks', labelUz: "Chop etilgan ishlar ro'yxati", labelRu: 'Список опубликованных работ', format: 'word', required: true },
  { key: 'implementationConclusions', labelUz: 'Joriy etish xulosalari', labelRu: 'Акты внедрения', format: 'pdf', required: true },
  { key: 'approbation', labelUz: 'Approbatsiya bayonnomasi', labelRu: 'Протокол апробации', format: 'pdf', required: true },
  { key: 'ssvConclusion', labelUz: 'SSV xulosasi', labelRu: 'Заключение НТС', format: 'pdf', required: true },
  { key: 'checkAct', labelUz: 'Tekshirish dalolatnomasi', labelRu: 'Акт проверки', format: 'pdf', required: true },
  { key: 'contracts', labelUz: 'Shartnomalar', labelRu: 'Договоры', format: 'pdf', required: false },
  { key: 'coauthorConsent', labelUz: 'Hammualliflar roziligi', labelRu: 'Согласие соавторов', format: 'pdf', required: false },
  { key: 'patientList', labelUz: "Bemorlar ro'yxati", labelRu: 'Список пациентов', format: 'excel', required: false },
];
