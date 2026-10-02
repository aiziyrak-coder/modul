"use strict";

const preamble = (rektor, buyurtmachi) =>
  "O'zbekiston Respublikasi Prezidentining 2019 yil 6 maydagi “Tibbiyot va " +
  "farmatsevtika ta'limi va ilm-fani tizimini yanada rivojlantirish chora-tadbirlari " +
  "to'g'risida”gi PQ-4310-son qarorida ko'rsatilgan topshiriqlarni amalga oshirish " +
  "bo'yicha qayta tayyorlash va malakasi oshirish kurslarida o'qitishning to'lov-shartnoma " +
  "shakli asosan Farg'ona jamoat salomatligi tibbiyot instituti Nizomiga muvofiq uning " +
  `nomidan rektor ${rektor} (bundan buyon matnda “Ijrochi” deb ataladi) bir tomondan va ` +
  `${buyurtmachi} (bundan buyon matnda “Buyurtmachi” deb ataladi) ikkinchi tomondan ` +
  "mazkur shartnomani quyidagilar haqida tuzdilar:";

const section1 = {
  title: "1. Shartnoma predmeti",
  paras: [
    "1.1. Farg'ona jamoat salomatligi tibbiyot instituti (bundan buyon matnda FJSTI deb " +
      "ataladi) 2020-yil 28-sentyabrdagi 513-son buyrug'i bilan tasdiqlangan «Toshkent " +
      "tibbiyot akademiyasida tibbiyot va farmatsevtika kadrlarini qayta tayyorlash va " +
      "malakasini oshirish tizimini takomillashtirish chora-tadbirlari to'g'risida»gi nizom " +
      "hamda shartnomada nazarda tutilgan tartibda va shartlarda malaka oshirish kurslarini " +
      "sifatli tashkil etishni, Buyurtmachi esa malaka oshirish bilan bog'liq xarajatlarni " +
      "to'lashni o'z zimmasiga oladi.",
    "1.2. Malaka oshirish kurslarida o'quv mashg'ulotlari O'zbekiston Respublikasi sog'liqni " +
      "saqlash vazirligi tomonidan tasdiqlanadigan quyidagi akademik soatdan iborat o'quv " +
      "dasturlari asosida olib boriladi.",
  ],
};

const section2 = {
  title: "2. Malaka oshirish uchun belgilangan to'lov va hisob-kitob tartibi",
  intro:
    "2.1. Tasdiqlangan o'quv dasturi bo'yicha malaka oshirish uchun belgilangan to'lov bir " +
    "tinglovchi uchun tashkil etadi:",
  after: [
    "2.2. Buyurtmachi shartnoma qiymatining 100 foiz to'lovini besh bank ish kuni mobaynida " +
      "oldindan pul o'tkazish yo'li bilan amalga oshiradi.",
    "2.3. Buyurtmachi shartnomaning ikkinchi nusxasini malaka oshirish kursi boshlangan " +
      "vaqtda Ilmiy-innovatsion ishlanmalarni tijoratlashtirish va pullik xizmatni " +
      "rivojlantirish bo'limiga taqdim etilishini ta'minlaydi.",
  ],
};

