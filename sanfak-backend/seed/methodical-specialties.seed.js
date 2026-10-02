"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const SPECIALTIES = [
  ["01.01.01", "Matematik analiz"],
  ["01.01.02", "Differensial tenglamalar va matematik fizika"],
  ["01.01.03", "Hisoblash matematikasi va diskret matematika"],
  ["01.01.04", "Geometriya va topologiya"],
  ["01.01.05", "Ehtimollar nazariyasi va matematik statistika"],
  ["01.01.06", "Algebra"],
  ["01.02.01", "Nazariy mexanika"],
  ["01.02.02", "Mashinalar, asboblar va uskunalar dinamikasi va mustahkamligi"],
  ["01.02.03", "Gruntlar va tog' jinslari mexanikasi"],
  ["01.02.04", "Deformatsiyalanuvchan qattiq jism mexanikasi"],
  ["01.02.05", "Suyuqlik va gaz mexanikasi"],
  ["01.03.01", "Astronomiya"],
  ["01.04.01", "Eksperimental fizikaning asboblari va usullari"],
  ["01.04.02", "Nazariy fizika"],
  ["01.04.03", "Molekulyar fizika va issiqlik fizikasi"],
  ["01.04.04", "Fizik elektronika"],
  ["01.04.05", "Optika"],
  ["01.04.06", "Polimerlar fizikasi"],
  ["01.04.07", "Kondensirlangan holat fizikasi"],
  ["01.04.08", "Atom yadrosi va elementar zarrachalar fizikasi. Tezlashtiruvchi texnika"],
  ["01.04.09", "Magnit hodisalari fizikasi"],
  ["01.04.10", "Yarimo'tkazgichlar fizikasi"],
  ["01.04.11", "Lazer fizikasi"],

  ["02.00.01", "Noorganik kimyo"],
  ["02.00.02", "Analitik kimyo"],
  ["02.00.03", "Organik kimyo"],
  ["02.00.04", "Fizik kimyo"],
  ["02.00.05", "Sellyuloza va sellyuloza-qog'oz ishlab chiqarish kimyosi va texnologiyasi"],
  ["02.00.06", "Yuqori molekulyar birikmalar"],
  ["02.00.07", "Kompozitsion, lokbo'yoq va rezina materiallari kimyosi va texnologiyasi"],
  ["02.00.08", "Neft va gaz kimyosi va texnologiyasi"],
  ["02.00.09", "Tovarlar kimyosi"],
  ["02.00.10", "Bioorganik kimyo"],
  ["02.00.11", "Kolloid va membrana kimyosi"],
  ["02.00.12", "Nanokimyo, nanofizika va nanotexnologiya"],
  ["02.00.13", "Noorganik moddalar va ular asosidagi materiallar texnologiyasi"],
  ["02.00.14", "Organik moddalar va ular asosidagi materiallar texnologiyasi"],
  ["02.00.15", "Silikat va qiyin eriydigan nometall materiallar texnologiyasi"],
  ["02.00.16", "Kimyo texnologiyasi va oziq-ovqat ishlab chiqarish jarayonlari va apparatlari"],
  ["02.00.17", "Qishloq xo'jalik va oziq-ovqat mahsulotlariga ishlov berish, saqlash hamda qayta ishlash texnologiyalari va biotexnologiyalari"],
  ["02.00.18", "Baliqchilik mahsulotlarini qayta ishlash va saqlash texnologiyasi"],
  ["02.00.19", "Kamyob, nodir va radioaktiv elementlar texnologiyasi"],

  ["03.00.01", "Biokimyo"],
  ["03.00.02", "Biofizika va radiobiologiya"],
  ["03.00.03", "Molekulyar biologiya. Molekulyar genetika. Molekulyar biotexnologiya"],
  ["03.00.04", "Mikrobiologiya va virusologiya"],
  ["03.00.05", "Botanika"],
  ["03.00.06", "Zoologiya"],
  ["03.00.07", "O'simliklar fiziologiyasi va biokimyosi"],
  ["03.00.08", "Odam va hayvonlar fiziologiyasi"],
  ["03.00.09", "Umumiy genetika"],
  ["03.00.10", "Ekologiya"],
  ["03.00.11", "Gistologiya, sitologiya va hujayra biologiyasi"],
  ["03.00.12", "Biotexnologiya"],
  ["03.00.13", "Tuproqshunoslik"],
  ["03.00.14", "Genomika, proteomika va bioinformatika"],
  ["03.00.15", "Ixtiologiya"],
  ["03.00.16", "Gidrobiologiya"],
  ["03.00.17", "Sport fiziologiyasi, farmakologiyasi va genetikasi"],

  ["04.00.01", "Umumiy va mintaqaviy geologiya"],
  ["04.00.02", "Qattiq foydali qazilma konlarining geologiyasi, ularni qidirish va razvedka qilish. Metallogeniya va geokimyo"],
  ["04.00.03", "Geotektonika va geodinamika. Petrologiya va litologiya"],
  ["04.00.04", "Gidrogeologiya va muhandislik geologiyasi"],
  ["04.00.05", "Paleontologiya va stratigrafiya"],
  ["04.00.06", "Geofizika. Foydali qazilmalarni qidirishning geofizik usullari"],
  ["04.00.07", "Neft va gaz konlari geologiyasi, ularni qidirish va razvedka qilish"],
  ["04.00.08", "Mineralogiya. Kristallografiya"],
  ["04.00.09", "Marksheyderiya"],
  ["04.00.10", "Geotexnologiya (ochiq, er osti va qurilish)"],
  ["04.00.11", "Quduqlarni burg'ulash va o'zlashtirish texnologiyasi"],
  ["04.00.12", "Neft va gaz quvurlari, baza va omborlarini qurish hamda ishlatish"],
  ["04.00.13", "Neft va gaz konlarini o'zlashtirish hamda ishlatish"],
  ["04.00.14", "Foydali qazilmalarni boyitish"],
  ["04.00.15", "Geologik razvedka ishlari texnologiyasi va texnikasi"],
  ["04.00.16", "Konchilik mashinalari"],
  ["04.00.17", "Konchilikda fizik jarayonlar"],

  ["05.01.01", "Muhandislik geometriyasi va kompyuter grafikasi. Audio va videotexnologiyalari"],
  ["05.01.02", "Tizimli tahlil, boshqaruv va axborotni qayta ishlash"],
  ["05.01.03", "Informatikaning nazariy asoslari"],
  ["05.01.04", "Hisoblash mashinalari, majmualari va kompyuter tarmoqlarining matematik va dasturiy ta'minoti"],
  ["05.01.05", "Axborotlarni himoyalash usullari va tizimlari. Axborot xavfsizligi"],
  ["05.01.06", "Hisoblash texnikasi va boshqaruv tizimlarining elementlari va qurilmalari"],
  ["05.01.07", "Matematik modellashtirish. Sonli usullar va dasturlar majmui"],
  ["05.01.08", "Texnologik jarayonlar va ishlab chiqarishlarni avtomatlashtirish va boshqarish"],
  ["05.01.09", "Hujjatshunoslik. Arxivshunoslik. Kutubxonashunoslik"],
  ["05.01.10", "Axborot olish tizimlari va jarayonlari"],
  ["05.01.11", "Raqamli texnologiyalar va sun'iy intellekt"],
  ["05.02.01", "Mashinasozlikda materialshunoslik. Quymachilik. Metallarga termik va bosim ostida ishlov berish. Qora, rangli va noyob metallar metallurgiyasi."],
  ["05.02.02", "Mexanizmlar va mashinalar nazariyasi. Mashinashunoslik va mashina detallari"],
  ["05.02.03", "Texnologik mashinalar. Robotlar, mexatronika va robototexnika tizimlari"],
  ["05.02.04", "Standartlashtirish va mahsulotlar sifatini boshqarish"],
  ["05.02.05", "Mexanik va fiziktexnik ishlov berish texnologiyalari va jarayonlari. Stanoklar va asbobuskunalar"],
  ["05.02.06", "Konstruktsion materiallarga ishlov berish texnologiyalari va uskunalari"],
  ["05.02.07", "Mashinasozlik mashinalari, apparatlari, agregatlari va qurilmalari"],
  ["05.02.08", "Yer usti majmualari va uchish apparatlari"],
  ["05.03.01", "Asboblar. O'lchash va nazorat qilish usullari (tarmoqlar bo'yicha)"],
  ["05.03.02", "Metrologiya va metrologiya ta'minoti"],
  ["05.04.01", "Telekommunikatsiya va kompyuter tizimlari, telekommunikatsiya tarmoqlari va qurilmalari. Axborotlarni taqsimlash"],
  ["05.04.02", "Radiotexnika, radionavigatsiya, radiolokatsiya va televideniye tizimlari va qurilmalari. Mobil, tolaoptik aloqa tizimlari"],
  ["05.05.01", "Energetika tizimlari va majmualari"],
  ["05.05.02", "Elektrotexnika. Elektr energiya stansiyalari, tizimlari. Elektrotexnik majmualar va qurilmalar"],
  ["05.05.03", "Yorug'lik texnikasi. Maxsus yoritish texnologiyasi"],
  ["05.05.04", "Sanoat issiqlik energetikasi"],
  ["05.05.05", "Issiqlik texnikasining nazariy asoslari"],
  ["05.05.06", "Qayta tiklanadigan energiya turlari asosidagi energiya qurilmalari"],
  ["05.05.07", "Qishloq xo'jaligida elektr texnologiyalar va elektr uskunalar"],
  ["05.05.08", "Elektronika"],
  ["05.05.09", "Yadro energetikasi qurilmalari va texnologiyalari"],
  ["05.05.10", "Atom reaktorsozligi, atom sanoati mashinalari, agregatlari va materiallari texnologiyasi"],
  ["05.05.11", "Vodorod energetikasi texnologiyalari"],
  ["05.06.01", "To'qimachilik va engil sanoat ishlab chiqarishlari materialshunosligi"],
  ["05.06.02", "To'qimachilik materiallari texnologiyasi va xomashyoga dastlabki ishlov berish"],
  ["05.06.03", "Teri, mo'yna, poyabzal va teri-galantereya buyumlari texnologiyasi"],
  ["05.06.04", "Tikuvchilik buyumlari texnologiyasi va kostyum dizayni"],
  ["05.07.01", "Qishloq xo'jaligi va melioratsiya mashinalari. Qishloq xo'jaligi va melioratsiya ishlarini mexanizatsiyalash"],
  ["05.07.02", "Qishloq xo'jaligi va melioratsiya texnikalarini ishlatish, tiklash va ta'mirlash"],
  ["05.08.01", "Mamlakat, uning mintaqa, shahar va sanoat markazlarining transport tizimlari. Transport logistikasi"],
  ["05.08.02", "Temir yo'llar va yo'l xo'jaligi"],
  ["05.08.03", "Temir yo'l transportini ishlatish"],
  ["05.08.04", "Navigatsiya va havo yo'llari harakatini boshqarish"],
  ["05.08.05", "Temir yo'llarning harakatlanuvchi tarkibi, poyezdlarni tortish va elektrlashtirish"],
  ["05.08.06", "G'ildirakli va gusenitsali mashinalar va ularni ishlatish"],
  ["05.09.01", "Qurilish konstruksiyalari, bino va inshootlar"],
  ["05.09.02", "Asoslar, poydevor va er osti inshootlari. Ko'prik va transport tonnellari. Yo'llar, metropolitenlar"],
  ["05.09.03", "Issiqlik ta'minoti. Ventilyatsiya, konditsionerlash. Gaz ta'minoti va yoritish"],
  ["05.09.04", "Suv ta'minoti. Kanalizatsiya. Suv havzalarini muhofazalovchi qurilish tizimlari"],
  ["05.09.05", "Qurilish materiallari va buyumlari"],
  ["05.09.06", "Gidrotexnika va melioratsiya qurilishi"],
  ["05.09.07", "Gidravlika va muhandislik gidrologiyasi"],
  ["05.09.08", "Qurilish texnologiyasi va qurilish jarayonlarini tashkil qilish"],
  ["05.10.01", "Mehnatni muhofaza qilish va inson faoliyati xavfsizligi"],
  ["05.10.02", "Favqulodda holatlarda xavfsizlik. Yong'in, sanoat, yadro va radiatsiya xavfsizligi"],

  ["06.01.01", "Umumiy dehqonchilik. Paxtachilik"],
  ["06.01.02", "Melioratsiya va sug'orma dehqonchilik"],
  ["06.01.03", "Agrotuproqshunoslik va agrofizika"],
  ["06.01.04", "Agrokimyo"],
  ["06.01.05", "Selektsiya va urug'chilik"],
  ["06.01.06", "Sabzavotchilik"],
  ["06.01.07", "Mevachilik va uzumchilik"],
  ["06.01.08", "O'simlikshunoslik"],
  ["06.01.09", "O'simliklarni himoya qilish"],
  ["06.01.10", "Yer tuzish, kadastr va er monitoringi"],
  ["06.01.11", "Qishloq xo'jaligi mahsulotlarini saqlash va qayta ishlash"],
  ["06.02.01", "Qishloq xo'jaligi hayvonlarini urchitish, ko'paytirish, seleksiyasi va genetikasi. Qorako'lchilik"],
  ["06.02.02", "Qishloq xo'jaligi hayvonlarini oziqlantirish va ozuqa tayyorlash texnologiyasi"],
  ["06.02.03", "Xususiy zootexniya. Chorvachilik mahsulotlarini ishlab chiqarish texnologiyasi"],
  ["06.02.04", "Ipakchilik"],
  ["06.02.05", "Baliqchilik"],
  ["06.03.01", "O'rmon ekinlari. Selektsiya, urug'chilik va shaharlarni ko'kalamzorlashtirish. O'rmonlar agromelioratsiyasi va himoya o'rmonlarini barpo etish"],
  ["06.03.02", "O'rmon tuzish va o'rmon taksatsiyasi. O'rmonshunoslik va o'rmonchilik. O'rmon yong'inlari va ularga qarshi kurashish"],
  ["06.03.03", "Dorivor o'simliklar introduksiyasi, etishtirish texnologiyasi va agrofarmoekologiyasi"],

  ["07.00.01", "O'zbekiston tarixi"],
  ["07.00.02", "Fan va texnologiyalar tarixi"],
  ["07.00.03", "Jahon tarixi"],
  ["07.00.04", "Dinshunoslik"],
  ["07.00.05", "Xalqaro munosabatlar va tashqi siyosat tarixi"],
  ["07.00.06", "Arxeologiya"],
  ["07.00.07", "Etnografiya, etnologiya va antropologiya"],
  ["07.00.08", "Tarixshunoslik, manbashunoslik va tarixiy tadqiqot usullari"],

  ["08.00.01", "Iqtisodiyot nazariyasi"],
  ["08.00.02", "Makroiqtisodiyot"],
  ["08.00.03", "Sanoat iqtisodiyoti"],
  ["08.00.04", "Qishloq xo'jaligi iqtisodiyoti"],
  ["08.00.05", "Xizmat ko'rsatish tarmoqlari iqtisodiyoti"],
  ["08.00.06", "Ekonometrika va statistika"],
  ["08.00.07", "Moliya, pul muomalasi va kredit"],
  ["08.00.08", "Buxgalteriya hisobi, iqtisodiy tahlil va audit"],
  ["08.00.09", "Jahon iqtisodiyoti"],
  ["08.00.10", "Demografiya. Mehnat iqtisodiyoti"],
  ["08.00.11", "Marketing"],
  ["08.00.12", "Mintaqaviy iqtisodiyot"],
  ["08.00.13", "Menejment"],
  ["08.00.14", "Iqtisodiyotda axborot tizimlari va texnologiyalari"],
  ["08.00.15", "Tadbirkorlik va kichik biznes iqtisodiyoti"],
  ["08.00.16", "Raqamli iqtisodiyot va halqaro raqamli integratsiya"],
  ["08.00.17", "Turizm va mehmonxona faoliyati"],

  ["09.00.01", "Ontologiya, gnoseologiya va mantiq"],
  ["09.00.02", "Ong, madaniyat va amaliyot shakllari falsafasi (nomi)"],
  ["09.00.03", "Falsafa tarixi"],
  ["09.00.04", "Ijtimoiy falsafa"],
  ["09.00.05", "Milliy g'oya targ'iboti texnologiyalari"],
  ["09.00.06", "G'oyalar tarixi va metodologiyasi"],
  ["09.00.07", "Ma'naviyat tarixi va nazariyasi"],
  ["09.00.08", "Ma'naviy tarbiya"],
  ["09.00.09", "Ma'naviy jarayonlar va texnologiyalar"],

  ["10.00.01", "O'zbek tili"],
  ["10.00.02", "O'zbek adabiyoti"],
  ["10.00.03", "Qoraqalpoq tili"],
  ["10.00.04", "Yevropa, Amerika va Avstraliya xalqlari tili va adabiyoti"],
  ["10.00.05", "Osiyo va Afrika xalqlari tili va adabiyoti"],
  ["10.00.06", "Qiyosiy adabiyotshunoslik, chog'ishtirma tilshunoslik va tarjimashunoslik"],
  ["10.00.07", "Adabiyot nazariyasi"],
  ["10.00.08", "Folklorshunoslik"],
  ["10.00.09", "Jurnalistika"],
  ["10.00.10", "Matnshunoslik va adabiy manbashunoslik"],
  ["10.00.11", "Til nazariyasi. Amaliy va kompyuter lingvistikasi"],
  ["10.00.12", "Qoraqalpoq adabiyoti"],

  ["11.00.01", "Tabiiy geografiya"],
  ["11.00.02", "Iqtisodiy va ijtimoiy geografiya"],
  ["11.00.03", "Quruqlik gidrologiyasi. Suv resurslari. Gidrokimyo"],
  ["11.00.04", "Meteorologiya. Iqlimshunoslik. Agrometeorologiya Geografiya fanlari Fizika-matematika fanlari"],
  ["11.00.05", "Atrof-muhitni muhofaza qilish va tabiiy resurslardan oqilona foydalanish Geografiya fanlari Fizika-matematika fanlari"],
  ["11.00.06", "Geodeziya. Kartografiya Geografiya fanlari Texnika fanlari Fizika-matematika fanlari"],
  ["11.00.07", "Geoinformatika"],

  ["12.00.01", "Davlat va huquq nazariyasi va tarixi. Huquqiy ta'limotlar tarixi"],
  ["12.00.02", "Konstitutsiyaviy huquq. Ma'muriy huquq. Moliya va bojxona huquqi"],
  ["12.00.03", "Fuqarolik huquqi. Tadbirkorlik huquqi. Oila huquqi. Xalqaro xususiy huquq"],
  ["12.00.04", "Fuqarolik protsessual huquqi. Xo'jalik protsessual huquqi. Hakamlik jarayoni va mediatsiya"],
  ["12.00.05", "Mehnat huquqi. Ijtimoiy ta'minot huquqi"],
  ["12.00.06", "Tabiiy resurslar huquqi. Agrar huquq. Ekologik huquq"],
  ["12.00.07", "Sud hokimiyati. Prokuror nazorati. Huquqni muhofaza qilish faoliyatini tashkil etish. Advokatura"],
  ["12.00.08", "Jinoyat huquqi. Kriminologiya. Jinoyat-ijroiya huquqi"],
  ["12.00.09", "Jinoyat protsessi. Kriminalistika, tezkor-qidiruv huquq va sud ekspertizasi"],
  ["12.00.10", "Xalqaro huquq"],
  ["12.00.11", "Parlament huquqi"],
  ["12.00.12", "Korruptsiya muammolari"],
  ["12.00.13", "Inson huquqlari"],
  ["12.00.14", "Huquqbuzarliklar profilaktikasi. Jamoat xavfsizligini ta'minlash. Probatsiya faoliyati"],

  ["13.00.01", "Pedagogika nazariyasi. Pedagogik ta'limotlar tarixi"],
  ["13.00.02", "Ta'lim va tarbiya nazariyasi va metodikasi (sohalar bo'yicha)"],
  ["13.00.03", "Maxsus pedagogika"],
  ["13.00.04", "Jismoniy tarbiya va sport mashg'ulotlari nazariyasi va metodikasi"],
  ["13.00.05", "Kasb-hunar ta'limi nazariyasi va metodikasi"],
  ["13.00.06", "Elektron ta'lim nazariyasi va metodikasi (ta'lim sohalari va bosqichlari bo'yicha)"],
  ["13.00.07", "Ta'limda menejment"],
  ["13.00.08", "Maktabgacha ta'lim va tarbiya nazariyasi va metodikasi"],
  ["13.00.09", "Ijtimoiy pedagogika"],

  ["14.00.01", "Akusherlik va ginekologiya"],
  ["14.00.02", "Morfologiya"],
  ["14.00.03", "Endokrinologiya"],
  ["14.00.04", "Otorinolaringologiya"],
  ["14.00.05", "Ichki kasalliklar"],
  ["14.00.06", "Kardiologiya"],
  ["14.00.07", "Gigiyena"],
  ["14.00.08", "Oftalmologiya"],
  ["14.00.09", "Pediatriya"],
  ["14.00.10", "Yuqumli kasalliklar"],
  ["14.00.11", "Dermatologiya va venerologiya"],
  ["14.00.12", "Tibbiy reabilitologiya"],
  ["14.00.13", "Nevrologiya"],
  ["14.00.14", "Onkologiya"],
  ["14.00.15", "Patologik anatomiya"],
  ["14.00.16", "Normal va patologik fiziologiya"],
  ["14.00.17", "Farmakologiya va klinik farmakologiya"],
  ["14.00.18", "Psixiatriya va narkologiya"],
  ["14.00.19", "Klinik radiologiya"],
  ["14.00.20", "Tibbiy genetika"],
  ["14.00.21", "Stomatologiya"],
  ["14.00.22", "Travmatologiya va ortopediya"],
  ["14.00.23", "Hamshiralik ishini tashkil etish"],
  ["14.00.24", "Sud tibbiyoti"],
  ["14.00.25", "Klinik-laborator va funksional diagnostika"],
  ["14.00.26", "Ftiziatriya"],
  ["14.00.27", "Xirurgiya"],
  ["14.00.28", "Neyroxirurgiya"],
  ["14.00.29", "Gematologiya va transfuziologiya"],
  ["14.00.30", "Epidemiologiya"],
  ["14.00.31", "Urologiya"],
  ["14.00.32", "Transplantologiya va sun'iy a'zolar"],
  ["14.00.33", "Jamiyat salomatligi. Sog'liqni saqlashda menejment"],
  ["14.00.34", "Yurak-qon tomir xirurgiyasi"],
  ["14.00.35", "Bolalar xirurgiyasi"],
  ["14.00.36", "Allergologiya va immunologiya"],
  ["14.00.37", "Anesteziologiya va reanimatologiya"],
  ["14.00.38", "Sport tibbiyoti"],
  ["14.00.39", "Toksikologiya"],
  ["14.00.40", "Shoshilinch tibbiyot"],
  ["14.00.41", "Xalq tabobati"],
  ["14.00.42", "Pulmonologiya"],
  ["14.00.43", "Profilaktik tibbiyot"],

  ["15.00.01", "Dori texnologiyasi"],
  ["15.00.02", "Farmatsevtik kimyo va farmakognoziya"],
  ["15.00.03", "Farmatsevtika ishini tashkil etish"],

  ["16.00.01", "Hayvonlar kasalliklari diagnostikasi, terapiyasi va xirurgiyasi"],
  ["16.00.02", "Hayvonlar patologiyasi, onkologiyasi va morfologiyasi. Veterinar akusherligi va hayvonlar reproduksiyasi biotexnikasi"],
  ["16.00.03", "Veterinariya mikrobiologiyasi, virusologiyasi, epizootologiyasi, mikologiyasi, mikotoksikologiyasi va immunologiyasi"],
  ["16.00.04", "Veterinariya farmakologiyasi va toksikologiyasi. Veterinariya sanitariyasi, ekologiyasi, zoogigiyenasi va veterinar-sanitariya ekspertizasi"],

  ["17.00.01", "Teatr san'ati"],
  ["17.00.02", "Musiqa san'ati"],
  ["17.00.03", "Kino san'ati. Televideniye"],
  ["17.00.04", "Tasviriy va amaliy bezak san'ati"],
  ["17.00.05", "Dizayn nazariyasi va tarixi"],
  ["17.00.06", "Muzeyshunoslik. Tarixiy-madaniy ob'yektlarni konservatsiya qilish, ta'mirlash va saqlash"],
  ["17.00.07", "Madaniyat nazariyasi va tarixi. Madaniyatshunoslik"],
  ["17.00.08", "San'at nazariyasi va tarixi"],

  ["18.00.01", "Arxitektura nazariyasi va tarixi. Arxitektura yodgorliklarini ta'mirlash va tiklash"],
  ["18.00.02", "Rayonlashtirish. Shaharsozlik. Qishloq turar joylarini rejalashtirish. Landshaft arxitekturasi. Bino va inshootlar arxitekturasi"],

  ["19.00.01", "Psixologiya tarixi va nazariyasi. Umumiy psixologiya. Shaxs psixologiyasi"],
  ["19.00.02", "Psixofiziologiya"],
  ["19.00.03", "Inson kasbiy faoliyati psixologiyasi (nomi)"],
  ["19.00.04", "Tibbiy psixologiya"],
  ["19.00.05", "Ijtimoiy psixologiya. Etnopsixologiya"],
  ["19.00.06", "Yosh va pedagogik psixologiya. Rivojlanish psixologiyasi"],
  ["19.00.07", "Din psixologiyasi"],
  ["19.00.08", "Maxsus psixologiya (jismoniy va aqliy zaiflarni rivojlanishining psixologik xususiyatlari)"],

  ["21.01.02", "Strategiya (jumladan qurolli kuchlar boshqaruvi, strategik yoyilish, strategik operatsiyalar (jangovar harakatlar) va ularning barcha ko'rinishdagi ta'minoti, davlatning harbiy xavfsizligi aspektlari, harbiy siyosatshunoslik)"],
  ["21.01.03", "Yaxlit operativ san'at, qurolli kuchlar turlari, qo'shin turlari va maxsus qismlar bo'yicha (jumladan boshqaruv va jangning barcha ko'rinishdagi ta'minoti)"],
  ["21.01.04", "Umumiy taktika, qurolli kuchlar ko'rinishlari, qo'shin turlari va maxsus qismlar bo'yicha (jumladan boshqaruv va jangning barcha ko'rinishdagi ta'minoti)"],
  ["21.01.05", "Qurolli kuchlar qurilishi (jumladan qurolli kuchlar turlari, qurolli kuchlar front orti, qo'shin turlari va maxsus qismlar bo'yicha)"],
  ["21.01.06", "Harbiy ta'lim va tarbiya, jangovar tayyorgarlik, kadrlarni tanlash va joylashtirish, qo'shinlarlarning kundalik faoliyatini boshqarish (jumladan qurolli kuchlar turlari, qurolli kuchlar front orti, qo'shin turlari va maxsus qismlar bo'yicha)"],
  ["21.01.08", "Qurolli kuchlar front orti (jumladan qurolli kuchlar turlari, qo'shin turlari va maxsus qismlar bo'yicha)"],
  ["21.01.09", "Boshqaruv va aloqaning harbiy tizimlari"],
  ["21.01.10", "Harbiy razvedka"],
  ["21.01.11", "Chet el armiya va davlatlari, ularning salohiyatlari"],
  ["21.02.03", "Harbiy huquq, xalqaro huquqning harbiy muammolari"],
  ["21.02.05", "Operatsion (taktik) yo'nalish, qo'shinlar pozitsiyalari va joylashish xududlarining muhandislik uskunalari, fortifikatsiya, maskirovka"],
  ["21.02.09", "Qo'shinlar jangovar harakatlarining gidrometeorologik va topogeodezik ta'minoti Harbiy fanlar Texnika fanlari Fizika-matematika fanlari"],
  ["21.02.12", "Harbiy kibernetika, tizimli tahlil, operatsiyalar tadqiqoti, jangovar harakatlar va harbiy tizimlarni modellashtirish (jumladan qurolli kuchlar turlari, qo'shin turlari va maxsus qismlar bo'yicha)"],
  ["21.02.13", "Harbiy ishda informatika va kompyuter texnologiyalari"],
  ["21.02.14", "Qurol-aslaha va harbiy texnika, harbiy majmua va tizimlar (jumladan qurolli kuchlar turlari, qo'shin turlari va maxsus qismlar bo'yicha)"],
  ["21.02.17", "Qurol-aslaha va harbiy texnikani ishlatish va qayta tiklash, texnik ta'minot (jumladan qurolli kuchlar turlari, qurolli kuchlar front orti, qo'shin turlari va maxsus qismlar bo'yicha"],
  ["21.02.22", "Harbiy tarix"],
  ["21.02.23", "Harbiy tibbiyot"],
  ["21.02.24", "Fuqarolar himoyasi. Favqulodda holatlarning oldini olish hamda ularni bartaraf etish vositalari va usullari"],
  ["21.02.25", "Harbiy elektronika, harbiy majmualar apparatlari"],

  ["22.00.01", "Sotsiologiya nazariyasi, metodologiyasi va tarixi. Sotsiologik tadqiqotlar usullari"],
  ["22.00.02", "Ijtimoiy tuzilish, ijtimoiy institutlar va turmush tarzi"],
  ["22.00.03", "Ijtimoiy ong va ijtimoiy jarayonlar sotsiologiyasi"],
  ["22.00.04", "Gender tadqiqotlari"],

  ["23.00.01", "Siyosat nazariyasi va falsafasi. Siyosiy ta'limotlar tarixi va metodologiyasi"],
  ["23.00.02", "Siyosiy institutlar, jarayonlar va texnologiyalar"],
  ["23.00.03", "Siyosiy madaniyat va mafkura"],
  ["23.00.04", "Xalqaro munosabatlar, jahon va mintaqa taraqqiyotining siyosiy muammolari"],
  ["23.00.05", "Milliy xavfsizlik muammolarining tizimli tahlili va prognozlashtirish"],

  ["24.00.01", "Islom tarixi va manbashunosligi"],
  ["24.00.02", "Qur'onshunoslik. Hadisshunoslik Islomshunoslik fanlari Tarix fanlari Falsafa fanlari Filologiya fan­ lari"],
  ["24.00.03", "Fiqh, kalom ilmi. Ilohiyot"],
  ["24.00.04", "Mumtoz sharq adabiyoti va manbashunosligi"],
];

