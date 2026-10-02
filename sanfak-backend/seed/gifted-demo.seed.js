const NODE_ENV = typeof process !== "undefined" && process.env ? String(process.env.NODE_ENV || "") : "";
const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(NODE_ENV.toLowerCase());
if (!IS_DEV_ENV) {
  print(`🔴 bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="${NODE_ENV || "(o'rnatilmagan)"}").`);
  print(`   Ruxsat etilgan: ${DEV_ENVS.join(", ")}.`);
  print("   Sabab: 6 ta 4.11 kolleksiyasini deleteMany({}) bilan tozalaydi — production'da bu DATA LOSS bo'lardi.");
  print("");
  print("   mongosh `.env` ni O'QIMAYDI — muhitni O'ZINGIZ bering:");
  print("     NODE_ENV=development mongosh \"<uri>\" seed/gifted-demo.seed.js");
  print("   PowerShell: $env:NODE_ENV=\"development\"; mongosh \"<uri>\" seed/gifted-demo.seed.js");
  quit(1);
}

const uid = (pin) => {
  const u = db.users.findOne({ oneIdPin: pin }, { _id: 1 });
  if (!u) throw new Error("Test user not found for PIN " + pin + " — run `node seed/gifted-users.seed.js` first");
  return u._id;
};

const talaba = uid("41100000000001");
const bolim = uid("41100000000002");
const hakam1 = uid("41100000000003");
const hakam2 = uid("41100000000004");
const advisor = uid("41100000000005");

const now = new Date();
const audit = { active: true, deletedAt: null, deletedBy: null, deletionReason: null, archivedAt: null, archivedBy: null, archiveReason: null, createdAt: now, updatedAt: now };
const deadline = ISODate("2026-12-31T00:00:00.000Z");
const YEAR = "2025-2026";

const AY =
  now.getMonth() + 1 >= 9
    ? `${now.getFullYear()}/${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}/${now.getFullYear()}`;

["giftedstudents", "evaluationcriterias", "documenttypes", "studentachievements", "scholarships", "scholarshipapplications"].forEach((c) => db.getCollection(c).deleteMany({}));
db.chatmessages.deleteMany({ $or: [{ sender: talaba, receiver: advisor }, { sender: advisor, receiver: talaba }] });

const catScopus = new ObjectId(), catMahalliy = new ObjectId(), catXalqaro = new ObjectId(), catResp = new ObjectId();
const critMaqola = new ObjectId(), critKonf = new ObjectId();
db.evaluationcriterias.insertMany([
  { _id: critMaqola, name: "Ilmiy maqola", icon: "📄", categories: [
      { _id: catScopus, name: "Scopus/WoS maqola", points: 50, active: true },
      { _id: catMahalliy, name: "Mahalliy jurnal", points: 20, active: true } ], ...audit },
  { _id: critKonf, name: "Ilmiy konferensiya", icon: "🎤", categories: [
      { _id: catXalqaro, name: "Xalqaro konferensiya", points: 30, active: true },
      { _id: catResp, name: "Respublika konferensiyasi", points: 15, active: true } ], ...audit },
]);

const dtMaqola = new ObjectId(), dtShaxsiy = new ObjectId();
db.documenttypes.insertMany([
  { _id: dtMaqola, title: "Ilmiy maqola nusxasi", desc: "Chop etilgan ilmiy ish nusxasi (PDF)", personal: false, ...audit },
  { _id: dtShaxsiy, title: "Shaxsiy hujjat (pasport)", desc: "Shaxsni tasdiqlovchi hujjat", personal: true, ...audit },
]);

const gsAliyev = new ObjectId(), gsKarimova = new ObjectId();
db.giftedstudents.insertMany([
  { _id: gsAliyev, user: talaba, fullName: "Aliyev Sardor Botir o'g'li",
    passportSeria: "AA", passportNumber: "1234567", jshshir: "41100000000201",
    faculty: "Farmatsiya fakulteti", direction: "Farmatsiya (farmatsevtika ishi)", course: 1, group: "Farm-101",
    academicYear: YEAR, advisorId: String(advisor), advisorName: "Test Oqituvchi",
    email: "s.aliyev@fjsti.uz", phone: "+998 90 123 45 67",
    totalScore: 80, scoresByYear: { [AY]: 80 },
    facultyId: null, directionId: null, groupId: null, ...audit },
  { _id: gsKarimova, user: null, fullName: "Karimova Nilufar Akmal qizi",
    passportSeria: "AB", passportNumber: "7654321", jshshir: "41100000000202",
    faculty: "Farmatsiya fakulteti", direction: "Farmatsiya (farmatsevtik tahlil)", course: 2, group: "Farm-201",
    academicYear: YEAR, advisorId: String(advisor), advisorName: "Test Oqituvchi",
    email: "n.karimova@fjsti.uz", phone: "+998 90 765 43 21",
    totalScore: 50, scoresByYear: { [AY]: 50 },
    facultyId: null, directionId: null, groupId: null, ...audit },
]);

