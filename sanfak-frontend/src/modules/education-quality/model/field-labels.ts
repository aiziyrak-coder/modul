export const FIELD_LABELS: Readonly<Record<string, string>> = {
  activityName: 'Tadbir nomi',
  antiplagiatReport: 'Antiplagiat hisoboti',
  articleFile: 'Maqola fayli',
  articleTitle: 'Maqola nomi',
  authors: 'Mualliflar',
  authorsCount: 'Mualliflar soni',
  authorsName: "Muallif(lar) F.I.Sh.",
  basisType: 'Asos turi',
  certificateFile: 'Sertifikat fayli',
  certificateName: 'Sertifikat nomi',
  citationCount: 'Iqtiboslar soni',
  comment: 'Izoh',
  competitionName: 'Tanlov nomi',
  conferenceName: 'Konferensiya nomi',
  contractFile: 'Shartnoma fayli',
  cooperationDocName: 'Hamkorlik hujjati nomi',
  councilCertificate: 'Kengash guvohnomasi',
  councilDecision: 'Kengash qarori',
  country: 'Davlat',
  currentYearAmount: 'Joriy yildagi summa',
  date: 'Sana',
  departmentMinutes: 'Kafedra bayonnomasi',
  diplomaFile: 'Diplom fayli',
  diplomaNumber: 'Diplom raqami',
  diplomaSeries: 'Diplom seriyasi',
  directionName: "Yo'nalish nomi",
  dissertationTopic: 'Dissertatsiya mavzusi',
  doctorDiplomaNumber: 'Doktorlik diplomi raqami',
  doctorDiplomaSeries: 'Doktorlik diplomi seriyasi',
  dscNumber: 'DSc diplomi raqami',
  dscSeries: 'DSc diplomi seriyasi',
  duration: 'Davomiyligi',
  expiryDate: 'Amal qilish muddati',
  externalReview: 'Tashqi taqriz',
  foreignOtm: 'Xorijiy OTM nomi',
  googleScholarUrl: 'Google Scholar havolasi',
  grantName: 'Grant nomi',
  grantTopic: 'Grant mavzusi',
  internalReview: 'Ichki taqriz',
  invitationFile: 'Taklifnoma fayli',
  isbn: 'ISBN',
  issuedDate: 'Berilgan sana',
  journalName: 'Jurnal nomi',
  level: 'Daraja',
  manualFile: "Qo'llanma fayli",
  manualName: "Qo'llanma nomi",
  ministerCertFile: 'Vazirlik sertifikati fayli',
  ministerOrderFile: "Vazirlik buyrug'i fayli",
  monographFile: 'Monografiya fayli',
  monographTitle: 'Monografiya nomi',
  orderName: 'Buyruq nomi',
  otmName: 'OTM nomi',
  pages: 'Sahifalar',
  participationType: 'Ishtirok turi',
  passportStampFile: 'Pasport shtampi fayli',
  patentName: 'Patent nomi',
  phdNumber: 'PhD diplomi raqami',
  phdSeries: 'PhD diplomi seriyasi',
  place: 'Joy',
  professorDiplomaNumber: 'Professorlik diplomi raqami',
  professorDiplomaSeries: 'Professorlik diplomi seriyasi',
  programFile: 'Dastur fayli',
  publishLicenseFile: 'Nashr litsenziyasi fayli',
  publishYear: 'Nashr yili',
  publisher: 'Nashriyot',
  rankObtainedDate: 'Unvon olingan sana',
  receiptFile: 'Kvitansiya fayli',
  rectorOrderFile: "Rektor buyrug'i fayli",
  referralFile: "Yo'llanma fayli",
  registrationNumber: "Ro'yxatga olish raqami",
  reportFile: 'Hisobot fayli',
  rewardOrderFile: "Mukofot buyrug'i fayli",
  scopusUrl: 'Scopus havolasi',
  signedDate: 'Imzolangan sana',
  specialty: 'Mutaxassislik',
  specialtyCode: 'Mutaxassislik shifri',
  ssvConclusion: 'SSV xulosasi',
  studentName: 'Talaba F.I.Sh.',
  teacherName: "O'qituvchi F.I.Sh.",
  textbookName: 'Darslik nomi',
  thesisFile: 'Tezis fayli',
  thesisTitle: 'Tezis nomi',
  titleFile: "Titul varag'i fayli",
  topic: 'Mavzu',
  totalAmount: 'Umumiy summa',
  url: 'Havola',
  venue: "O'tkazilgan joy",
  ziyonetCert: 'Ziyonet sertifikati',
};

export const FIELD_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  participationType: ['Onlayn', 'Oflayn'],
  basisType: ['Buyruq', 'Qaror', 'Shartnoma'],
};

function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return key;
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? humanize(key);
}

export function fieldOptions(key: string): string[] | undefined {
  const opts = FIELD_OPTIONS[key];
  return opts ? [...opts] : undefined;
}
