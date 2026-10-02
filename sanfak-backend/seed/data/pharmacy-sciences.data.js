module.exports = {
  faculty: {
    title: "Farmatsiya fakulteti",
    desc: "Farmatsevtika yo'nalishi bo'yicha mutaxassislar tayyorlash fakulteti",
  },

  departments: [
    {
      title: "Ijtimoiy-gumanitar fanlar kafedrasi",
      desc: "Ijtimoiy, falsafiy va gumanitar fanlarni o'qitish kafedrasi",
      sciences: [
        { code: "OEYT1204", title: "O'zbekistonning eng yangi tarixi", desc: "O'zbekiston Respublikasi mustaqillik davri tarixi" },
        { code: "FSFI104", title: "Falsafa", desc: "Falsafa asoslari va jamiyat ilmiy tafakkuri" },
        { code: "DIN1204", title: "Dinshunoslik", desc: "Jahon dinlari tarixi va ularning jamiyatdagi o'rni" },
        { code: "JTS1106", title: "Jismoniy tarbiya va sport", desc: "Sog'lomlashtiruvchi sport mashg'ulotlari" },
        { code: "ORT1106", title: "O'zbek tilida ish yuritish", desc: "Rasmiy hujjatlarni o'zbek tilida tayyorlash" },
      ],
    },

    {
      title: "Tillar kafedrasi",
      desc: "Chet tili va lotin tili o'qitish kafedrasi",
      sciences: [
        { code: "LTFTA1205", title: "Lotin tili va farmatsevtik terminologiya asoslari", desc: "Lotin tili asoslari va dori vositalari nomenklaturasi" },
        { code: "TXT1205", title: "Tibbiyotda xorijiy til", desc: "Mutaxassislikka oid ingliz/rus tili" },
      ],
    },

    {
      title: "Noorganik va analitik kimyo kafedrasi",
      desc: "Kimyoviy analiz va noorganik birikmalar kafedrasi",
      sciences: [
        { code: "NK11212", title: "Noorganik kimyo", desc: "Noorganik birikmalarning tuzilishi va xossalari" },
        { code: "AK13411", title: "Analitik kimyo", desc: "Kimyoviy analiz usullari" },
      ],
    },

    {
      title: "Organik va fizik kimyo kafedrasi",
      desc: "Organik, fizik va kolloid kimyo kafedrasi",
      sciences: [
        { code: "OK13410", title: "Organik kimyo", desc: "Organik birikmalarning tuzilishi va sintez usullari" },
        { code: "FVKK1306", title: "Fizik va kolloid kimyo", desc: "Fizik-kimyoviy jarayonlar va kolloid sistemalar" },
        { code: "ORGS1706", title: "Organik sintez", desc: "Dori vositalari sintez usullari" },
      ],
    },

    {
      title: "Biologik kimyo va mikrobiologiya kafedrasi",
      desc: "Biokimyo, mikrobiologiya va ekologiya kafedrasi",
      sciences: [
        { code: "BK1606", title: "Biologik kimyo", desc: "Biologik jarayonlar kimyosi" },
        { code: "MKB1406", title: "Mikrobiologiya", desc: "Mikroorganizmlar va ularning xossalari" },
        { code: "EG1105", title: "Ekologiya va gigiyena", desc: "Atrof-muhit muhofazasi va sanitariya" },
      ],
    },

    {
      title: "Fiziologiya va patologiya kafedrasi",
      desc: "Odam anatomiyasi, fiziologiyasi va patologiyasi kafedrasi",
      sciences: [
        { code: "FOAAB1204", title: "Fiziologiya odam anatomiyasi asoslari bilan", desc: "Inson tanasi tuzilishi va fiziologiyasi" },
        { code: "PAT1304", title: "Patologiya", desc: "Kasalliklarning kelib chiqishi va rivojlanishi" },
      ],
    },

    {
      title: "Farmatsevtik kimyo va toksikologiya kafedrasi",
      desc: "Farmatsevtik va toksikologik kimyo kafedrasi",
      sciences: [
        { code: "FARMK15612", title: "Farmatsevtik kimyo", desc: "Dori vositalarining kimyoviy tabiati va sifati" },
        { code: "TOKK17812", title: "Toksikologik kimyo", desc: "Zaharli moddalarning kimyoviy analizi" },
        { code: "GMT11004", title: "Giyohvand moddalar tahlili", desc: "Giyohvand moddalarni aniqlash usullari" },
      ],
    },

    {
      title: "Dori vositalari tahlili kafedrasi",
      desc: "Dori vositalarining sifati va standartlari kafedrasi",
      sciences: [
        { code: "DVITU17812", title: "Dori vositalarining instrumental tahlil usullari", desc: "Zamonaviy instrumental analiz usullari" },
        { code: "DVST17808", title: "Dori vositalarini standardashtirish", desc: "Farmakopeya talablari va sifat nazorati" },
      ],
    },

    {
      title: "Farmakognoziya va farmatsevtik botanika kafedrasi",
      desc: "Dorivor o'simliklar va farmakognoziya kafedrasi",
      sciences: [
        { code: "FKGN15612", title: "Farmakognoziya", desc: "Dorivor o'simliklar va ularning mahsulotlari" },
        { code: "FBT1304", title: "Farmatsevtik botanika", desc: "Dorivor o'simliklar morfologiyasi va taksonomiyasi" },
      ],
    },

    {
      title: "Farmatsevtik texnologiya va biofarmatsiya kafedrasi",
      desc: "Dori vositalari tayyorlash va biofarmatsiya kafedrasi",
      sciences: [
        { code: "FTEX15612", title: "Farmatsevtik texnologiya", desc: "Dori vositalarini sanoat ishlab chiqarish texnologiyasi" },
        { code: "BIOF1906", title: "Biofarmatsiya", desc: "Dori vositalarining biologik mos kelishi" },
      ],
    },

    {
      title: "Farmakologiya va klinik farmatsiya kafedrasi",
      desc: "Dorilarning organizmga ta'siri va klinik qo'llanishi kafedrasi",
      sciences: [
        { code: "FKLG17810", title: "Farmakologiya", desc: "Dori vositalarining ta'sir mexanizmi" },
        { code: "KFARMK11006", title: "Klinikagacha farmakologiya", desc: "Dorilarning klinikgacha tadqiqoti" },
        { code: "KFLG191008", title: "Klinik farmakologiya", desc: "Dorilarning klinik qo'llanishi" },
        { code: "KLF11006", title: "Klinik farmatsiya", desc: "Farmatsevtning klinik amaliyoti" },
      ],
    },

    {
      title: "Klinik fanlar kafedrasi",
      desc: "Ichki kasalliklar va propedevtika kafedrasi",
      sciences: [
        { code: "IKAVP17812", title: "Ichki kasalliklar asosi va propedevtikasi", desc: "Ichki kasalliklarni aniqlash va davolash asoslari" },
      ],
    },

    {
      title: "Farmatsevtika ishini tashkil etish va iqtisodiyoti kafedrasi",
      desc: "Farmatsevtika biznesi va boshqaruvi kafedrasi",
      sciences: [
        { code: "FITQ1806", title: "Farmatsevtika ishini tashkil qilish", desc: "Dorixonalar va farmatsevtika tashkilotlari faoliyati" },
        { code: "FBOSH1906", title: "Farmatsevtikada boshqaruv", desc: "Menejment va boshqaruv asoslari" },
        { code: "FIQT191008", title: "Farmatsevtika iqtisodiyoti", desc: "Farmatsevtika bozori va iqtisodiyoti" },
        { code: "TFTV17808", title: "Tibbiyot va farmatsevtika tovarshunosligi", desc: "Tibbiy va farmatsevtik tovarlarni o'rganish" },
      ],
    },

    {
      title: "Axborot texnologiyalari kafedrasi",
      desc: "Farmatsevtikada IT va mutaxassislikka kirish kafedrasi",
      sciences: [
        { code: "FAT1105", title: "Farmatsevtikada axborot texnologiyalari", desc: "IT texnologiyalarining farmatsevtikadagi o'rni" },
        { code: "MK1104", title: "Mutaxassislikka kirish", desc: "Farmatsevt kasbi va uning jamiyatdagi o'rni" },
      ],
    },

    {
      title: "Harbiy tayyorgarlik kafedrasi",
      desc: "Harbiy va harbiy-tibbiy tayyorgarlik kafedrasi",
      sciences: [
        { code: "HT1200", title: "Harbiy tayyorgarlik", desc: "Umumiy harbiy va harbiy-tibbiy tayyorgarlik" },
      ],
    },
  ],

  directions: [
    {
      title: "Farmatsiya (farmatsevtika ishi)",
      directionCode: "60910801",
      desc: "Farmatsevtika ishi ixtisosligi bo'yicha bakalavr dasturi",
      studyPeriod: 5,
    },
    {
      title: "Farmatsiya (farmatsevtik tahlil)",
      directionCode: "60910802",
      desc: "Farmatsevtik tahlil ixtisosligi bo'yicha bakalavr dasturi",
      studyPeriod: 5,
    },
    {
      title: "Farmatsiya (klinik farmatsiya)",
      directionCode: "60910803",
      desc: "Klinik farmatsiya ixtisosligi bo'yicha bakalavr dasturi",
      studyPeriod: 5,
    },
  ],
};