const ach = (o) => ({ desc: "", fileUrl: "", fileName: "", link: "", score: 0, scoreCriteria: null, scoreCategoryId: null, scoreLabel: "", reviewNote: "", reviewedAt: null, reviewedBy: null, academicYear: AY, ...audit, ...o });
db.studentachievements.insertMany([
  ach({ student: gsAliyev, documentType: dtMaqola, title: "Scopus jurnalida chop etilgan maqola", desc: "Q1 jurnal, impact factor 3.2", link: "https://www.scopus.com",
        status: "approved", score: 50, scoreCriteria: critMaqola, scoreCategoryId: catScopus, scoreLabel: "Ilmiy maqola (Scopus/WoS maqola)", reviewedBy: bolim, reviewedAt: now }),
  ach({ student: gsAliyev, documentType: dtMaqola, title: "Xalqaro konferensiya ma'ruzasi", desc: "ICPS-2026 xalqaro anjumani",
        status: "approved", score: 30, scoreCriteria: critKonf, scoreCategoryId: catXalqaro, scoreLabel: "Ilmiy konferensiya (Xalqaro konferensiya)", reviewedBy: bolim, reviewedAt: now }),
  ach({ student: gsAliyev, documentType: dtMaqola, title: "Mahalliy jurnalda maqola", desc: "Ko'rib chiqilmoqda", status: "pending" }),
  ach({ student: gsAliyev, documentType: dtMaqola, title: "Konferensiya tezisi", desc: "Tezislar to'plami",
        status: "rejected", reviewNote: "Hujjat to'liq emas — jurnal sahifasi bilan qayta yuklang.", reviewedBy: bolim, reviewedAt: now }),
  ach({ student: gsAliyev, documentType: dtShaxsiy, title: "Pasport nusxasi", desc: "Shaxsiy hujjat", status: "pending" }),
  ach({ student: gsKarimova, documentType: dtMaqola, title: "Scopus jurnalida maqola", desc: "Q2 jurnal", link: "https://www.scopus.com",
        status: "approved", score: 50, scoreCriteria: critMaqola, scoreCategoryId: catScopus, scoreLabel: "Ilmiy maqola (Scopus/WoS maqola)", reviewedBy: bolim, reviewedAt: now }),
]);

const schBeruniy = new ObjectId(), schXorazmiy = new ObjectId(), schRektor = new ObjectId();
db.scholarships.insertMany([
  { _id: schBeruniy, name: "Beruniy nomidagi stipendiya", description: "Iqtidorli talabalar uchun nufuzli davlat stipendiyasi",
    type: "nomdor", minScore: 60, amount: "2,000,000 so'm/oy", deadline, academicYear: YEAR, allowedCourses: ["1"], judges: [], criteria: [], ...audit },
  { _id: schXorazmiy, name: "Al-Xorazmiy stipendiyasi", description: "Aniq fanlar bo'yicha iqtidorli talabalarga",
    type: "nomdor", minScore: 40, amount: "1,500,000 so'm/oy", deadline, academicYear: YEAR, allowedCourses: ["1", "2"], judges: [], criteria: [], ...audit },
  { _id: schRektor, name: "Rektor stipendiyasi (Ilmiy yo'nalish)", description: "Rektor tomonidan iqtidorli talabalarga beriladigan maxsus mukofot",
    type: "rektor", minScore: 40, amount: "3,000,000 so'm/oy", deadline, academicYear: YEAR, allowedCourses: ["1"],
    judges: [hakam1, hakam2], criteria: [{ criteria: critMaqola, categoryIds: [catScopus], pointOverrides: [] }], ...audit },
]);

db.scholarshipapplications.insertMany([
  { giftedStudent: gsAliyev, scholarship: schBeruniy, type: "nomdor_stipendiya", scholarshipName: "Beruniy nomidagi stipendiya",
    status: "approved", documents: [], academicYear: YEAR, appliedAt: now, reviewedAt: now, reviewedBy: bolim, judgeScores: [], ...audit },
  { giftedStudent: gsAliyev, scholarship: schRektor, type: "rektor_stipendiyasi", scholarshipName: "Rektor stipendiyasi (Ilmiy yo'nalish)",
    status: "approved", documents: [], academicYear: YEAR, appliedAt: now, reviewedAt: now, reviewedBy: bolim, 
    judgeScores: [
      { judge: hakam1, scores: [{ criteria: critMaqola, categoryId: catScopus, value: 48 }], totalScore: 48, submittedAt: now },
      { judge: hakam2, scores: [{ criteria: critMaqola, categoryId: catScopus, value: 44 }], totalScore: 44, submittedAt: now },
    ], ...audit },
]);

db.chatmessages.insertMany([
  { sender: advisor, receiver: talaba, message: "Salom Sardor! Scopus maqolangiz uchun tabriklayman.", readAt: now, isDeleted: false, active: true, createdAt: now, updatedAt: now },
  { sender: talaba, receiver: advisor, message: "Rahmat, ustoz! Keyingi konferensiyaga tayyorgarlik ko'ryapman.", readAt: null, isDeleted: false, active: true, createdAt: now, updatedAt: now },
]);

print("[gifted-demo] OK — students:" + db.giftedstudents.countDocuments() +
  " criteria:" + db.evaluationcriterias.countDocuments() +
  " docTypes:" + db.documenttypes.countDocuments() +
  " achievements:" + db.studentachievements.countDocuments() +
  " scholarships:" + db.scholarships.countDocuments() +
  " applications:" + db.scholarshipapplications.countDocuments());
