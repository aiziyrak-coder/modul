const DocSetting = require("./docSetting.model");

const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const POPULATE = ["updatedBy"];

const applyPopulate = (query) => {
  POPULATE.forEach((p) => {
    query = query.populate(p);
  });
  return query;
};

const DEFAULT_DOCS = [
  {
    name: "Ilmiy unvon talabgorining faoliyati bo'yicha ma'lumotnomasi",
    required: true,
    order: 1,
    maxFiles: 1,
  },
  { name: "Loyihalarda ishtirok etish", required: true, order: 2, maxFiles: 2 },
  {
    name: "Ma'naviy-ma'rifiy ishlarda ishtiroki",
    required: true,
    order: 3,
    maxFiles: 7,
  },
  {
    name: "Attestatsiya jarayonida ishtirok etganligi",
    required: true,
    order: 4,
    maxFiles: 3,
  },
  {
    name: "Talabgor to'g'risida obyektiv ma'lumotnoma",
    required: true,
    order: 5,
    maxFiles: 1,
  },
  {
    name: "Tegishli ilmiy darajadagi diplom nusxasi",
    required: true,
    order: 6,
    maxFiles: 2,
  },
  {
    name: "Maxsus imtihon topshirganlik to'g'risidagi guvohnoma nusxasi",
    required: false,
    order: 7,
    maxFiles: 1,
  },
  {
    name: "Mehnat daftarchasining ish joyidan tasdiqlangan nusxasi",
    required: true,
    order: 8,
    maxFiles: 2,
  },
  {
    name: "Tasdiqlangan ilmiy ishlar ro'yxati",
    required: true,
    order: 9,
    maxFiles: 1,
  },
  {
    name: "Hammualliflarning rozilik xatlari",
    required: true,
    order: 10,
    maxFiles: 2,
  },
  {
    name: "Ilmiy unvon talabgorining dissertatsiya avtoreferati",
    required: true,
    order: 11,
    maxFiles: 1,
  },
  {
    name: "Ilmiy rahbarlikdagi shogirdlari",
    required: true,
    order: 12,
    maxFiles: 1,
  },
  {
    name: "Himoyadan keyingi asosiy ilmiy ishlar nusxalari",
    required: true,
    order: 13,
    maxFiles: 10,
  },
  {
    name: "Himoyadan keyingi asosiy o'quv-uslubiy ishlar nusxalari",
    required: true,
    order: 14,
    maxFiles: 6,
  },
  {
    name: "Boshqa qo'shimcha hujjatlar",
    required: false,
    order: 15,
    maxFiles: 10,
  },
  {
    name: "Talabgorning to'liq ism-familiyasi (pasport bo'yicha)",
    required: true,
    order: 16,
    maxFiles: 1,
  },
];

const DEFAULT_POSITION_DOCS = [
  { name: "Rektor nomiga ariza", required: true, order: 1, maxFiles: 1 },
  { name: "Ma'lumotnoma (obyektivka)", required: true, order: 2, maxFiles: 1 },
  { name: "Tarjimai hol", required: true, order: 3, maxFiles: 1 },
  { name: "Pasport nusxasi", required: true, order: 4, maxFiles: 1 },
  {
    name: "Diplom (bakalavr, magistr) / ilmiy daraja, ilmiy unvon nusxalari",
    required: true,
    order: 5,
    maxFiles: 6,
  },
  {
    name: "Talabgorning 3x4 shakli (ilmiy nashrlar ro'yxati)",
    required: true,
    order: 6,
    maxFiles: 1,
  },
  {
    name: "Monografiya, maqola, tezis, o'quv qo'llanma, darslik uchun olingan GRIF nusxalari",
    required: true,
    order: 7,
    maxFiles: 15,
  },
  { name: "Ochiq dars bayonnomasi", required: true, order: 8, maxFiles: 3 },
  { name: "So'nggi 3 yillik hisoboti", required: true, order: 9, maxFiles: 1 },
  {
    name: "Kafedra yig'ilishida talabgorning nomzodini ko'rib chiqilganlik bayoni",
    required: true,
    order: 10,
    maxFiles: 1,
  },
  {
    name: "Pedagog xodimning malaka oshirish sertifikati",
    required: true,
    order: 11,
    maxFiles: 1,
  },
  {
    name: "Til bilish sertifikati",
    required: false,
    order: 12,
    maxFiles: 1,
  },
];

const DEFAULT_DOCS_VERSION = 5;

const DEFAULTS_BY_CATEGORY = {
  rank: DEFAULT_DOCS,
  position: DEFAULT_POSITION_DOCS,
};

const normName = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/['’‘ʻ`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const RENAMES = new Map(
  [
    ["Diplom nusxasi", "Tegishli ilmiy darajadagi diplom nusxasi"],
    ["Mehnat daftarchasi nusxasi", "Mehnat daftarchasining ish joyidan tasdiqlangan nusxasi"],
    ["Dissertatsiya avtoreferati", "Ilmiy unvon talabgorining dissertatsiya avtoreferati"],
    [
      "Ilmiy unvon talabgorining faoliyati bo'yicha talabnomasi (Ariza)",
      "Ilmiy unvon talabgorining faoliyati bo'yicha ma'lumotnomasi",
    ],
    ["Loyihada ishtirok etish", "Loyihalarda ishtirok etish"],
  ].map(([from, to]) => [normName(from), to]),
);

