# DEPLOY — tinglovchi kabineti (pm2 + nginx)

Malaka oshirish modulining tinglovchi kabineti — SANFAK tizimining alohida ilovasi: o'z backendi (Node/Express,
socket.io, MongoDB) va frontendi (React/Vite) bor. Kurslar, arizalar, to'lovlar va testlar ma'lumotini u **asosiy
backend** (`sanfak-backend`) dan server-server kanali orqali oladi, shuning uchun avval asosiy tizim o'rnatilgan va
ishlab turgan bo'lishi kerak. Asosiy tizim qo'llanmasi — `sanfak-backend` arxividagi `docs/DEPLOY.md` (quyida —
**asosiy qo'llanma**).

`fjsti-tinglovchi.zip` arxivi ichida bitta `fjsti-tinglovchi/` papkasi bor:
- `backend/` — API, socket.io va frontend build'ini uzatadigan server; pm2 bilan ishlaydi (pm2 nomi `tinglovchi`)
- `frontend/` — Vite loyihasi; `npm run build` natijasi `backend/public/build/` ga ko'chiriladi va backend uni API
  bilan bir xil origin'dan o'zi uzatadi (§4)
- `DEPLOY.md` — shu qo'llanma

Serverdagi joyi: `/srv/fjsti/tinglovchi` (ichida `backend/` va `frontend/`). Docker ishlatilmaydi. Paket menejeri —
**npm** (ikkala papkada `package-lock.json`); yarn ishlatmang.

---

## 0. Umumiy sxema

```
tinglovchi brauzeri
   │  https://<tinglovchi-domeni>   (sahifa, /api, /socket.io/)
   ▼
nginx :443 ──► 127.0.0.1:4500  tinglovchi backend [pm2: tinglovchi] ──► MongoDB: listener-db
                   │    ▲
   MAIN_API_URL    │    │   LISTENER_API_URL
   (+ socket.io)   ▼    │
             127.0.0.1:4000  asosiy backend [pm2: institute-ais] ──► MongoDB: institute-ais

tinglovchi brauzeri ──► https://<asosiy-domen>/files/...   (hujjat, video, rasm — to'g'ridan asosiy domendan)
```

| Qism | Serverdagi joyi | Port | pm2 nomi |
|---|---|---|---|
| Tinglovchi backend (API + socket.io + frontend build) | `/srv/fjsti/tinglovchi/backend` | 4500 | `tinglovchi` |
| Tinglovchi frontend (faqat build manbasi) | `/srv/fjsti/tinglovchi/frontend` | — | — |
| Asosiy backend | `/srv/fjsti/backend` | 4000 | `institute-ais` |

**Ikki backend o'rtasidagi aloqa.** Ikkala yo'nalish ham kerak va ikkalasida bitta kalit — `SERVICE_KEY`
(`X-Service-Key` sarlavhasi) ishlatiladi:

| Yo'nalish | Manzil | Nima uchun |
|---|---|---|
| portal → asosiy | `MAIN_API_URL` (portal `.env`) | kurs, ariza, shartnoma va to'lov, o'quv materiallari va test sahifalari (so'rov asosiy backendga uzatiladi, fayl yuklash ham); yangi tinglovchini tekshirish; tinglovchilar ro'yxatini sinxronlash (ishga tushishda va har 10 daqiqada); mavzu progressi; chatdagi ismlar va o'qituvchiga real-time yetkazish; socket.io ko'prigi (onlayn holat, «yozmoqda») |
| asosiy → portal | `LISTENER_API_URL` (asosiy `.env`) | o'qituvchi tomonidagi Malaka oshirish chati: suhbatlar, xabarlar, yuborish, o'chirish |

**Qaysi ma'lumot qayerda:**

| Ma'lumot | Qayerda |
|---|---|
| Tinglovchilar ro'yxati (kirish uchun) | `listener-db.listeners` — asosiy tizimdagi tinglovchi kartochkalaridan avtomatik to'ldiriladi |
| Mavzular bo'yicha progress | `listener-db.topiccompletions`; har o'zgarish asosiy tizimga ham yoziladi |
| Tinglovchi ↔ o'qituvchi chati | 🔴 **faqat** `listener-db.chatmessages` — boshqa nusxasi yo'q, zaxira shart (§7) |
| Portal orqali asosiy tizimga yuborilgan yozuvlar nusxasi | `listener-db.writemirrors`, `listener-db.mirroroutboxes` |
| Kurslar, arizalar, shartnoma va to'lovlar, test natijalari, sertifikatlar, tinglovchi kartochkalari | asosiy baza |
| Yuklangan fayllar (ariza hujjatlari, to'lov kvitansiyasi, ssenariy fayli) | asosiy backend `uploads/`. Portal faylni o'zida saqlamaydi — yuklash so'rovini asosiy backendga uzatadi |

**Kirish.** Tinglovchi faqat 14 xonali JSHSHIR (PIN) bilan kiradi — parol va ikkinchi bosqich yo'q. Kirish uchun
asosiy tizimda shu JSHSHIR bo'yicha tinglovchi kartochkasi (menejer arizani qabul qilganda yaratiladi) yoki qabul
qilingan ariza bo'lishi kerak. Portal bazasida hali yo'q JSHSHIR birinchi kirishda asosiy backenddan tekshiriladi va
portal bazasiga qo'shiladi.

**Domen.** Portal o'z (sub)domenining ildizida ishlaydi (masalan `https://tinglovchi.<domen>`). Asosiy domenning
ichki yo'lida (`https://<asosiy-domen>/tinglovchi`) ishlamaydi: frontend `/assets/`, `/logo.png`, `/login` kabi
yo'llarni ildizdan so'raydi, asosiy tizim esa `/api`, `/socket.io/`, `/assets/` yo'llarini o'zi band qilgan.

**Alohida serverlar.** Qo'llanma ikkala backend bitta serverda turgan holat uchun yozilgan: ular bir-biriga
`127.0.0.1` orqali, nginx'siz murojaat qiladi. Ular alohida serverlarda bo'lsa: `MAIN_API_URL=https://<asosiy-domen>/api`
va `LISTENER_API_URL=https://<tinglovchi-domeni>/api` — faqat HTTPS (bu kanal orqali xizmat kaliti va tinglovchilarning
JSHSHIR ro'yxati o'tadi). Bunda asosiy nginx'dagi `client_max_body_size` (namunada `25M`) portal orqali yuklanadigan
fayllarni ham cheklaydi. Qo'llanmadagi bir qator buyruqlar asosiy `.env` ni `/srv/fjsti/backend/.env` dan o'qiydi
(§2.1, §2.2, §3 dagi `grep`/`diff`, §6 dagi chat ko'chirish, §8 dagi asosiy → portal tekshiruvi): alohida serverlarda
asosiy `.env` ga tegishli tekshiruvlarni asosiy serverda bajaring, `SERVICE_KEY` va `FILE_URL_SECRET` qiymatlarini esa
portal `.env` iga himoyalangan kanal (`ssh`) orqali qo'lda ko'chiring. Portal serveriga Node.js, nginx, certbot, pm2 va
(portal bazasi shu serverda bo'lsa) MongoDB asosiy qo'llanmaning «1. Server talablari» bo'limi bo'yicha o'rnatiladi.

---

## 1. Talablar

Qo'llanma bo'yicha portal asosiy tizim bilan bir serverda ishlaydi (§0, «Alohida serverlar») va asosiy qo'llanmaning
«1. Server talablari» bo'limi bo'yicha o'rnatilgan dasturlardan foydalanadi:

| Komponent | Versiya | Izoh |
|---|---|---|
| Node.js | asosiy tizim bilan bir xil (**20.19 yoki yangiroq**) | `package.json` da `engines` ko'rsatilmagan; frontend bog'liqliklari Node 20+ talab qiladi. Node 20 da frontend `npm ci` bitta ixtiyoriy paket uchun `EBADENGINE` ogohlantirishini chiqarishi mumkin — o'rnatish to'xtamaydi |
| npm | 7+ (Node bilan keladi) | `package-lock.json` bo'yicha `npm ci` ishlatiladi. yarn lock-faylni hisobga olmaydi — ishlatmang |
| MongoDB | asosiy tizim ishlatayotgan server (6+) | portal ma'lumoti alohida bazada (`listener-db`) |
| nginx, certbot | asosiy qo'llanma bo'yicha | portal uchun alohida `server` bloki (§5) |
| pm2 | asosiy tizimdagi | asosiy qo'llanma §1 dagi `pm2-logrotate` portal loglarini ham aylantiradi |
| DNS | — | `<tinglovchi-domeni>` ning A-yozuvi shu serverga |
| Asosiy tizim | ishlab turgan, ommaviy HTTPS domeni bilan | tinglovchilar hujjat va videolarni brauzerda to'g'ridan asosiy domendan ochadi — asosiy domen internetdan ochiq bo'lishi kerak |

---

## 2. Asosiy backend tomonida sozlash

Portalni ishga tushirishdan **OLDIN** asosiy backendda quyidagilar bo'lishi kerak.

### 2.1. `.env` kalitlari (`/srv/fjsti/backend/.env`)

`SERVICE_KEY` va `LISTENER_API_URL` asosiy `.env.example` da yo'q — `cp .env.example .env` ularni qo'shmaydi,
qatorlarni qo'lda qo'shing.

| Kalit | Qiymat | Izoh |
|---|---|---|
| `SERVICE_KEY` | `openssl rand -hex 32` | portal `.env` idagi `SERVICE_KEY` bilan **harfma-harf bir xil**. Kamida 32 belgi — portal qisqa yoki namuna qiymat bilan ishga tushmaydi. `SAMS_SERVICE_KEY` dan farqli bo'lishi shart. Bo'sh yoki farqli bo'lsa asosiy backend portal so'rovlariga `401 Service kaliti yaroqsiz` qaytaradi |
| `LISTENER_API_URL` | `http://127.0.0.1:4500/api` | oxiridagi `/api` **shart**. Bo'sh bo'lsa o'qituvchi tomonidagi Malaka oshirish chati `500 LISTENER_API_URL sozlanmagan` qaytaradi, qolgan modullar ishlayveradi |
| `FILE_URL_SECRET` | asosiy qo'llanma bo'yicha qo'yilgan qiymat | bo'lsa, portal `.env` iga **aynan shu qiymat** ko'chiriladi (§3). Bo'sh bo'lsa — faqat portal uchun qo'shmang, pastdagi izohga qarang |
| `PUBLIC_BASE_URL` | `https://<asosiy-domen>` | asosiy qo'llanmada majburiy. Portal orqali yuklangan fayllar havolasi shu manzil bilan quriladi; bo'sh bo'lsa portaldan fayl yuklash `400 Host ruxsat etilmagan` bilan tugaydi |

Qaysi kalit borligini tekshirish (qiymatlar ekranga chiqmaydi):

```bash
cd /srv/fjsti/backend
for k in SERVICE_KEY LISTENER_API_URL FILE_URL_SECRET PUBLIC_BASE_URL; do
  grep -qE "^$k=.+" .env && echo "$k: bor" || echo "$k: YO'Q yoki bo'sh"; done
grep -qE '^FILE_URL_SECRET=CHANGE_ME$' .env && echo "FILE_URL_SECRET: namuna qiymat — pastdagi izohga qarang"
grep -qE '^PUBLIC_BASE_URL=https://example\.uz/?$' .env && echo "PUBLIC_BASE_URL: namuna qiymat — https://<asosiy-domen> yozing"
```

`SERVICE_KEY` va `LISTENER_API_URL` ni qo'shish — bo'sh qatorlari olib tashlanadi, qiymati bor kalitga tegilmaydi:

```bash
cd /srv/fjsti/backend
sed -i '/^SERVICE_KEY=$/d; /^LISTENER_API_URL=$/d' .env
grep -qE '^SERVICE_KEY=.+' .env || echo "SERVICE_KEY=$(openssl rand -hex 32)" >> .env
grep -qE '^LISTENER_API_URL=.+' .env || echo "LISTENER_API_URL=http://127.0.0.1:4500/api" >> .env
grep '^SERVICE_KEY=' .env | tail -1 | cut -d= -f2- | tr -d '\n' | wc -c   # 32 yoki ko'proq bo'lsin
pm2 reload institute-ais          # .env faqat jarayon qayta ishga tushganda o'qiladi
```

Oxirgi `wc -c` 32 dan kam chiqarsa — mavjud `SERVICE_KEY` portal uchun juda qisqa (portal ishga tushmaydi): qatorni
`openssl rand -hex 32` qiymatiga almashtirib, `pm2 reload institute-ais` ni qayta bajaring.

**`FILE_URL_SECRET` bo'sh bo'lsa**, uni faqat portal uchun asosiy `.env` ga **qo'shmang**: bu imzo sirini
almashtirish bilan barobar va asosiy tizimning ayrim modullarida bazaga yozilgan hujjat havolalarini bekor qiladi
(asosiy qo'llanma, «Havola SIZIB CHIQSA — bekor qilish»). Portalga buning keragi yo'q: asosiy backend Malaka oshirish
javoblaridagi barcha `/files/...` havolalarini javob qaytishida o'z siri bilan qayta imzolaydi, portal esa imzosi bor
havolaga tegmaydi. Bu holda portal `.env` ida ham `FILE_URL_SECRET` bo'sh yoki umuman bo'lmaydi — shunday qoldiring.
Portalga `JWT_SECRET` ni **bermang** — u asosiy tizim tokenlarini imzolaydigan kalit.

**`FILE_URL_SECRET=CHANGE_ME` (namuna qiymat) bo'lsa** — bu portalga emas, asosiy tizimga tegishli muammo: namuna
qiymat ochiq ma'lum, ya'ni sizib chiqqan sir bilan barobar. Uni asosiy qo'llanmaning «Havola SIZIB CHIQSA — bekor
qilish» bandi bo'yicha almashtiring.

### 2.2. `malaka_tinglovchi` roli

Portal so'rovlarini asosiy backend `malaka_tinglovchi` roli ruxsatlari bilan bajaradi. Rol `yarn seed:qual-roles`
bilan yoziladi — asosiy qo'llanmaning «3. RBAC seed — MAJBURIY» bo'limi, «Asosiy seed buyruqlari» bloki (asosiy
tizimni o'rnatishda bajariladi). Rol bo'lmasa tinglovchi kira oladi, lekin barcha sahifalar
`403 Tinglovchi roli sozlanmagan` qaytaradi. Tekshirish:

```bash
mongosh "$(grep '^MONGO_HOST=' /srv/fjsti/backend/.env | cut -d= -f2-)" --quiet \
  --eval 'db.roles.countDocuments({title:"malaka_tinglovchi", active:true})'     # 1 bo'lishi kerak
```

Portal uchun asosiy tizimda foydalanuvchi (`users`) yozuvi kerak emas. `yarn seed:malaka-tinglovchi` portalga kirishni
ochmaydi va production'da ishlatilmaydi (asosiy qo'llanma, «DEV-ONLY seedlar»).

### 2.3. Asosiy nginx va boshqa sozlamalar

- Asosiy nginx'dagi `location /files/` ga IP cheklovi qo'ymang (asosiy qo'llanma §5, «`/files/` — yuklangan
  fayllar»): tinglovchilar hujjat va videolarni institut tarmog'idan tashqaridan ochadi.
- Asosiy `ALLOWED_ORIGINS` ga portal domenini qo'shish va asosiy socket.io uchun qo'shimcha sozlash **kerak emas**.
- Asosiy qo'llanma §2 tavsiyasi bo'yicha asosiy backend `LISTEN_HOST=127.0.0.1` da tinglaydi — portal unga shu manzil
  orqali ulanadi (`LISTEN_HOST=0.0.0.0` bo'lsa ham `127.0.0.1` ishlaydi).

---

## 3. Backend

Buyruqlarni pm2 ishlaydigan foydalanuvchi nomidan bajaring.

```bash
unzip -q ~/fjsti-tinglovchi.zip -d /srv/fjsti/            # arxiv ichida: fjsti-tinglovchi/
mv /srv/fjsti/fjsti-tinglovchi /srv/fjsti/tinglovchi
cd /srv/fjsti/tinglovchi/backend
npm ci --omit=dev
cp .env.example .env && chmod 600 .env
```

**To'xtang:** `.env` ni pastdagi namuna va jadval bo'yicha to'ldiring. `.env.example` dagi `CHANGE_ME_…` qiymatlari
bilan backend **ataylab ishga tushmaydi**.

Tayyor `.env` ko'rinishi:

```dotenv
NODE_ENV=production
PORT=4500

MONGO_HOST=mongodb://127.0.0.1:27017/listener-db
LISTENER_DB=listener-db

LISTENER_JWT_SECRET=<64 belgili tasodifiy qiymat>
REFRESH_TOKEN_SECRET=<boshqa 64 belgili tasodifiy qiymat>
ACCESS_TOKEN_TTL=1d
REFRESH_TOKEN_TTL=30d

MAIN_API_URL=http://127.0.0.1:4000/api
SERVICE_KEY=<asosiy .env dagi SERVICE_KEY>
FILE_URL_SECRET=<asosiy .env dagi FILE_URL_SECRET — u yerda bo'lsa>

CORS_ORIGINS=https://<tinglovchi-domeni>
LOGIN_RATE_MAX=300
```

Sirlarni yaratish va umumiy kalitlarni asosiy `.env` dan ko'chirish (qiymatlar ekranga chiqmaydi):

```bash
cd /srv/fjsti/tinglovchi/backend
sed -i "s/^LISTENER_JWT_SECRET=.*/LISTENER_JWT_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/^REFRESH_TOKEN_SECRET=.*/REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)/" .env
sed -i '/^SERVICE_KEY=/d; /^FILE_URL_SECRET=/d' .env
grep -E '^(SERVICE_KEY|FILE_URL_SECRET)=' /srv/fjsti/backend/.env >> .env

# ikkala tomonda bir xilmi — "mos" chiqishi kerak:
diff <(grep -E '^(SERVICE_KEY|FILE_URL_SECRET)=' /srv/fjsti/backend/.env | sort) \
     <(grep -E '^(SERVICE_KEY|FILE_URL_SECRET)=' .env | sort) && echo "mos"
```

Qolgan kalitlarni (`NODE_ENV`, `MAIN_API_URL`, `CORS_ORIGINS`, `LOGIN_RATE_MAX`) muharrirda (`nano .env`) yozing.

### `.env` — kalitlar

| Kalit | Production qiymati | Izoh |
|---|---|---|
| `NODE_ENV` | `production` | 🔴 **aynan shu yozuv** (`.env.example` da `development`). Boshqa qiymatda: 5xx javoblarida ichki xato tafsiloti (`detail` maydoni, masalan asosiy backend o'chiq bo'lsa `fetch failed`) foydalanuvchiga qaytadi, log `debug` darajasida yoziladi, `LOGIN_RATE_MAX` berilmagan bo'lsa login limiti 10 o'rniga 100 bo'ladi |
| `PORT` | `4500` | nginx upstream va asosiy `LISTENER_API_URL` shu portga qaraydi. Backend barcha tarmoq interfeyslarida tinglaydi (tinglash manzilini tanlaydigan sozlama yo'q) — 4500-portni tashqaridan firewall bilan yoping (§5) |
| `MONGO_HOST` | `mongodb://127.0.0.1:27017/listener-db` | majburiy — bo'sh bo'lsa backend `MONGO_HOST .env da ko'rsatilmagan` bilan to'xtaydi. Asosiy tizimning MongoDB serveri bo'lishi mumkin, baza esa alohida. Manzildagi baza nomini `LISTENER_DB` bilan bir xil qoldiring — §7 dagi zaxira buyrug'i shunga tayanadi |
| `LISTENER_DB` | `listener-db` | portalning barcha kolleksiyalari shu bazada. 🔴 Asosiy tizim bazasi (`institute-ais`) nomini yozmang: ikkalasida ham `chatmessages` kolleksiyasi bor, tuzilishi esa har xil |
| `LISTENER_JWT_SECRET` | `openssl rand -hex 32` | tinglovchi tokenlarini imzolaydi (HTTP va socket). Kamida 32 belgi, aks holda backend ishga tushmaydi. Almashtirilsa barcha tinglovchilar tizimdan chiqadi va qayta kiradi |
| `REFRESH_TOKEN_SECRET` | `openssl rand -hex 32` (boshqa qiymat) | xuddi shu talab — ishga tushish uchun majburiy |
| `SERVICE_KEY` | asosiy `.env` dagi qiymat | harfma-harf bir xil (§2.1). Kamida 32 belgi |
| `MAIN_API_URL` | `http://127.0.0.1:4000/api` | aynan `<origin>/api` ko'rinishida: portal so'rov yo'lini shu manzilga ulaydi, socket.io ko'prigi esa `/api` siz origin'ga ulanadi — boshqa yo'l yozilsa ikkalasi ham buziladi. `localhost` emas, `127.0.0.1` yozing (asosiy backend `LISTEN_HOST=127.0.0.1` da). Bo'sh bo'lsa asosiy tizimga bog'liq sahifalar `500 MAIN_API_URL sozlanmagan` qaytaradi, chat real-time ishlamaydi. `NODE_ENV=production` va `http://` manzil bilan har ishga tushishda logda ``[checkEnv] MAIN_API_URL `http://` (TLS yo'q)`` ogohlantirishi chiqadi — server ichidagi `127.0.0.1` aloqasi uchun bu kutilgan holat |
| `FILE_URL_SECRET` | asosiy `.env` dagi qiymat (u yerda yo'q bo'lsa — bo'sh) | zaxira: portal asosiy backend javobidagi **imzosiz** `/files/...` havolalarga imzo qo'shadi. Asosiy backend Malaka oshirish javoblaridagi hujjat havolalarini o'zi qayta imzolab yuboradi, portal esa imzoli havolaga tegmaydi — shu sabab hujjatlarning ochilishi amalda bu qiymatga bog'liq emas. Baribir asosiydagi bilan bir xil saqlang (yuqoridagi `diff`). Ishga tushishda tekshirilmaydi. Asosiy tomonda almashtirilsa, bu yerda ham almashtirib, `pm2 restart tinglovchi` qiling |
| `CORS_ORIGINS` | `https://<tinglovchi-domeni>` | vergul bilan ro'yxat. Frontend backend bilan bir origin'dan uzatilgani uchun amalda talab qilinmaydi; faqat boshqa domendagi frontend uchun kerak |
| `ACCESS_TOKEN_TTL` | `1d` | sessiya uzunligi: muddat tugagach tinglovchi JSHSHIR bilan qayta kiradi. Har doim birlik bilan yozing (`12h`, `1d`) — birliksiz son (`3600`) millisekund deb o'qiladi |
| `REFRESH_TOKEN_TTL` | `30d` | sessiya uzunligiga ta'sir qilmaydi (u `ACCESS_TOKEN_TTL` bilan belgilanadi) — o'zgartirmang |
| `LOGIN_RATE_MAX` | masalan `300` | `.env.example` da yo'q — qo'shing. Kirish (`POST /api/auth`) va sessiyani yangilash urinishlari — muvaffaqiyatlisi ham — 15 daqiqalik **bitta** hisoblagichda sanaladi. nginx ortida backend hamma so'rovni `127.0.0.1` dan kelgan deb ko'radi, ya'ni bu hisoblagich butun portal uchun bitta. Production'dagi default — 10: bir guruh tinglovchi birdan kirganda hammasi `429 Juda ko'p urinish` oladi. 15 daqiqada kutilgan kirishlar sonidan kattaroq qiymat qo'ying |

### Ixtiyoriy o'zgaruvchilar (`.env.example` da yo'q; bo'lmasa default ishlaydi)

| Kalit | Default | Ma'nosi |
|---|---|---|
| `CLIENT_BUILD_DIR` | `backend/public/build` | frontend build papkasi. Nisbiy yo'l jarayonning ishchi papkasiga nisbatan olinadi — o'zgartirsangiz to'liq yo'l yozing |
| `REQUEST_TIMEOUT_MS` | `120000` | so'rovni (yuklanayotgan fayl bilan birga) to'liq qabul qilish muddati, ms |
| `HEADERS_TIMEOUT_MS` | `30000` | so'rov sarlavhalarini qabul qilish muddati, ms |
| `PROXY_MAX_BODY_MB` | `210` | asosiy backendga uzatiladigan fayl yuklash so'rovining eng katta hajmi, MB. Oshsa backend ulanishni uzadi — `413` javobi mijozga yetmaydi, nginx ortida mijoz `502` oladi. Shuning uchun uni nginx `client_max_body_size` dan kichik qilmang: teng bo'lsa katta so'rovni nginx o'zi `413` bilan rad etadi (§5). So'rov xotirada to'liq ushlanadi |
| `PROXY_TIMEOUT_MS` | `120000` | asosiy backend javobini kutish muddati, ms (tugasa `504`) |
| `PROXY_MAX_RESPONSE_MB` | `50` | asosiy backend javobining eng katta hajmi, MB (oshsa `502`) |
| `PROXY_FILE_URL_TTL_SECONDS` | `2592000` (30 kun) | portal qo'shadigan hujjat havolasi imzosining muddati (faqat imzosiz kelgan havolalar uchun — `FILE_URL_SECRET` ga qarang) |
| `FILES_DIR` | `./files` (backend papkasida) | ishga tushishda yaratiladi. Portal bu papkaga fayl yozmaydi — u bo'sh qoladi. Ishchi papkaga yozish huquqi bo'lmasa backend ishga tushmaydi |

`JWT_SECRET` ni bu `.env` ga **yozmang**: portal uni faqat `FILE_URL_SECRET` bo'sh bo'lganda ishlatadi, asosiy tizimning
`JWT_SECRET` i esa bu yerga ko'chirilmasligi kerak (§2.1).

### Ishga tushirish

```bash
cd /srv/fjsti/tinglovchi/backend
npm run boot                     # "boot OK" — API modullari yuklanadi (bazaga ulanmaydi, .env o'qilmaydi; helmet, cors, socket.io kabi server paketlari tekshirilmaydi)
pm2 start /srv/fjsti/tinglovchi/backend/src/index.js --name tinglovchi --cwd /srv/fjsti/tinglovchi/backend
pm2 save                         # server qayta yuklanganda ham ko'tarilsin (pm2 startup — asosiy qo'llanma §2)
pm2 logs tinglovchi --lines 30 --nostream
```

`--cwd` shart: backend `.env` ni jarayonning ishchi papkasidan o'qiydi. Logda (tartibi farq qilishi mumkin):

```
[checkEnv] MAIN_API_URL `http://` (TLS yo'q) ...     ← NODE_ENV=production + http:// manzilda kutilgan
MongoDB ulandi: mongodb://127.0.0.1:27017/listener-db
Tinglovchi backend ishga tushdi: port 4500
[SPA] build topilmadi (...) — API-only rejim          ← §4 dagi restartdan keyin "[SPA] frontend build ..." bo'ladi
[identity] sync: <N> tinglovchi yangilandi           ← manzil va SERVICE_KEY to'g'ri, ro'yxat sinxronlandi
```

`[checkEnv] MAIN_API_URL` ogohlantirishi jarayon haqiqatan `NODE_ENV=production` bilan ishlayotganini ham bildiradi.
pm2 jarayonga `pm2 start` bajarilgan shell muhitini beradi va shelldagi qiymat `.env` dagisidan ustun turadi.
Tekshiring:

```bash
pm2 env $(pm2 id tinglovchi | tr -dc '0-9') | grep NODE_ENV   # hech narsa yoki NODE_ENV: production
```

Boshqa qiymat chiqsa: `pm2 delete tinglovchi`, `unset NODE_ENV`, so'ng `pm2 start ...` va `pm2 save` ni qayta bajaring.

### ⚠️ pm2: bitta jarayon (fork), cluster ISHLATMANG

`pm2 start` ni `-i` siz bajaring — portal bitta jarayonda ishlashga mo'ljallangan:
- chatdagi ulanishlar ro'yxati jarayon xotirasida — boshqa jarayonga ulangan tinglovchiga o'qituvchi xabari real-time
  yetib bormaydi;
- socket.io polling rejimi «sticky session» talab qiladi, pm2 cluster uni bermaydi;
- login limiteri xotirada — jarayonlar soniga ko'payadi;
- fon jarayonlari (ro'yxat sinxroni, progressni asosiy tizimga yozish) har jarayonda takrorlanadi.

### Xavfsizlik

- Kirish faqat JSHSHIR bilan. 🔴 `npm run seed:listener` ni production'da **hech qachon** ishga tushirmang (§6).
- `.env` da sirlar bor — `chmod 600 .env` (yuqorida bajarilgan).
- 4500-port tashqaridan yopiq bo'lsin (§5).

---

## 4. Frontend — backend ICHIGA yig'iladi

Frontend alohida serverdan uzatilmaydi: build natijasi `backend/public/build/` ga ko'chiriladi va backend uni
o'zi beradi (SPA fallback ham backendda).

### 🔴 `VITE_API_URL` — nisbiy bo'lishi SHART

Vite `VITE_*` qiymatlarini **build paytida** bundle ichiga yozadi. Production build `frontend/.env.production`
faylidagi qiymatni oladi:

```
VITE_API_URL=/api
```

Frontend va API bir xil origin'dan uzatilgani uchun nisbiy `/api` — CORS kerak emas, domen o'zgarsa qayta build
shart emas. Chat socket'i ham shu qiymatdan hosil qilinadi: `/api` bo'lsa u sahifa domeniga (`wss://<tinglovchi-domeni>`)
ulanadi. Berilmasa yoki `.env.example` dagi `http://localhost:4500/api` bilan yig'ilsa, ilova har bir
foydalanuvchining **o'z kompyuteri**ga murojaat qiladi va ishlamaydi — build esa hech qanday ogohlantirishsiz
tugaydi. Production build uchun `.env.example` ni `.env` ga nusxalamang.

### Qadamlar

```bash
cd /srv/fjsti/tinglovchi/frontend
test -f .env.production || printf 'VITE_API_URL=/api\n' > .env.production    # fayl yo'q bo'lsa yaratadi
cat .env.production                          # VITE_API_URL=/api
npm ci --include=dev
npm run build                                # tsc --noEmit && vite build → dist/

# Backend ichiga ko'chirish (eski build butunlay almashtiriladi)
rm -rf /srv/fjsti/tinglovchi/backend/public/build
mkdir -p /srv/fjsti/tinglovchi/backend/public/build
cp -r dist/. /srv/fjsti/tinglovchi/backend/public/build/

pm2 restart tinglovchi                       # faqat birinchi o'rnatishda — pastga qarang
```

- `npm ci --include=dev`: build uchun `typescript` va `vite` (devDependencies) kerak. Shellda `NODE_ENV=production`
  bo'lsa oddiy `npm ci` ularni o'rnatmaydi va build `tsc: not found` bilan to'xtaydi.
- Backend build borligini **faqat ishga tushishda** tekshiradi. Build birinchi marta qo'yilgach `pm2 restart tinglovchi`
  shart (aks holda backend API-only rejimda qoladi va sahifalar o'rniga `Yo'l topilmadi` JSON'ini qaytaradi).
  Keyingi yangilashlarda restart shart emas: `express.static` fayllarni har so'rovda diskdan o'qiydi, Vite esa asset
  nomlariga hash qo'yadi.

### Ixtiyoriy `VITE_*` kalitlari

Kerak bo'lsa build'dan **OLDIN** `frontend/.env.production.local` ga yozing (§7 dagi yangilash uni saqlaydi).
«Default» — kalit berilmaganda koddagi qiymat:

| Kalit | Default | Vazifasi |
|---|---|---|
| `VITE_APP_NAME` | institut nomi | kirish sahifasi va yon menyudagi nom (brauzer yorlig'idagi sarlavha o'zgarmaydi) |
| `VITE_PRIMARY_COLOR` | `#34C18C` | asosiy rang. Qiymatni qo'shtirnoqda yozing: `VITE_PRIMARY_COLOR="#1677ff"` — qo'shtirnoqsiz `#` izoh deb o'qiladi va default qoladi |
| `VITE_THEME_MODE` | `light` | `light` yoki `dark` |

`VITE_*` qiymatlari ochiq JavaScript'ga yoziladi — ularga hech qachon sir qo'ymang.

### Build tekshiruvi

```bash
grep -rl 'localhost:4500' /srv/fjsti/tinglovchi/backend/public/build/assets/          # hech narsa chiqmasligi kerak
grep -rho 'VITE_API_URL:"[^"]*"' /srv/fjsti/tinglovchi/backend/public/build/assets/ | sort -u   # VITE_API_URL:"/api"
```

Birinchi buyruq fayl nomi chiqarsa — build noto'g'ri API manzili bilan yig'ilgan: `.env.production` ni tekshirib,
qayta build qiling. Oddiy `localhost` so'zini qidirmang — u socket.io kutubxonasida doim bor.

---

## 5. nginx

Buyruqlar root huquqi bilan (`sudo`). Portal asosiy saytdan alohida `server` blokida, o'z domenida ishlaydi.
`tinglovchi.sayt.uz` o'rniga o'z domeningizni yozing.

`/etc/nginx/sites-available/fjsti-tinglovchi` faylini quyidagi matn bilan yarating:

```nginx
upstream fjsti_tinglovchi {
    server 127.0.0.1:4500;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name <tinglovchi-domeni>;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name <tinglovchi-domeni>;

    ssl_certificate     /etc/letsencrypt/live/<tinglovchi-domeni>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<tinglovchi-domeni>/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;

    client_max_body_size 210M;

    gzip on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript
               application/xml image/svg+xml;
    gzip_min_length 1024;

    location /socket.io/ {
        proxy_pass         http://fjsti_tinglovchi;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass         http://fjsti_tinglovchi;
        proxy_http_version 1.1;
        proxy_set_header   Host       $host;
        proxy_set_header   Connection "";
        proxy_read_timeout 130s;
    }
}
```

```bash
sudo sed -i 's/<tinglovchi-domeni>/tinglovchi.sayt.uz/g' /etc/nginx/sites-available/fjsti-tinglovchi
sudo ln -s /etc/nginx/sites-available/fjsti-tinglovchi /etc/nginx/sites-enabled/
```

**Sertifikat** — asosiy qo'llanma §5 dagi tartibda:

1. Fayldagi 443-portli `server { ... }` blokini vaqtincha `#` bilan o'chiring (sertifikat fayllari hali yo'q,
   `nginx -t` xato beradi).
2. Sertifikatni oling (`--deploy-hook` shart — usiz nginx yangilangan sertifikatni olmaydi):
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   sudo mkdir -p /var/www/certbot
   sudo certbot certonly --webroot -w /var/www/certbot -d tinglovchi.sayt.uz --deploy-hook "systemctl reload nginx"
   ```
3. 443-blokni qaytaring va tekshiring:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot renew --dry-run
   ```

`certbot --nginx` ishlatmang: u konfiguratsiyani o'zi qayta yozadi.

**Izohlar:**
- **`/socket.io/`** — Upgrade sarlavhalarisiz chat socket'i WebSocket'ga o'tmaydi va sekinroq long-polling
  rejimida qoladi.
- **Yuklash hajmi.** `client_max_body_size 210M` backenddagi `PROXY_MAX_BODY_MB` (210) bilan bir xil. Bitta fayl
  hajmini asosiy backend cheklaydi (masalan ariza hujjati — 50 MB gacha). Birini o'zgartirsangiz, ikkinchisini ham
  moslang. `proxy_request_buffering` ni o'chirmang: nginx faylni mijozdan to'liq qabul qilib, backendga bir zumda
  uzatadi — backend so'rovni 120 soniya ichida (`REQUEST_TIMEOUT_MS`) to'liq qabul qilishi kerak.
- **`proxy_read_timeout 130s`** — backend asosiy tizim javobini 120 soniya kutadi (`PROXY_TIMEOUT_MS`); nginx
  undan biroz ko'proq kutadi.
- **Xavfsizlik sarlavhalari** (HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) backendning o'zi
  yuboradi — nginx'da takrorlamang.
- **`/files/` bloki kerak emas** — hujjat, video va rasmlar asosiy domendan ochiladi (§0).
- **CSP.** Backend `Content-Security-Policy` yubormaydi. nginx'da qo'shsangiz, `'self'` dan tashqari quyidagilarga
  ruxsat bering:
  `style-src` — `'unsafe-inline'` va `https://fonts.googleapis.com`; `font-src` — `https://fonts.gstatic.com`;
  `frame-src` — `https://www.youtube.com` (video darslar); `img-src` — `https://<asosiy-domen>` va `blob:`
  («O'quv jarayoni» sahifasida yuklanayotgan rasmning oldindan ko'rinishi `blob:` manzildan chiqadi); `media-src` —
  `https://<asosiy-domen>`.
- **IP manzillar.** Backend nginx ortida hamma so'rovni `127.0.0.1` dan ko'radi (pm2 loglarida ham shunday);
  mijozlarning haqiqiy IP manzillari nginx access log'ida.
- **4500-port.** Backend barcha interfeyslarda tinglaydi — portni firewall bilan tashqaridan yoping. Toza Ubuntu'da
  `ufw` o'rnatilgan, lekin o'chiq bo'ladi — ya'ni bu qadamsiz 4500-port internetdan ochiq qoladi:
  ```bash
  sudo ufw status                       # "Status: active" bo'lsa — faqat keyingi qator yetarli
  sudo ufw deny 4500/tcp
  # "Status: inactive" bo'lsa — avval SSH va nginx'ga ruxsat bering (aks holda SSH ulanishi uziladi), keyin yoqing:
  sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw deny 4500/tcp && sudo ufw enable
  ```
  SSH boshqa portda bo'lsa yoki serverda tashqaridan ochiq bo'lishi kerak bo'lgan boshqa xizmatlar bo'lsa, `ufw enable`
  dan oldin ularga ham ruxsat bering. Provayderning tarmoq firewall'i ishlatilsa — 4500-portni o'sha yerda yoping.
  `127.0.0.1` orqali ichki aloqaga (nginx → portal, asosiy backend → portal) bu ta'sir qilmaydi. Boshqa
  kompyuterdan tekshirish: `curl -m 5 http://<server-ip>:4500/api/health` javob bermasligi kerak.

---

## 6. Skriptlar va seedlar

Barcha buyruqlarni `/srv/fjsti/tinglovchi/backend` papkasidan bajaring — ular `.env` ni joriy papkadan o'qiydi.

**Toza o'rnatishda hech qanday seed yoki migratsiya kerak emas:** tinglovchilar ro'yxati asosiy tizimdan avtomatik
sinxronlanadi, indekslar o'zi yaratiladi.

| Buyruq | Qachon | Nima qiladi |
|---|---|---|
| `npm run boot` | o'rnatishdan keyin (ixtiyoriy) | API modullarini yuklab `boot OK` chiqaradi. Bazaga ulanmaydi, serverni ishga tushirmaydi, `.env` va server paketlarini (helmet, cors, socket.io) tekshirmaydi |
| `npm run bridge:check` | diagnostika: o'rnatishdan keyin, chatda onlayn holat ko'rinmasa | asosiy backend socket.io'siga `SERVICE_KEY` bilan ikki usulda (faqat websocket; polling → websocket) ulanib ko'radi, har biri uchun `✓`/`✗` va xato matnini chiqaradi. Hech narsa yozmaydi |
| `npm run unblock:listeners -- <JSHSHIR>` | bir martalik, faqat oldingi versiyadan yangilangan o'rnatishda — tinglovchilar kirishda `Foydalanuvchi bloklangan` olsa | portal bazasidagi tinglovchini faollashtiradi. JSHSHIR'siz — portal bazasidagi **barcha** bloklanganlarni. Oxirida barcha tinglovchilar ro'yxatini (JSHSHIR'ning dastlabki 4 raqami va F.I.Sh.) chiqaradi — terminal chiqishini begonalarga ko'rsatmang. Asosiy tizimda bloklangan tinglovchini sinxronizatsiya 10 daqiqa ichida qayta bloklaydi |
| `node scripts/migrate-chat.js`, so'ng `node scripts/rekey-chat-to-listener.js` | bir martalik, faqat asosiy bazada tinglovchilar ishtirokidagi chat yozishmalari bo'lsa va ular portalga ko'chirilishi kerak bo'lsa | pastdagi «Chat yozishmalarini ko'chirish» |
| `npm run dev` | faqat lokal ishlab chiqishda | `nodemon` bilan ishga tushiradi; `npm ci --omit=dev` dan keyin serverda mavjud emas |
| 🔴 `npm run seed:listener` | **production'da HECH QACHON** | portal bazasiga kirish huquqi bor tinglovchi yozadi. Argumentsiz — `77777777777777` JSHSHIR'li hisob. Kirish faqat JSHSHIR bilan bo'lgani uchun bu ochiq eshik, sinxronizatsiya uni o'chirmaydi |

Tasodifan ishga tushirilgan bo'lsa, yozuvni o'chiring:

```bash
mongosh "$(grep '^MONGO_HOST=' .env | cut -d= -f2-)" --quiet \
  --eval 'db.getSiblingDB("listener-db").listeners.deleteOne({passport:"77777777777777"})'
```

### `bridge:check` natijasi

Chiqishda ikki natija qatori bor: birinchisi — faqat WebSocket bilan ulanish, ikkinchisi — polling → WebSocket.
Portalning socket.io ko'prigi ikkinchi usulda ulanadi, shuning uchun natijani **ikkinchi qator** belgilaydi. Bitta
serverda (`127.0.0.1:4000`) odatda ikkala qatorda ham `✓` chiqadi. Faqat birinchi qatorda `✗` bo'lsa ko'prik baribir
ishlaydi — to'g'ridan WebSocket o'tmayapti (alohida serverlarda asosiy nginx'dagi `/socket.io/` blokida Upgrade
sarlavhalarini tekshiring). Ikkinchi qatorda `✗` bo'lsa yonidagi matn sababni aytadi: `Service kaliti yaroqsiz` —
`SERVICE_KEY` ikki tomonda farq qiladi; `xhr poll error`, `websocket error` yoki vaqt tugashi — `MAIN_API_URL`
noto'g'ri yoki asosiy backend ishlamayapti. Natijani `✓`/`✗` qatorlaridan o'qing, oxirgi `XULOSA` qatorlari faqat
qo'shimcha izoh. Skript `MAIN_API_URL` va `SERVICE_KEY` ni doim `backend/.env` dan o'qiydi.

### Chat yozishmalarini ko'chirish (bir martalik)

Asosiy bazaning `chatmessages` kolleksiyasidagi tinglovchilar ishtirokidagi yozishmalarni portal bazasiga ko'chiradi.
Toza o'rnatishda kerak emas. Faqat bir marta, portal tinglovchilarga ochilishidan oldin, shu tartibda:

```bash
cd /srv/fjsti/tinglovchi/backend
pm2 logs tinglovchi --lines 200 --nostream | grep '\[identity\] sync'   # N > 0: tinglovchilar ro'yxati sinxronlangan
pm2 stop tinglovchi
mongodump --uri "$(grep '^MONGO_HOST=' .env | cut -d= -f2-)" --out /srv/backups/tinglovchi-db-pre-chat   # /srv/backups — §7, 0-qadam

# 1) Ko'chirish: asosiy bazani faqat O'QIYDI, portal bazasiga yozadi
MAIN_MONGO_HOST="$(grep '^MONGO_HOST=' /srv/fjsti/backend/.env | cut -d= -f2-)" node scripts/migrate-chat.js

# 2) Yozishmalarni portal tinglovchi identifikatorlariga o'tkazish
node scripts/rekey-chat-to-listener.js      # oxirgi qator: "Eski userId qolgan xabarlar: 0 ✓"

pm2 start tinglovchi
```

🔴 `migrate-chat.js` ni **qayta ishga tushirmang** (2-qadamdan keyin ham, portal ishlay boshlagach ham): u portal
bazasidagi xabarlarni asosiy bazadagi holatiga qaytaradi — o'qilgan va o'chirilgan belgilari yo'qoladi, yozishma
egalari esa eski identifikatorlarga qaytadi. `rekey-chat-to-listener.js` birinchi ishga tushishda o'zgartirishdan oldin
`chatmessages_backup` zaxira kolleksiyasini yaratadi; qaytarish kerak bo'lsa — shu kolleksiyadan yoki yuqoridagi
`mongodump` zaxirasidan qo'lda tiklanadi.

---

## 7. Yangilash (update)

Yangi versiya bitta `fjsti-tinglovchi.zip` arxivida keladi. Avval yangi arxivdagi `DEPLOY.md` ni o'qing.

Serverda arxivda **YO'Q**, lekin saqlanishi SHART bo'lgan narsalar: `backend/.env`, `backend/public/` (frontend
build), `backend/files/`, `frontend/.env.production`, `frontend/.env.production.local`, ikkala `node_modules/`.
Pastdagi `rsync` ularni chetlab o'tadi.

Blokni bir yo'la emas, qadamma-qadam bajaring va har buyruq natijasini ko'ring. `npm ci` ishni eski `node_modules`
ni o'chirishdan boshlaydi: u xato bilan tugasa (masalan tarmoq uzilsa), 4-qadamdagi `pm2 restart` backendni
`Cannot find module` xatosi bilan yiqitadi. Biror qadam xato bersa `pm2 restart` qilmang — ishlab turgan jarayon eski
kod bilan ishlashda davom etadi; avval xatoni tuzating (masalan `npm ci` ni qayta ishga tushiring) yoki pastdagi
Rollback'ni bajaring.

```bash
# 0) Zaxira — portal bazasi (chat faqat shu yerda) + papka (.env va build bilan)
sudo install -d -m 700 -o "$(id -un)" /srv/backups    # birinchi marta (asosiy qo'llanma bo'yicha yaratilgan bo'lishi mumkin)
STAMP=$(date +%F-%H%M)
cd /srv/fjsti/tinglovchi/backend
mongodump --uri "$(grep '^MONGO_HOST=' .env | cut -d= -f2-)" --out /srv/backups/tinglovchi-db-$STAMP
tar -czf /srv/backups/tinglovchi-$STAMP.tgz \
  --exclude=tinglovchi/backend/node_modules --exclude=tinglovchi/frontend/node_modules \
  -C /srv/fjsti tinglovchi

# 1) Yangi arxivni TOZA /tmp/fjsti-tinglovchi ga oching (arxiv yo'lini moslang) va kodni almashtiring
rm -rf /tmp/fjsti-tinglovchi && unzip -q ~/fjsti-tinglovchi.zip -d /tmp/ && ls /tmp/fjsti-tinglovchi/backend/package.json
rsync -a --delete \
  --exclude=/backend/.env --exclude=/backend/node_modules/ --exclude=/backend/public/ --exclude=/backend/files/ \
  --exclude=/frontend/node_modules/ --exclude=/frontend/dist/ --exclude=/frontend/.env --exclude=/frontend/.env.local \
  --exclude=/frontend/.env.production --exclude=/frontend/.env.production.local \
  /tmp/fjsti-tinglovchi/ /srv/fjsti/tinglovchi/

# 2) Backend bog'liqliklari va yangi .env kalitlari
cd /srv/fjsti/tinglovchi/backend && npm ci --omit=dev
diff <(grep -oE '^[A-Z0-9_]+=' .env.example | sort) <(grep -oE '^[A-Z0-9_]+=' .env | sort) | grep '^<'
#   ⬆️ chiqqan kalitlarni §3 jadvali bo'yicha .env ga qo'shing

# 3) Frontend — qayta build va backend ichiga ko'chirish
cd /srv/fjsti/tinglovchi/frontend
npm ci --include=dev && npm run build \
  && rm -rf /srv/fjsti/tinglovchi/backend/public/build && mkdir -p /srv/fjsti/tinglovchi/backend/public/build \
  && cp -r dist/. /srv/fjsti/tinglovchi/backend/public/build/ && echo "build ko'chirildi"
#   "build ko'chirildi" chiqmasa — o'rnatish yoki build xato bergan, backenddagi eski build o'zgarmagan:
#   xatoni tuzatib, qayta bajaring (frontend/dist/ da oldingi versiya build'i qolgan bo'lishi mumkin — uni ko'chirmang)

# 4) Backendni qayta ishga tushirish (bir necha soniya uzilish)
pm2 restart tinglovchi
pm2 logs tinglovchi --lines 30 --nostream
```

Build'dan keyin §4 dagi «Build tekshiruvi»ni bajaring. Faqat frontend o'zgargan bo'lsa 4-qadam shart emas. Asosiy
backend yangilanganda yoki qayta ishga tushirilganda portalni qayta ishga tushirish shart emas — socket.io ko'prigi va
fon jarayonlari ulanishni o'zi tiklaydi.

**Rollback** — kod va frontend build 0-qadamdagi zaxiradan qaytariladi (`.env` joyida qoladi):

```bash
rm -rf /tmp/tinglovchi-rollback && mkdir -p /tmp/tinglovchi-rollback
tar -xzf /srv/backups/tinglovchi-<STAMP>.tgz -C /tmp/tinglovchi-rollback
rsync -a --delete \
  --exclude=/backend/.env --exclude=/backend/node_modules/ --exclude=/frontend/node_modules/ \
  /tmp/tinglovchi-rollback/tinglovchi/ /srv/fjsti/tinglovchi/
cd /srv/fjsti/tinglovchi/backend && npm ci --omit=dev
pm2 restart tinglovchi
```

Bazani tiklash kerak bo'lsa: `pm2 stop tinglovchi`, so'ng
`mongorestore --uri "mongodb://127.0.0.1:27017" --drop --nsInclude 'listener-db.*' /srv/backups/tinglovchi-db-<STAMP>`
(baza nomi `LISTENER_DB` dagi bilan bir xil bo'lsin), keyin `pm2 start tinglovchi`. Zaxiradan keyin yozilgan chat
xabarlari yo'qoladi.

**Muntazam zaxira.** Portal bazasini asosiy baza bilan birga muntazam zaxiralang — chat yozishmalari faqat shu yerda.
Buni avtomatlashtiring: pm2 foydalanuvchisi nomidan `crontab -e` ni oching va quyidagi qatorni qo'shing (har kuni
02:30; 14 kundan eski kunlik zaxiralar o'chiriladi; crontab'da `%` belgisi `\%` deb yoziladi). `/srv/backups` hali
yo'q bo'lsa, avval `sudo install -d -m 700 -o "$(id -un)" /srv/backups`.

```
30 2 * * * mongodump --quiet --uri "$(grep '^MONGO_HOST=' /srv/fjsti/tinglovchi/backend/.env | cut -d= -f2-)" --out /srv/backups/tinglovchi-db-daily-$(date +\%F) && find /srv/backups -maxdepth 1 -name 'tinglovchi-db-daily-*' -mtime +14 -exec rm -rf {} +
```

Ertasi kuni tekshiring: `ls /srv/backups | grep tinglovchi-db-daily`. Tiklash — yuqoridagi `mongorestore` buyrug'i
bilan, zaxira papkasi sifatida `/srv/backups/tinglovchi-db-daily-<sana>`. Zaxiralarni vaqti-vaqti bilan boshqa
serverga ham ko'chiring — disk ishdan chiqsa chat tarixini tiklashning boshqa manbasi yo'q.

`backend/files/` bo'sh qoladi, uni zaxiralash shart emas; yuklangan fayllar asosiy backend `uploads/` da. `writemirrors`
kolleksiyasi portal orqali yuborilgan har yozuvni saqlaydi va vaqt o'tishi bilan o'sadi — disk hajmini kuzatib boring.

---

## 8. Deploy'dan keyin tekshirish

```bash
pm2 status                                                # tinglovchi va institute-ais → online
pm2 logs tinglovchi --lines 50 --nostream                 # "[identity] sync: N ..." bor
pm2 logs tinglovchi --lines 200 --nostream | grep '\[SPA\]' | tail -1   # "[SPA] frontend build ..." bo'lsin
#   pm2 log fayllari restartdan keyin ham saqlanadi: §3 dagi birinchi ishga tushishning "[SPA] build topilmadi"
#   qatori ularda qoladi — faqat ENG OXIRGI [SPA] qatoriga qarang

curl -s http://127.0.0.1:4500/api/health                  # {"status":"ok","service":"listener-backend"}
curl -s https://<tinglovchi-domeni>/api/health            # xuddi shu — nginx va TLS ishlaydi
curl -sI https://<tinglovchi-domeni>/login | head -1      # 200 — frontend build uzatilyapti

cd /srv/fjsti/tinglovchi/backend && npm run bridge:check  # ikkinchi natija qatorida ✓ (odatda ikkalasida) — §6

# asosiy → portal yo'nalishi: asosiy .env dagi manzil va kalit bilan
M=/srv/fjsti/backend/.env
curl -s -H "X-Service-Key: $(grep '^SERVICE_KEY=' $M | cut -d= -f2-)" \
     -H "X-Act-As: 000000000000000000000000" \
     "$(grep '^LISTENER_API_URL=' $M | cut -d= -f2-)/chat/unread-count"
#   {"unreadCount":0} — to'g'ri. 401 — SERVICE_KEY farq qiladi. HTML chiqsa — LISTENER_API_URL oxirida /api yo'q
```

`/api/health` javob bersa MongoDB ham ulangan (backend bazaga ulanmaguncha portni ochmaydi); asosiy backend holatini
u tekshirmaydi — buni `[identity] sync` qatori va `bridge:check` ko'rsatadi.

**Brauzerda:**
1. `https://<tinglovchi-domeni>` — kirish sahifasi ochiladi.
2. Asosiy tizimda arizasi qabul qilingan tinglovchining JSHSHIR'i bilan kiring — «Kursga yozilish» sahifasi ochiladi.
   Toza tizimda bunday tinglovchi hali yo'q (§3 logida `[identity] sync: 0`) — 2–5-qadamlarni menejer birinchi arizani
   qabul qilgach bajaring. Sinov uchun `npm run seed:listener` ishlatmang (§6).
3. «O'quv jarayoni», «To'lov», «Sertifikat» sahifalari ma'lumot bilan ochiladi; DevTools → Network'da 401/403/5xx yo'q.
4. Biror hujjat yoki materialni oching — u `https://<asosiy-domen>/files/...` manzilidan `403` siz ochiladi.
5. Chat: DevTools → Network → WS'da `/socket.io/?EIO=4&transport=websocket` so'rovi `101` holatida. Chat oynasidan
   o'qituvchiga xabar yuboring — o'qituvchi uni asosiy tizimdagi Malaka oshirish chatida ko'radi, javobi portalda
   paydo bo'ladi. `pm2 logs tinglovchi` da `[bridge] upstream ulandi` qatori chiqadi.

### Muammolar

| Belgi | Sabab | Yechim |
|---|---|---|
| pm2'da `errored`, logda `[checkEnv] Xavfsizlik: zaif imzo siri bilan ishga tushib bo'lmaydi` | `LISTENER_JWT_SECRET`, `REFRESH_TOKEN_SECRET` yoki `SERVICE_KEY` bo'sh yoki 32 belgidan qisqa | `openssl rand -hex 32` (§3); `SERVICE_KEY` — asosiy `.env` dan |
| logda `Ishga tushirib bo'lmadi: ...` | MongoDB'ga ulanib bo'lmadi yoki `MONGO_HOST` yo'q | `MONGO_HOST`, `sudo systemctl status mongod` |
| sahifa o'rniga `Yo'l topilmadi` JSON; logdagi oxirgi `[SPA]` qatori — `build topilmadi` | build yo'q yoki qo'yilgach restart qilinmagan | §4, `pm2 restart tinglovchi` |
| kirish sahifasi ochiladi, kirishda tarmoq xatosi | build `localhost:4500` bilan yig'ilgan | §4 «Build tekshiruvi», `.env.production` |
| `[identity] sync xatosi: Service kaliti yaroqsiz`; kirgandan keyin sahifalar ochilmay yana kirish sahifasiga qaytaradi | `SERVICE_KEY` ikki tomonda farq qiladi | §3 dagi `diff`; o'zgartirgach `pm2 reload institute-ais` va `pm2 restart tinglovchi` |
| `[identity] sync xatosi: Asosiy backend bilan aloqa uzildi` | `MAIN_API_URL` noto'g'ri yoki asosiy backend ishlamayapti | `MAIN_API_URL=http://127.0.0.1:4000/api`, `pm2 status` |
| barcha sahifalar `403 Tinglovchi roli sozlanmagan` | asosiy bazada `malaka_tinglovchi` roli yo'q | §2.2 |
| kirishda `Siz hali tinglovchi emassiz — kursga arizangiz tasdiqlanishi kerak` | asosiy tizimda bu JSHSHIR uchun kartochka ham, qabul qilingan ariza ham yo'q | menejer asosiy tizimda arizani qabul qilsin |
| kirishda `Foydalanuvchi bloklangan` | asosiy tizimda shu JSHSHIR'li foydalanuvchi bloklangan | asosiy tizimda hal qilinadi; sinxronizatsiya 10 daqiqa ichida yangilaydi |
| kirishda `503 Yangi tinglovchini tekshirib bo'lmadi` | portal bazasida yo'q JSHSHIR, asosiy backend javob bermadi | asosiy backend holati |
| kirishda `429 Juda ko'p urinish` | login limiti butun portal uchun bitta | `LOGIN_RATE_MAX` ni oshiring (§3), `pm2 restart tinglovchi` |
| sahifalarda `429 So'rovlar chegarasi oshib ketdi. Biroz kuting.` | asosiy backend portal orqali kelgan barcha so'rovlarni bitta mijoz sifatida sanaydi (1 daqiqada 200) | bir daqiqadan keyin o'zi tiklanadi; bu chegara `.env` orqali sozlanmaydi |
| hujjat yoki video asosiy domendan `403` bilan ochilmaydi | asosiy nginx `/files/` ni IP bo'yicha cheklagan yoki sahifa asosiy `FILE_URL_SECRET` almashtirilishidan oldin ochilgan (havola eski imzo bilan) | §2.3; sahifani yangilang (F5) |
| fayl yuklashda `413` yoki `502` | so'rov nginx `client_max_body_size` dan katta (`413`); `PROXY_MAX_BODY_MB` nginx chegarasidan kichik qilingan bo'lsa, undan katta so'rov `502` bilan uziladi | §5; `PROXY_MAX_BODY_MB` ni nginx chegarasiga tenglang |
| fayl yuklashda `400 Host ruxsat etilmagan` | asosiy `.env` da `PUBLIC_BASE_URL` bo'sh | §2.1 |
| o'qituvchi chatida `500 LISTENER_API_URL sozlanmagan`, `502` yoki `504` | asosiy `.env` da `LISTENER_API_URL` yo'q yoki portal ishlamayapti | §2.1, `pm2 status` |
| chat ishlaydi, lekin onlayn holat va «yozmoqda» yo'q; logda ko'p `[bridge] upstream xato` | socket.io ko'prigi asosiy backendga ulanmayapti | `npm run bridge:check` |
| DevTools'da `/socket.io/` faqat polling, `101` yo'q | nginx `/socket.io/` blokida Upgrade sarlavhalari yo'q | §5 |

### Asosiy backend ishlamay qolsa

| Funksiya | Holat |
|---|---|
| Portal bazasidagi tinglovchilarning kirishi va profili | ishlaydi |
| Yangi JSHSHIR bilan birinchi kirish | `503` |
| Kurs, ariza, to'lov, material va test sahifalari | `502` yoki `504` |
| O'quv jarayoni (progress) sahifalari | ishlamaydi |
| Chat | ro'yxat, yozishma va yuborish ishlaydi; ismlar va o'qituvchiga real-time yetkazish yo'q |
| Logda | `[bridge] upstream xato`, `[identity] sync xatosi`, `[progress] ...` ogohlantirishlari — asosiy backend tiklangach o'zi to'xtaydi |

---

## 9. Lokal ishlab chiqish (faqat dasturchi kompyuterida — serverda EMAS)

```bash
# backend — asosiy backend http://localhost:4000 da ishlab turishi kerak
cd backend
cp .env.example .env      # LISTENER_JWT_SECRET, REFRESH_TOKEN_SECRET — `openssl rand -hex 32`;
                          # SERVICE_KEY — lokal asosiy backend .env dagi bilan bir xil (kamida 32 belgi)
npm install
npm run dev               # http://localhost:4500

# frontend — ikkinchi terminalda, loyiha ildizidan (birinchisida backend `npm run dev` ishlab turadi)
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:4500/api — lokalda to'liq manzil shart
npm install
npm run dev               # http://localhost:5573 (port band bo'lsa ishga tushmaydi)
```

- Backend `.env` idagi `CORS_ORIGINS=http://localhost:5573` ni o'chirmang — usiz dev frontend CORS bilan bloklanadi.
- Vite dev serverida proxy yo'q, shuning uchun lokalda `VITE_API_URL` to'liq manzil bo'ladi.
- Production'ga o'xshash sinov: `/api` bilan build qilib (§4), `dist/` ni `backend/public/build/` ga ko'chiring,
  backendni qayta ishga tushiring va http://localhost:4500 ni oching.
- Lokal sinov tinglovchisi: `npm run seed:listener -- <JSHSHIR> "<F.I.Sh>" <kartochka-id>` — `<kartochka-id>` lokal
  asosiy bazadagi tinglovchi kartochkasining `_id` si (berilmasa asosiy tizimga bog'liq sahifalar bo'sh chiqadi).
  Odatda bu shart emas: tinglovchilar lokal asosiy backenddan ham avtomatik sinxronlanadi.

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` (backend) | `nodemon` bilan ishga tushirish |
| `npm start` (backend) | oddiy ishga tushirish |
| `npm run dev` (frontend) | Vite dev server |
| `npm run build` (frontend) | production build (`tsc --noEmit && vite build`) |
| `npm run typecheck` (frontend) | TypeScript tekshiruvi |
| `npm run preview` (frontend) | `dist/` ni http://localhost:4173 da ko'rsatadi; faqat to'liq `VITE_API_URL` bilan yig'ilgan build va `CORS_ORIGINS` ga qo'shilgan `http://localhost:4173` bilan ishlaydi |