const sections = [
  {
    title: "3. Ijrochining huquq va majburiyatlari",
    paras: [
      "3.1. Ijrochi quyidagi majburiyatlarni o'z zimmasiga oladi:",
      "- malaka oshirish jarayonini sifatli tashkil qilishni ta'minlash;",
      "- mashg'ulotlarni soha bo'yicha yuqori malakaga ega bo'lgan professor-o'qituvchi va " +
        "amaliyotchi mutaxassislar tomonidan o'tkazilishini ta'minlash;",
      "- tinglovchilarni o'quv materiallari, texnik vositalar, kompyuter texnikalari va " +
        "kutubxonadan foydalanishini ta'minlash;",
      "- malaka oshirish kurslari yakuni bo'yicha sinovlardan muvaffaqiyatli o'tgan " +
        "tinglovchilarga belgilangan namunadagi sertifikat berish.",
      "3.2. Ijrochi tomonidan malaka oshirish kursi bitiruvchilariga elektron sertifikatlar " +
        "noyob identifikatsiya raqami va QR-kod hamda himoya elementlarini nazarda tutuvchi " +
        "“Elektron sertifikatlar repozitoriysi” tizimi orqali taqdim etiladi.",
    ],
  },
  {
    title: "4. Buyurtmachining majburiyati",
    paras: [
      "4.1. Buyurtmachi quyidagi majburiyatlarni o'z zimmasiga oladi:",
      "- malaka oshirish uchun belgilangan to'lovni o'z vaqtida amalga oshirish;",
      "- malaka oshirish kurslari bevosita mashg'ulotlarda to'liq qatnashishlarini ta'minlash " +
        "(qatnashish);",
      "- malaka oshirish kurslari offline (auditoriyaga kelib ishtirok etish) shaklda tashkil " +
        "etilganda tinglovchilarni o'quv mashg'ulotlarida bevosita shaxsan ishtirok etishini " +
        "ta'minlash (bevosita ishtirok etish);",
      "- malaka oshirish kurslari online (masofaviy) shaklida tashkil etilganda tinglovchilarni " +
        "FJSTI masofaviy ta'lim platformasiga joylashtirilgan elektron o'quv-kontentlarini " +
        "to'liq o'zlashtirishini ta'minlash (o'zlashtirish);",
      "- buyurtmachi belgilangan muddatlarda tinglovchilarni malaka oshirishga yubormagan " +
        "hollarda, tinglovchilar joriy o'quv yilining keyingi oyida o'qitiladi.",
    ],
  },
  {
    title: "5. Tomonlarning javobgarligi",
    paras: [
      "5.1. Ushbu shartnoma shartlarini bajarmaslik yoki lozim bo'lgan darajada bajarmaslik " +
        "tomonlar uchun O'zbekiston Respublikasining amaldagi qonunchiligiga muvofiq " +
        "javobgarlikni yuzaga keltiradi.",
      "5.2. Shartnoma yuzasidan vujudga keladigan har qanday nizoli masalalar, tomonlar " +
        "o'rtasida muzokara yo'li bilan hal qilinadi. Kelishuvga erishilmagan hollarda nizo " +
        "davogarning yuridik manzilida sud tartibida hal etiladi.",
      "5.3. Ushbu shartnomani bajarishda tomonlar O'zbekiston Respublikasining Fuqarolik " +
        "kodeksi, “Xo'jalik yurituvchi sub'yektlar faoliyatining shartnomaviy-huquqiy " +
        "bazasi to'g'risida”gi Qonuni va boshqa normativ-huquqiy hujjatlarga amal qiladilar.",
    ],
  },
  {
    title: "6. Shartnomaga qo'shimcha va o'zgartirishlar kiritish tartibi hamda bekor qilish",
    paras: [
      "6.1. Ushbu shartnomaga kiritilgan har qanday o'zgartirish yoki qo'shimchalar yozma " +
        "ravishda rasmiylashtirilib, har ikki tomon imzolagandan so'ng kuchga kiradi.",
      "6.2. Shartnomani muddatidan oldin bekor qilish tomonlarning kelishuvi bo'yicha yoki " +
        "qonun hujjatlarida nazarda tutilgan asoslarda va tartibda amalga oshiriladi.",
      "6.3. Shartnoma quyidagi hollarda FJSTI tomonidan bir tomonlama bekor qilinishi mumkin:",
      "- tinglovchi FJSTI nizomiga hamda «Farg'ona jamoat salomatligi tibbiyot institutida " +
        "tibbiyot va farmatsevtika kadrlarini qayta tayyorlash, malakasini oshirish tizimini " +
        "takomillashtirish chora-tadbirlari to'g'risida»gi nizomga muvofiq tinglovchilar " +
        "safidan chiqarilganda;",
      "- malaka oshirish uchun belgilangan to'lov to'liq va o'z vaqtida amalga oshirilmaganda;",
      "- offline (auditoriyaga kelib ishtirok etish) shaklda 30% mashg'ulot qoldirilsa 50% " +
        "kreditga sertifikat beriladi, to'langan mablag' qaytarilmaydi (masalan 144 kreditli " +
        "malaka oshirishda 72-kreditga sertifikat beriladi);",
      "- online (masofaviy) shaklida 25% mashg'ulotga qatnashilmasa 50% kreditga sertifikat " +
        "beriladi, to'langan mablag' qaytarilmaydi;",
      "- offline shaklda 50%, online shaklida 40% mashg'ulot uzrli sababsiz qoldirilsa " +
        "shartnoma bir tomonlama bekor qilinadi.",
      "6.4. Shartnomani bekor qilishga qaror qilgan taraf boshqa tarafga bu haqda yozma " +
        "xabarnoma yuboradi.",
    ],
  },
  {
    title: "7. Fors-major holatlari",
    paras: [
      "7.1. Taraflar ixtiyoriga bog'liq bo'lmagan, ularni oldindan bilish yoki oldini olish " +
        "imkoniyati bo'lmagan holatlar (yengib bo'lmas kuch) oqibatida majburiyatlarni " +
        "bajarmaganlik yoki lozim darajada bajarmaganlik uchun taraflarning birortasi ikkinchi " +
        "taraf oldida javobgar bo'lmaydi.",
      "7.2. O'z majburiyatlarini bajara olmayotgan taraf yengib bo'lmas kuchning mavjudligi va " +
        "uning shartnoma bo'yicha majburiyatlarni bajarishga ta'siri haqida ikkinchi tarafga " +
        "xabarnoma berishi lozim.",
    ],
  },
  {
    title: "8. Boshqa shartlar",
    paras: [
      "8.1. Buyurtmachi o'quv dasturlarini ishlab chiqish va malaka oshirish kurslariga " +
        "mutaxassislarni jalb qilish yuzasidan FJSTIga takliflar kiritishi mumkin.",
      "8.2. Tinglovchi uzrsiz sabablarga ko'ra mashg'ulotlarda qatnashmagan yoki belgilangan " +
        "o'qish muddati davomida o'quv kursi modullarini yakunlamagan, shuningdek belgilangan " +
        "tartibda FJSTI tinglovchilari safidan chiqarilgan hollarda, FJSTI hisob raqamiga " +
        "o'tkazilgan to'lov summasi Buyurtmachiga qaytarilmaydi.",
      "8.3. Masofaviy ta'lim platformasiga joylashtirilgan elektron o'quv-kontentlarini uzrli " +
        "sabablarga ko'ra o'zlashtirmagan tinglovchilar yakuniy sinov imtihoniga qo'yilmaydi.",
      "8.4. Tinglovchi yakuniy sinov imtihonidan o'ta olmagan taqdirda to'lov summasi " +
        "qaytarilmaydi.",
      "8.5. Uzrli sabab bilan malaka oshirish kursini yakuniga yetkaza olmagan tinglovchi " +
        "taraflar kelishuviga binoan navbatdagi guruh bilan birgalikda kursni yakunlashi mumkin.",
      "8.6. Yakuniy sinov imtihonida uzrli sabablarga ko'ra qatnasha olmagan tinglovchi " +
        "navbatdagi guruh bilan birgalikda kursni yakunlashi mumkin.",
      "8.7. Malaka oshirish kurslarida o'quv jarayoni, qoidaga ko'ra, 10-12 nafardan ortiq " +
        "bo'lmagan tinglovchilardan iborat akademik guruhlarda tashkil qilinadi.",
      "8.8. Tegishli baza mavjud bo'lgan taqdirda kurslar onlayn yoki oflayn shaklida tashkil " +
        "etiladi.",
      "8.9. Markaz tinglovchilarni turar-joy bilan ta'minlash majburiyatini olmaydi.",
      "8.10. Ushbu shartnomada nazarda tutilmagan barcha shartlar amaldagi qonun hujjatlari " +
        "asosida tartibga solinadi.",
    ],
  },
  {
    title: "9. Alohida shartlar",
    paras: [
      "9.1. Tomonlarning har biri mazkur shartnoma bo'yicha korrupsiyaga qarshi kurash " +
        "siyosatini olib borishni tan oladilar va tasdiqlaydilar. Barcha korrupsiyaviy " +
        "hatti-harakatlarda qatnashmaslik, jumladan pul mablag'lari yoki boshqa ko'rinishda " +
        "pora taklif qilmaslik, va'da bermaslik, shuningdek o'z vakolatlarini suiiste'mol " +
        "qilmaslik kabi talablarga amal qilishlari shart.",
    ],
  },
];

module.exports = { preamble, section1, section2, sections };
