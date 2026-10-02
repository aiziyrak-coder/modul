const Template = require("./contractTemplate.model");

const DEFAULT_BODY = `AMALIYOT SHARTNOMASI № {{raqam}}

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
Amaliyot bazasi nomidan (Rahbar): ____________________ (ERI bilan tasdiqlangan)`;

const oldest = () => Template.findOne().sort({ createdAt: 1 });

module.exports = {
  DEFAULT_BODY,

  get: async () => {
    let doc = await oldest();
    if (!doc) doc = await new Template({ body: DEFAULT_BODY }).save();
    return doc;
  },

  getBody: async () => {
    const doc = await oldest();
    return doc ? doc.body : DEFAULT_BODY;
  },

  save: async (body, userId) => {
    let doc = await oldest();
    if (!doc) {
      doc = new Template({ body, updatedBy: userId });
    } else {
      doc.body = body;
      doc.updatedBy = userId;
    }
    await doc.save();
    return doc;
  },
};