const norm = (s = "") => String(s).trim().toLowerCase().replace(/\s+/g, "");

const key = (code, name) => norm(code) + "|" + norm(name);

function missingSpecialties(existing = [], wanted = SPECIALTIES) {
  const have = new Set(existing.map((d) => key(d.code, d.name)));
  return wanted.filter(([c, n]) => !have.has(key(c, n)));
}

function obsoleteSpecialties(existing = [], wanted = SPECIALTIES) {
  const ok = new Set(wanted.map(([c, n]) => key(c, n)));
  return existing.filter((d) => !ok.has(norm(d.code) + "|" + norm(d.name)));
}

async function main() {
  const dry = process.argv.includes("--dry");

  await mongoose.connect(process.env.MONGO_HOST);
  console.log("MongoDB:", mongoose.connection.name);
  if (dry) console.log("  [--dry] hech narsa yozilmaydi");

  const Model = require("../src/modules/4.10-scientificDept/methodicalSpecialty/methodicalSpecialty.model");
  const Rec = require("../src/modules/4.10-scientificDept/methodicalRecommendation/methodicalRecommendation.model");

  const existing = await Model.find({}, { code: 1, name: 1 }).lean();
  console.log(
    "  lug'atda hozir: " + existing.length + " ta   (rasmiy ro'yxat: " + SPECIALTIES.length + " ta)",
  );

  const missing = missingSpecialties(existing);
  console.log("  qo'shiladi: " + missing.length + " ta");
  if (!dry && missing.length) {
    await Model.insertMany(
      missing.map(([code, name]) => ({ code, name, active: true })),
      { ordered: false },
    );
  }

  const obsolete = obsoleteSpecialties(existing);
  console.log("  eskirgan yozuv: " + obsolete.length + " ta");
  if (!obsolete.length) {
    console.log("\n  lug'at rasmiy ro'yxatga mos — o'chiriladigan yozuv yo'q");
    await mongoose.disconnect();
    process.exit(0);
  }

  const wantedByName = new Map(SPECIALTIES.map(([code, name]) => [norm(name), { code, name }]));

  const keep = [];
  const remove = [];

  for (const old of obsolete) {
    const links = await Rec.countDocuments({ specialty: old._id });
    const target = wantedByName.get(norm(old.name));

    if (!links) {
      remove.push(old);
      console.log("     - " + old.code + " — " + old.name + "   (bog'lanish yo'q)");
      continue;
    }
    if (!target) {
      keep.push(old);
      console.log(
        "     ! " + old.code + " — " + old.name + "   (" + links +
          " ta tavsiyanoma bog'langan, rasmiy ro'yxatda bunday nom yo'q" +
          " -> NOFAOL qilinadi, o'chirilmaydi)",
      );
      continue;
    }
    console.log(
      "     ~ " + old.code + " — " + old.name + "   (" + links + " ta tavsiyanoma -> " +
        target.code + " — " + target.name + ")",
    );
    if (!dry) {
      const replacement = await Model.findOne({ code: target.code, name: target.name })
        .select("_id")
        .lean();
      if (!replacement) {
        throw new Error("almashtiruvchi topilmadi: " + target.code + " — " + target.name);
      }
      await Rec.updateMany({ specialty: old._id }, { $set: { specialty: replacement._id } });
    }
    remove.push(old);
  }

  if (!dry) {
    if (remove.length) {
      await Model.deleteMany({ _id: { $in: remove.map((d) => d._id) } });
    }
    if (keep.length) {
      await Model.updateMany({ _id: { $in: keep.map((d) => d._id) } }, { $set: { active: false } });
    }
  }

  console.log(
    "\n  o'chirildi: " + (dry ? 0 : remove.length) + " ta   nofaol: " + (dry ? 0 : keep.length) +
      " ta   lug'atdagi jami: " + (dry ? "(dry)" : await Model.countDocuments()),
  );

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\n[METHODICAL SPECIALTIES SEED ERROR]", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = { SPECIALTIES, missingSpecialties, obsoleteSpecialties, norm };