const REMOVED_IN_V4 = new Set(
  [
    "Tashkilot xati",
    "Kafolat xati",
    "Institut ilmiy kengashida tasdiqlanganligi",
  ].map(normName),
);

const applyDefaultDocsMigration = async (doc) => {
  if ((doc.defaultDocsVersion || 0) >= DEFAULT_DOCS_VERSION) return false;

  const categories = doc.categories || {};
  for (const cat of ["rank", "position"]) {
    const CATEGORY_DOCS = DEFAULTS_BY_CATEGORY[cat];

    let list = (categories[cat] || []).map((d) => ({
      name: d.name,
      required: d.required,
      order: d.order,
      maxFiles: d.maxFiles,
    }));
    list.forEach((d) => {
      const renamed = RENAMES.get(normName(d.name));
      if (renamed) d.name = renamed;
    });
    list = list.filter((d) => !REMOVED_IN_V4.has(normName(d.name)));
    if (cat === "position") {
      const rankOnly = new Set(
        DEFAULT_DOCS.filter(
          (d) => !CATEGORY_DOCS.some((p) => normName(p.name) === normName(d.name)),
        ).map((d) => normName(d.name)),
      );
      list = list.filter((d) => !rankOnly.has(normName(d.name)));
    }

    const have = new Set(list.map((d) => normName(d.name)));
    const missing = CATEGORY_DOCS.filter((d) => !have.has(normName(d.name)));
    missing.forEach((d) => list.push({ ...d }));

    const defaults = new Map(CATEGORY_DOCS.map((d) => [normName(d.name), d]));
    list.forEach((d) => {
      const std = defaults.get(normName(d.name));
      d.maxFiles = std ? std.maxFiles : (d.maxFiles ?? 1);
      if (std) d.required = std.required;
    });

    const tzIndex = (name) =>
      CATEGORY_DOCS.findIndex((d) => normName(d.name) === normName(name));
    list.sort((a, b) => {
      const ia = tzIndex(a.name);
      const ib = tzIndex(b.name);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return (a.order || 0) - (b.order || 0);
    });
    list.forEach((d, i) => {
      d.order = i + 1;
    });
    categories[cat] = list;
  }

  const rankTypes = (doc.rankTypes || []).filter(
    (t) => normName(t) !== normName("Katta ilmiy xodim"),
  );

  const positionTypes = (doc.positionTypes || []).length
    ? doc.positionTypes
    : DEFAULT.positionTypes;

  await DocSetting.updateOne(
    { _id: doc._id },
    {
      $set: {
        categories,
        rankTypes: rankTypes.length ? rankTypes : DEFAULT.rankTypes,
        positionTypes,
        defaultDocsVersion: DEFAULT_DOCS_VERSION,
      },
    },
  );

  const RankApplication = require("#modules/4.09-instituteCouncil/rankApplication/rankApplication.model");
  const apps = await RankApplication.find({ "submittedDocs.0": { $exists: true } })
    .select("submittedDocs")
    .lean();
  for (const app of apps) {
    let touched = false;
    const docs = app.submittedDocs.map((d) => {
      const renamed = RENAMES.get(normName(d.name));
      if (renamed && d.name !== renamed) {
        touched = true;
        return { ...d, name: renamed };
      }
      return d;
    });
    if (touched) {
      await RankApplication.updateOne({ _id: app._id }, { $set: { submittedDocs: docs } });
    }
  }
  return true;
};

const DEFAULT = {
  categories: {
    rank: DEFAULT_DOCS.map((d) => ({ ...d })),
    position: DEFAULT_POSITION_DOCS.map((d) => ({ ...d })),
  },
  rankTypes: ["Dotsent", "Professor"],
  positionTypes: [
    "Stajor",
    "Assistent (o'qituvchi)",
    "Katta o'qituvchi",
    "V.B. Dotsent",
    "V.B. Professor",
  ],
  passingPercent: 60,
};

module.exports = {
  getOrCreate: async () => {
    await DocSetting.updateMany(
      {
        $or: [
          { rankTypes: { $exists: false } },
          { rankTypes: { $size: 0 } },
        ],
      },
      { $set: { rankTypes: DEFAULT.rankTypes } },
    ).exec();

    const existing = await applyPopulate(
      DocSetting.findOne({}, EXCLUDE),
    ).exec();
    if (existing) {
      if (await applyDefaultDocsMigration(existing)) {
        return applyPopulate(DocSetting.findById(existing._id, EXCLUDE)).exec();
      }
      return existing;
    }

    const created = await new DocSetting({
      ...DEFAULT,
      defaultDocsVersion: DEFAULT_DOCS_VERSION,
    }).save();
    return applyPopulate(DocSetting.findById(created._id, EXCLUDE)).exec();
  },

  update: async (body, userId) => {
    const payload = { ...body, updatedBy: userId };
    const existing = await DocSetting.findOne({}).exec();

    if (!existing) {
      const created = await new DocSetting({ ...DEFAULT, ...payload }).save();
      return applyPopulate(DocSetting.findById(created._id, EXCLUDE)).exec();
    }

    return applyPopulate(
      DocSetting.findByIdAndUpdate(existing._id, payload, {
        new: true,
        projection: EXCLUDE,
      }),
    ).exec();
  },
};
