# DEPLOY — production (pm2 + nginx)

Bu qo'llanma **ikkala arxivni** qamraydi:
- `sanfak-backend` — Node/Express API, pm2 bilan ishlaydi (pm2 nomi `institute-ais`); serverda `/srv/fjsti/backend`
- `sanfak-frontend` — Vite build; `yarn build` natijasi backend'ning `public/build/` papkasiga ko'chiriladi va uni
  backend API bilan bir xil origin'dan o'zi uzatadi (§4); serverda `/srv/fjsti/frontend`. Frontend qadamlarining
  qisqa nusxasi — `sanfak-frontend` arxividagi `DEPLOY.md`.

Docker ishlatilmaydi.

---

## 0. Xavfsizlik

### 🔴 ENG MUHIM QATOR — `NODE_ENV` **aynan** `production` bo'lishi SHART

Toza o'rnatishda `.env` §2 da yaratiladi — tekshiruvni `pm2 start` dan keyin va har yangilashdan keyin bajaring:

```bash
grep -n '^NODE_ENV=' /srv/fjsti/backend/.env                        # kutilgan: NODE_ENV=production
pm2 env $(pm2 id institute-ais | tr -dc '0-9') | grep NODE_ENV      # process ICHIDA ham shu qiymat bo'lsin
```

`src/` dagi xavfsizlik qo'riqchilari `NODE_ENV` ni **fail-closed allowlist** bilan tekshiradi
(`src/shared/env.js` → `isDevEnv()`): faqat `dev`, `development`, `test`, `qa`, `local`
(katta-kichik harf farqsiz) sinov muhiti hisoblanadi. Bo'sh, o'rnatilmagan yoki boshqa har
qanday qiymat (`prod`, `staging` …) production kabi — qattiq rejimda ishlaydi.

Xavf teskari tomonda: `.env.example` da `NODE_ENV=dev` turadi. U production'da o'zgartirilmay
qolsa, quyidagi himoyalar **jimgina o'chadi** (server odatdagidek ishlayveradi, tashqaridan
bilinmaydi):

| Qayerda | `NODE_ENV` sinov qiymati (`dev`, `development`, `test`, `qa`, `local`) bo'lsa |
|---|---|
| `src/modules/4.01-auth/_authProviders/index.js` | fail-closed tekshiruvlar chetlab o'tiladi: bo'sh yoki `pin` qiymatli `AUTH_PROVIDER` `ALLOW_PIN_IN_PROD` siz ishlaydi ⇒ **PIN-login yoqiq qoladi** — faqat PIN bilan, parolsiz kirish. (Production rejimida esa `AUTH_PROVIDER=oneid` yoki `AUTH_PROVIDER=pin` + `ALLOW_PIN_IN_PROD=true` bo'lishi shart, aks holda server ishga tushmaydi.) |
| `src/modules/4.13-practice/practice/practice.routes.js` | amaliyot shartnomasini imzolashda (rektor va tashkilot imzosi) **ERI ixtiyoriy** bo'lib qoladi |
| `src/shared/corsOrigin.js` | `ALLOWED_ORIGINS` bo'sh bo'lsa `http://localhost:5173` / `http://127.0.0.1:5173` origin'lari qabul qilinadi |
| `src/index.js` | Swagger (`/api-docs`, `/api-docs.json`) mount qilinadi (nginx chetlab o'tilsa ochiq) |
| `src/shared/error.js` | 5xx javoblarida ichki xato matni va tafsiloti foydalanuvchiga qaytadi |
| `src/shared/publicBaseUrl.js`, `src/modules/4.03-teacher/_shared/verifyQr.js` | `PUBLIC_BASE_URL` bo'sh bo'lsa havola va QR-kodlar `localhost` manziliga quriladi |
| test-foydalanuvchi seedlari (pastda) | ochiq PIN'li sinov hisoblari **production bazasida yaratiladi** |

pm2 `--env production` bilan ishga tushirilganda jarayon `NODE_ENV=production` ni
`ecosystem.config.js` dan oladi (`.env` dagi qiymat uni almashtirmaydi); `--env production` siz
ishga tushirilsa, o'sha fayldagi `NODE_ENV=development` olinadi. Node orqali ishlaydigan seed va
migratsiya skriptlari (`seed/`, `scripts/`) esa qiymatni `.env` dan o'qiydi — shuning uchun `.env`
da ham, pm2 jarayonida ham aynan `NODE_ENV=production` bo'lishi shart.

Nega `prod` kabi qiymat ham yetarli emas: `src/modules/4.02-studyLoad/_shared/verifyQr.js`
`PUBLIC_BASE_URL` bo'sh bo'lganda QR chizishni faqat `NODE_ENV` harfma-harf `production` bo'lsa
to'xtatadi; `prod` kabi qiymatda QR `localhost` manziliga ishora qiladi. Qoida:
**`NODE_ENV=production`, harfma-harf.**

### So'rovlar chastotasini cheklash (rate limiting)
Limiterlar **maqsadga qarab ajratilgan** (`src/shared/rateLimiter.js`):

| Limiter | Qayerda | Byudjet | Kalit |
|---|---|---|---|
| `authLoginIpLimiter` | `POST /api/auth` | 15 daq / **100** | IP |
| `authLoginPinLimiter` | `POST /api/auth` | 15 daq / **8** | `oneIdPin` |
| `authRefreshLimiter` | `POST /api/auth/refresh` | 15 daq / 60 | foydalanuvchi (`refreshToken` ichidagi `_id`), bo'lmasa IP |
| `publicReadLimiter` | `/verify/*` va ommaviy (login'siz) endpointlar | 15 daq / 100 | IP |
| `apiLimiter` | `/api` (`src/index.js`, `authenticate`dan OLDIN) | 1 daq / **2000** | IP (`/api-docs`, `/files` skip) — yumshoq DoS backstop |
| `apiUserLimiter` | `/api` (`src/router.js`, `authenticate`dan KEYIN) | 1 daq / **200** | `req.user._id` — haqiqiy byudjet |
| `uploadLimiter` | fayl yuklash | 1 soat / 50 | IP |
| `fileAccessLimiter` | `/files` — faqat imzo talab qiladigan hujjatlar (`src/system/_shared/fileDownloadLogger.js`) | 1 daq / 300 | IP |

Login qatlamlarida `skipSuccessfulRequests: true` — **faqat muvaffaqiyatsiz**
urinishlar sanaladi.

🔴 **Nega umumiy API ikki qatlamli:** institut NAT ortida bitta IP'dan chiqadi (~15-20 faol
foydalanuvchi), SPA'ning bitta sahifasi 10+ so'rov yuboradi. Yagona IP-limiter bo'lsa, bir nechta
foydalanuvchi birgalikda byudjetni tugatib, HAMMA birdan 429 oladi. Shuning uchun IP qatlami
(`apiLimiter`, 1 daq / 2000) faqat yumshoq backstop, haqiqiy byudjet esa foydalanuvchi darajasida
(`apiUserLimiter`, 1 daq / 200, `authenticate`dan KEYIN ulangan — `src/router.js`). Raqamlar
asosi: foydalanuvchi byudjeti eng og'ir sahifa yuklanishidan (~30–43 so'rov) 5–6 barobar ko'p;
IP qatlami undan ~10 barobar katta. IP qatlami raqamini real production trafigi bo'yicha qayta
kalibrlash tavsiya etiladi.

🔴 **Nega `/api/auth` prefiksiga blanket limiter (`app.use("/api/auth", authLimiter)`) QO'YILMAYDI:**
u butun prefiksni (login + refresh + config + profile) bitta qattiq hisoblagichga bog'laydi —
oddiy `GET /profile` o'qishlari login byudjetini yeb qo'yadi:
```
21 × GET /api/auth/profile (bitta IP)  ->  keyin POST /api/auth  ->  429
```
Institut **NAT ortida bitta IP** bo'lgani uchun bu butun tashkilotni 15 daqiqaga
login'dan qulflaydi. Shuning uchun login limiti **faqat `POST /api/auth`** route'iga,
ikki qatlamli (IP yumshoq + PIN qattiq) shaklda ulangan.

`trust proxy` (`TRUST_PROXY`, default `1`) sozlanganligi sabab nginx orqasida
ham **mijozning haqiqiy IP manzili** bo'yicha hisoblanadi.

### Swagger — production'da yopiq
Ikki qatlam: (1) `src/index.js` uni faqat sinov qiymatlarida (`isDevEnv()`) mount qiladi —
production'da **umuman mount qilinmaydi**; (2) nginx `/api-docs` va `/api-docs.json` ga `404`
qaytaradi (`deploy/nginx.conf.example`). Nginx chetlab o'tilsa ham (to'g'ridan-to'g'ri `:4000`)
yopiq qoladi.

### `/files` — HMAC imzo bilan himoyalangan
`src/index.js` — `app.use("/files", express.static(...))` OLDIDAN
`src/shared/fileAccessGuard.js` middleware ishlaydi:
- **Rasmlar** (jpg/jpeg/png/gif/webp, kengaytma bo'yicha) — imzosiz ochiq
  (`<img src>`/`<a href>` `Authorization` header yubora olmaydi, cookie
  sessiyasi tizimda yo'q). Istisno: `uploads/images/public/` ostidagi fayllar (ommaviy
  formalar orqali yuklangan hujjat skanlari — 4.08, 4.10) kengaytmadan qat'i nazar imzo talab qiladi.
- **Hujjatlar** (pdf/doc/xlsx/video/svg/...) — `?t=<hmac>&e=<expiry>` imzo talab
  qiladi; imzosiz, soxta yoki muddati o'tgan so'rov `403` oladi. Imzo `src/shared/fileAccess.js`da
  `FILE_URL_SECRET` (yo'q bo'lsa `JWT_SECRET` dan hosila, logda ogohlantirish bilan) bilan
  hisoblanadi va havola bazaga yozilayotganda qo'yiladi (`buildFileUrl()`, `saveAndUpdatePdf()`,
  modul-ichi upload'lar). Production'da `FILE_URL_SECRET` ni alohida qo'ying.

#### Havola SIZIB CHIQSA — bekor qilish

Imzo `FILE_URL_SECRET` dan hosil bo'ladi, ya'ni **sirni almashtirish barcha
amaldagi havolalarni bekor qiladi**:

```
eski sir bilan imzo         ->  { valid: true }
sir almashtirilgandan keyin ->  { valid: false, reason: "imzo mos emas" }
```

Almashtirish: `.env` dagi `FILE_URL_SECRET` ga yangi tasodifiy qiymat (`openssl rand -hex 32`)
yozing va backend'ni qayta ishga tushiring (`pm2 reload institute-ais`) — sir jarayon xotirasida
saqlanadi.

🔴 **Narxi bor.** Havola javob qaytishida QAYTA imzolanadigan modullar —
**4.04**, **4.08**, **4.10** (`signFileUrls` / `fileUrlSign` qatlamlari) — hech
narsa sezmaydi. Qolgan modullardagi (4.05 va h.k.) **bazadagi eski havolalar
ishlamay qoladi**, va ularni `yarn migrate:file-urls` (pastda) tiklamaydi: skript `t`/`e`
parametri allaqachon bor qiymatlarga tegmaydi. Shuning uchun bu **favqulodda** chora
(havola sizib chiqqanda), muntazam rotatsiya emas.

**TTL.** Default ~10 yil (`FILE_URL_TTL_SECONDS` bilan qisqartiriladi; bo'sh yoki `0` — default).
Havola bazaga bir marta imzolanib yoziladi, shuning uchun TTL ni GLOBAL qisqartirish qayta
imzolash qatlami YO'Q modullardagi havolalarni muddat tugagach sindiradi. `FILE_URL_TTL_SECONDS`
ni bo'sh qoldiring; qisqartirish kerak bo'lsa, avval o'sha modullarga ham javob qaytishida qayta
imzolash (`fileResigner` — `src/modules/4.10-scientificDept/_shared/fileUrlSign.js`) qo'shilishi kerak.

### Bir martalik migratsiyalar — deploy'dan keyin

🔴 **1. `/files` havolalarini imzolash — ESKI MA'LUMOTLI BAZANI YANGILASHDA UNUTMANG** (toza o'rnatishda kerak emas). Bazaga imzosiz yozilgan
`/files/...` hujjat havolalari (masalan, avvalgi versiyadan qolgan ma'lumotlar) guard tomonidan
403 bilan rad etiladi. Deploy'dan keyin BIR MARTA ishga tushiring:
```bash
yarn migrate:file-urls:dry       # avval nima o'zgarishini ko'ring (yozmaydi)
yarn migrate:file-urls           # haqiqiy yozish — avval scripts/backups/ ga zaxira yozadi
```
Idempotent — qayta ishga tushirish xavfsiz (allaqachon imzolangan qiymatlarga va rasmlarga
tegmaydi). `auditlogs` kolleksiyasi o'tkazib yuboriladi. Zaxira fayli (`scripts/backups/`) har
bir o'zgargan maydonning eski qiymatini saqlaydi — uni o'chirmang. Skript:
`scripts/migrate-file-urls.js`.

🔴 **2. `oneIdPin` unique indeksi.** `oneIdPin` — kirish kaliti (parol yo'q); bazada
cheklov bo'lmasa, ikki foydalanuvchi bir xil PIN bilan bo'lganda login **noaniq** bo'ladi.
Deploy'dan keyin BIR MARTA:
```bash
yarn migrate:oneidpin-index:dry      # dublikat PIN bor-yo'qligini tekshiradi (yozmaydi)
yarn migrate:oneidpin-index          # partial unique indeks yaratadi
```
⚠️ Dublikat topilsa skript (`--dry` da ham, `--write` da ham) ro'yxatni chiqaradi va **`exit 1`**
qiladi — indeks yaratilmaydi. Dublikatni **qo'lda hal qiling** (qaysi hisob haqiqiy ekanini
aniqlab), keyin `yarn migrate:oneidpin-index`.
Indeks **partial** (`{oneIdPin: {$type: "string"}}`, nomi `oneIdPin_unique_partial`) — `sparse`
emas, chunki model'da `default: null` va sparse barcha PIN'siz userlarni "duplicate null" deb
rad etardi. Idempotent — indeks allaqachon bo'lsa o'zgarish qilmaydi. Indeks
`src/modules/4.01-auth/user/user.model.js` da ham e'lon qilingan, shuning uchun toza bazada u
server ishga tushganda yaratilgan bo'lishi mumkin — bunda skript «allaqachon mavjud» deb chiqadi.
Skript: `scripts/migrate-oneidpin-unique-index.js`.

### Dev-only "bir bosishda super_admin" PIN — production'da SEED QILINMAYDI
`seed/practice-users.seed.js` sinov muhitida `oneIdPin: "00000000000000"` bilan
`super_admin` hisobini yaratadi. PIN seed faylida ochiq yozilgan — uni bilgan har kim login
formasiga qo'lda kiritib butun tizim administratori bo'lardi.

Shuning uchun hisob **FAIL-CLOSED allowlist** ostida (`seed/practice-users.seed.js`):
```js
const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const SEED_DEV_ADMIN = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());
```
Ya'ni bu hisob **faqat yuqoridagi qiymatlar aniq berilganda** yaratiladi.

⚠️ **Nega `NODE_ENV !== "production"` EMAS:** bunday tekshiruv **fail-open** bo'lardi —
quyidagi hollarning HAMMASIDA backdoor yaratilardi:
| `NODE_ENV` | `!== "production"` tekshiruvi | Allowlist |
|---|---|---|
| o'rnatilmagan | 🔴 yaratilardi | ✅ yo'q |
| `""` (bo'sh) | 🔴 yaratilardi | ✅ yo'q |
| `prod` | 🔴 yaratilardi | ✅ yo'q |
| `Production` / `PRODUCTION` | 🔴 yaratilardi | ✅ yo'q |
| `staging` | 🔴 yaratilardi | ✅ yo'q |
| `dev` / `qa` / `test` | yaratilardi | yaratiladi (kutilgan) |

Ya'ni deploy'da bitta unutilgan yoki noto'g'ri yozilgan o'zgaruvchi butun tizim
administratorini yaratib qo'yardi. Allowlist bilan **default holat xavfsiz**: nimadir noto'g'ri
bo'lsa hisob **yaratilmaydi**.

Dev/QA muhitida (`.env` da `NODE_ENV=dev`) PIN sinov uchun ishlaydi.

⚠️ Qo'riqchi faqat shu `super_admin` hisobini qamraydi: seedning qolgan 4.13 sinov hisoblari
(ketma-ket PIN'lar bilan) har qanday muhitda yaratiladi. Shuning uchun
`seed/practice-users.seed.js` production'da umuman ishga tushirilmaydi.

### Test-foydalanuvchi seedlari qo'riqchi ostida

Test-foydalanuvchi seedlari seed fayllarida ochiq yozilgan PIN'lar bilan dekan/prorektor/rektor/kotib
va boshqa hisoblarni yaratadi (login FAQAT PIN bilan: `POST /api/auth {oneIdPin}`) —
production'da ishga tushirilsa, bular tayyor backdoor bo'ladi. Shuning uchun ularda xuddi shu
`DEV_ENVS` allowlist + `throw` bor, jumladan:

`studyload-users` · `teacher-chain-users` · `teacher-users` · `council-users` ·
`scientific-users` · `malaka-users` · `testUsers` · `residency-test-users` · `task-users`

Kanonik naqsh (`seed/task-users.seed.js`):
```js
const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());
// run() boshida:  if (!IS_DEV_ENV) throw new Error(...)
```

Qo'riqchi yo'qolmasligi uchun **avtomatik tekshiruv** bor: `scripts/check-seed-runbook.js`
nomida `users` yoki `test` bo'lgan seed qo'riqchisiz bo'lsa `exit 1` beradi (§3.0 — deploy-oldi
buyrug'i).

⚠️ Bu tekshiruv faqat fayl nomiga qaraydi. Nomida `users`/`test` bo'lmagan, qo'riqchisiz, lekin
ochiq PIN'li sinov hisobi yaratadigan seedlar ham bor: `seed/quality-login-user.seed.js`
(`talim_sifati_nazorati`), `yarn seed:malaka-manager` · `yarn seed:malaka-teacher` ·
`yarn seed:malaka-tinglovchi`. To'liq ro'yxat — «DEV-ONLY seedlar» bo'limida (§3);
ularni production'da ishga tushirmang.

**Qoida:** productionda test foydalanuvchilar **umuman yaratilmaydi** — faqat super admin;
qolgan hisoblar administrator tomonidan qo'lda yaratiladi. To'liq ro'yxat: §3.0 · birinchi administrator: §3.3 ·
dev/QA seedlari: «DEV-ONLY seedlar» bo'limi (§3).

**Sertifikat QR-kodi.** 4.04 sertifikat PDF'iga bosilgan QR-kod
(`src/modules/4.04-qualification/_pdf/sertifikat.pdf.js`) ommaviy tekshiruv sahifasiga —
`<PUBLIC_BASE_URL>/verify/<kod>` ga ishora qiladi (login'siz sertifikat haqiqiyligini tekshirish).
U `/files` imzosiga bog'liq emas va muddati tugamaydi. QR manzili `PUBLIC_BASE_URL` dan
quriladi — shuning uchun u production domeni bilan to'ldirilgan bo'lishi kerak.

**nginx `/files/` bloki:** namunada IP cheklovi yo'q — hujjatlarni backend'dagi HMAC imzo himoyalaydi.
Ixtiyoriy IP cheklovi va uning oqibatlari — §5, «`/files/` — yuklangan fayllar».

---

## 1. Server talablari

| Komponent | Versiya | Izoh |
|---|---|---|
| Node.js | **20.19 yoki yangiroq** (20.x ning oxirgi versiyasi) | frontend `engines: >=20` (`.nvmrc`: `20`), lekin `yarn.lock` dagi `vite@7` (vitest bog'liqligi) `^20.19.0 \|\| >=22.12.0` talab qiladi — eski 20.x da `yarn install` «The engine "node" is incompatible» xatosi bilan to'xtaydi. Tekshiruv: `node -v`. Backend `package.json` da `engines` ko'rsatilmagan — serverga shu versiyani o'rnating |
| yarn | 1.x (classic) | `npm i -g yarn`; ikkala arxivda `yarn.lock` bor |
| MongoDB | 6+ | mongoose 8 |
| nginx | 1.18+ | |
| pm2 | oxirgi | `npm i -g pm2`, so'ng `pm2-logrotate` (pastda) |
| Redis | ixtiyoriy | bitta pm2 jarayonida (fork, §2) kerak emas. Ulanish — `.env` dagi `REDIS_HOST`/`REDIS_PORT` (default `127.0.0.1:6379`). Redis bo'lmasa logda bir marta `[Redis] ulanib bo'lmadi ... asosiy API ishlayveradi` ogohlantirishi chiqadi — bu kutilgan holat, xato emas |
| Python | 3 (`pip` bilan) | 4.02 o'quv reja va o'quv jarayoni (XLSX/PDF) importi — `src/scripts/*.py` |
| Tesseract OCR | `uzb`, `rus`, `eng` tillari bilan | faqat skanerlangan PDF o'quv rejalarini o'qish uchun |
| curl | — | 4.10 h-indeks (Scopus Preview) uni ishga tushiradi; odatda serverda bor |

**Asosiy paketlar.** Node.js va MongoDB Ubuntu'ning standart repozitoriyasida kerakli versiyada yo'q — ularni rasmiy
manbadan o'rnating: Node.js 20.x — NodeSource (`deb.nodesource.com`) yoki `nvm`; MongoDB — `repo.mongodb.org` dagi
`mongodb-org` paketi (unga `mongosh` va `mongodump`/`mongorestore` ham kiradi — ular §6 dagi zaxira va hujjatdagi
`db.…` so'rovlari uchun kerak). Qolganlari:
```bash
sudo apt-get install -y nginx certbot rsync unzip
sudo systemctl enable --now mongod
node -v && yarn -v && mongosh --version && mongodump --version
```
Hujjatdagi barcha `db.…` so'rovlari mongosh ichida, backend bazasiga ulanib bajariladi (§2 dan keyin):
`mongosh "$(grep '^MONGO_HOST=' /srv/fjsti/backend/.env | cut -d= -f2-)"`

`canvas` native paket — Linux'da build kerak bo'lishi mumkin:
```bash
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev
```

Python paketlari va OCR (backend papkasida — §2 dagi arxiv ochilgandan keyin):
```bash
sudo apt-get install -y python3 python3-pip tesseract-ocr tesseract-ocr-uzb tesseract-ocr-rus
pip3 install -r src/scripts/requirements.txt
tesseract --list-langs     # ro'yxatda uzb, rus, eng bo'lsin
```

Yangi Ubuntu (23.04+) tizim Python'iga `pip3 install` ni rad etsa (`externally-managed-environment`),
paketlarni backend ichidagi virtual muhitga o'rnating (`.venv/` yangilashda saqlanadi, §6) va `.env` ga
`PYTHON_PATH` yozing:
```bash
sudo apt-get install -y python3-venv
python3 -m venv .venv && .venv/bin/pip install -r src/scripts/requirements.txt
# .env: PYTHON_PATH=/srv/fjsti/backend/.venv/bin/python
```
Python yoki tesseract boshqa yo'lda bo'lsa — `.env` da `PYTHON_PATH` / `TESSERACT_PATH` (pastdagi ixtiyoriy
o'zgaruvchilar jadvali).

**pm2 loglari.** pm2 o'z log fayllarini (`logs/pm2-out.log`, `logs/pm2-error.log`) aylantirmaydi — ular
cheksiz o'sadi. Bir marta o'rnating:
```bash
pm2 install pm2-logrotate
```
Ilova loglari (`logs/combined.log`, `logs/error.log`) 5 MB × 5 fayl bilan o'zi aylanadi.

**Server vaqt zonasi — `Asia/Tashkent`.** Rejali vazifalar (cron) server mahalliy vaqti bilan ishlaydi:
har kuni **08:00** — 4.05 davomat/chetlatish tekshiruvi va ERI sertifikati muddati xabarnomasi, **09:00** —
tasdiqlash muddatlari (SLA) nazorati. UTC serverda ular Toshkent vaqti bilan 13:00 va 14:00 da ishga tushadi.
```bash
sudo timedatectl set-timezone Asia/Tashkent     # pm2 allaqachon ishlayotgan bo'lsa: pm2 restart institute-ais
```

---

## 2. Backend

Backend `sanfak-backend` arxivi ko'rinishida keladi (ichida bitta `sanfak-backend/` papkasi). Buyruqlarni pm2
ishlaydigan foydalanuvchi nomidan bajaring. `/srv/fjsti` ga yozish huquqi bo'lmasa, avval
`sudo mkdir -p /srv/fjsti && sudo chown <pm2-foydalanuvchi>: /srv/fjsti` (`unzip` yo'q bo'lsa —
`sudo apt-get install -y unzip`).

```bash
mkdir -p /srv/fjsti
unzip sanfak-backend.zip -d /srv/fjsti/          # arxiv ichida: sanfak-backend/
mv /srv/fjsti/sanfak-backend /srv/fjsti/backend && cd /srv/fjsti/backend
yarn install --frozen-lockfile --production
cp .env.example .env
mkdir -p logs uploads
mkdir -p private/residency-expulsion-orders && chmod 700 private/residency-expulsion-orders
```

**To'xtang:** endi `.env` ni pastdagi jadval bo'yicha to'ldiring (kamida `NODE_ENV`, `AUTH_PROVIDER`,
`ALLOW_PIN_IN_PROD`, `MONGO_HOST`, `ALLOWED_ORIGINS`, `PUBLIC_BASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`,
`FILE_URL_SECRET`, `LISTEN_HOST`). Shundan keyingina:

```bash
grep -E '^(NODE_ENV|AUTH_PROVIDER|ALLOW_PIN_IN_PROD)=' .env   # kutilgan: production / pin / true
pm2 start ecosystem.config.js --env production
pm2 save && pm2 startup    # server restart bo'lsa avtomatik ko'tarilsin; chiqqan `sudo env PATH=... pm2 startup ...` ni ham bajaring
```

⚠️ `pm2 start` dan **OLDIN** `.env` ni pastdagi jadval bo'yicha to'ldiring. `.env.example` qiymatlari bilan
(`AUTH_PROVIDER=pin` + `ALLOW_PIN_IN_PROD=false`) server production'da ishga tushmaydi, `NODE_ENV=dev` esa
seed va skriptlarni dev rejimida ishlatadi. `pm2 startup` chiqargan `sudo ...` buyrug'ini ham bajaring.

### `.env` — production uchun muhim kalitlar

| Kalit | Qiymat | Izoh |
|---|---|---|
| `NODE_ENV` | `production` | 🔴 **aynan shu yozuv**. `.env.example` dagi `dev` ni almashtiring: `dev`/`development`/`test`/`qa`/`local` qiymatlarida himoyalar jimgina o'chadi, seed va skriptlar ham qiymatni `.env` dan o'qiydi (§0 boshidagi jadval) |
| `PORT` | `4000` | nginx upstream shunga qarab sozlangan |
| `LISTEN_HOST` | `127.0.0.1` | nginx ortida tavsiya etiladi: backend faqat serverning o'zidan ochiladi, nginx qatlami chetlab o'tilmaydi. Default — `0.0.0.0` (barcha interfeyslar); uni qoldirsangiz 4000-portni firewall bilan yoping |
| `MONGO_HOST` | `mongodb://127.0.0.1:27017/institute-ais` | |
| `ALLOWED_ORIGINS` | `https://<domain>` | vergul bilan bir nechta. **Bo'sh qoldirmang**. Socket.IO (real-time bildirishnoma, chat) ulanishlari faqat shu ro'yxat va `PUBLIC_BASE_URL` bo'yicha tekshiriladi — saytning o'z domeni ro'yxatda bo'lsin |
| `PUBLIC_BASE_URL` | `https://<domain>` | 🔴 **Production'da majburiy**, oxirida `/` siz. Hujjatlardagi tekshiruv QR-kodlari va yuklangan fayl havolalari shu manzil bilan quriladi (havola bazaga shu ko'rinishda yoziladi — birinchi yuklashdan oldin to'g'ri qiymat qo'ying); uning origin'i CORS ro'yxatiga avtomatik qo'shiladi. Bo'sh bo'lsa: 4.02/4.03 PDF'larida QR-kod chizilmaydi (logda `PUBLIC_BASE_URL sozlanmagan — QR chizilmadi`), fayl yuklash esa so'rovdagi domen `ALLOWED_ORIGINS` da bo'lmasa `400 Host ruxsat etilmagan` qaytaradi |
| `TRUST_PROXY` | `1` | Bitta nginx ortida `1` — aynan to'g'ri qiymat. Kalit `.env` da umuman bo'lmasa `1` ishlatiladi, lekin bo'sh qiymat (`TRUST_PROXY=`) `0` deb o'qiladi — qatorni bo'sh qoldirmang. `0`/`false`/bo'sh bo'lsa hamma so'rov `127.0.0.1` dan kelgandek ko'rinadi va limiter hammani birdan bloklaydi. `true` bo'lsa teskarisi: mijoz `X-Forwarded-For` ni o'zi yozib **limiterni aylanib o'tadi** (server yiqilmaydi, cheklov jimgina chetlab o'tiladi) |
| `AUTH_PROVIDER` | `pin` | Kirish usuli. Production'da faqat ikki holat qabul qilinadi: `oneid`, yoki `pin` + `ALLOW_PIN_IN_PROD=true`. Boshqa har qanday qiymatda (bo'sh ham) server **ataylab ishga tushmaydi** — logda `AUTH_PROVIDER production'da faqat "oneid" bo'lishi mumkin`, pm2 esa qayta urinishlardan so'ng jarayonni `errored` holatida to'xtatadi. `oneid` rejimi bu versiyada qo'llab-quvvatlanmaydi (har bir login `501 OneID sozlanmagan` qaytaradi) — `pin` + `ALLOW_PIN_IN_PROD=true` ishlating (§3.3, «Login rejimi») |
| `ALLOW_PIN_IN_PROD` | `true` | `AUTH_PROVIDER=pin` ni production'da ochadi. Faqat `true` qabul qilinadi (`1`/`yes` emas). ⚠️ Bu rejimda 14 xonali PIN yagona kirish kaliti — parol va ikkinchi bosqich yo'q; login urinishlari cheklangan (§0, Rate limiting) |
| `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `FILE_URL_SECRET` | kuchli tasodifiy, har biri alohida | `openssl rand -hex 32`. Default/namuna qiymatni (`test`, `CHANGE_ME`) **qoldirmang**. `FILE_URL_SECRET` — `/files` hujjat havolalarining imzo siri; bo'sh bo'lsa `JWT_SECRET` dan hosil qilinadi (logda ogohlantirish). Imzo siri almashtirilsa bazadagi eski hujjat havolalari bekor bo'ladi (§0, `/files` bo'limi) — shuning uchun `FILE_URL_SECRET` ni (u bo'sh bo'lsa `JWT_SECRET` ni ham) faqat favqulodda holatda almashtiring |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `4h` / `3d` | access va refresh token muddati. 🔴 Bo'sh qoldirmang — aks holda login xato bilan tugaydi |
| `FILEPATH` | `./` | Yuklangan fayllar ildizi — backend papkasi, oxirida `/` bilan: `./` (pm2 `cwd` — backend papkasi) yoki `/srv/fjsti/backend/`. Yo'l satr ulash bilan quriladi: `/srv/fjsti/backend` (oxirida `/` siz) yozilsa fayllar `/srv/fjsti/backenduploads` ga tushadi. `/files` doim `<backend>/uploads` dan uzatiladi — boshqa ildiz ko'rsatilsa fayllar saqlanadi, lekin ochilmaydi. Bo'sh bo'lsa yuklash `500 FILEPATH muhit o'zgaruvchisi sozlanmagan` |
| `MONGOOSE_DEBUG` | bo'sh | Production'da bo'sh qoldiring (`.env.example` dagi `false` ni o'chiring): har qanday bo'sh bo'lmagan qiymat, hatto `false` ham, so'rovlar debug-logini yoqadi |
| `TASK_TELEGRAM_BOT_TOKEN` | bot tokeni yoki **bo'sh** | 4.07 Topshiriqlar modulining ALOHIDA boti (tizim botidan mustaqil, o'zining soniyasiga 30 so'rovlik chegarasi bilan). Bo'sh bo'lsa Telegram orqali xabar yuborilmaydi — ilova ichidagi bildirishnoma baribir ishlaydi. ⚠️ Bitta tokenni ikki instansiya (masalan, sinov va production serverlari) bir vaqtda ishlatmasin: Telegram `409 Conflict` beradi va bot foydalanuvchilarning telefon raqamini ulash xabarlarini qabul qilmay qo'yadi |
| `TELEGRAM_BOT_TOKEN` | bot tokeni yoki bo'sh | Tizim boti (@BotFather). Bo'sh bo'lsa telegram kanali o'chiq. `.env.example` dagi namuna qiymatni qoldirmang |
| `TELEGRAM_CHAT_ID` | xizmat chati ID si yoki bo'sh | Chati ko'rsatilmagan umumiy tizim xabarlari shu chatga yuboriladi: yangi e'lon, stipendiya arizasi natijasi, iqtidorli talaba faoliyati holati, 4.05 davomat ogohlantirishi (rezidentning F.I.Sh. va sababsiz soatlari bilan). Foydalanuvchiga yuboriladigan shaxsiy bildirishnomalar faqat uning o'z chatiga ketadi. Chatda shaxsiy ma'lumot bo'lgani uchun faqat mas'ul xodimlar a'zo bo'lgan yopiq chat ID sini qo'ying |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.gmail.com` / `587` / `false` | Email bildirishnomalar (masalan, 4.08 Xalqaro qabul arizachilariga xatlar). 465-port uchun `SMTP_SECURE=true`. `SMTP_HOST` yoki `SMTP_USER` bo'sh bo'lsa email kanali o'chadi |
| `SMTP_USER` / `SMTP_PASS` | pochta manzili / ilova paroli | Gmail/Google Workspace: ikki bosqichli himoya yoqilgan hisobda Google Account → Security → App passwords orqali 16 belgili parol yarating (oddiy parol ishlamaydi). Namuna qiymatlarni qoldirmang |
| `SMTP_FROM` | `"Xalqaro qabul <noreply@<domain>>"` | jo'natuvchi; bo'sh bo'lsa `SMTP_USER` |
| `SAMS_SERVICE_KEY` | bo'sh (SAMS ulanguncha), keyin tasodifiy: ` openssl rand -hex 32` | 4.05 — SAMS davomat integratsiyasi kaliti (`X-Sams-Service-Key`). Kamida 32 belgi va `SERVICE_KEY` dan **farqli** bo'lishi shart; SAMS tomonida ham aynan shu qiymat (`RESIDENCY_SYNC_SERVICE_KEY` o'zgaruvchisiga) qo'yiladi. Bo'sh/qisqa/`SERVICE_KEY` bilan bir xil bo'lsa `/api/residency-sams/*` har doim `401` qaytaradi va bootda bitta `[residency-sams] SAMS_SERVICE_KEY sozlanmagan …` ogohlantirishi chiqadi, server esa ishlayveradi. Qo'yish tartibi — §6.2, «SAMS davomat ma'lumotlarini qabul qilish» |
| `SERVICE_KEY` | kuchli tasodifiy yoki bo'sh | 4.04 Malaka oshirish tinglovchilar portali (alohida backend) bilan server-server aloqa kaliti (`X-Service-Key`); ikkala tomonda bir xil qiymat, kamida 32 belgi (`openssl rand -hex 32`; portal qisqaroq kalit bilan ishga tushmaydi). `.env.example` da bu qator yo'q — qo'lda qo'shing. Bo'sh bo'lsa bu integratsiya so'rovlari `401` oladi. Integratsiya ishlatilmasa bo'sh qoldiring. Portalni o'rnatish — `fjsti-tinglovchi` arxividagi `DEPLOY.md` |
| `LISTENER_API_URL` | tinglovchilar portali backendi manzili yoki bo'sh | 4.04 o'qituvchi↔tinglovchi chati shu manzil orqali ishlaydi. Oxirida `/api` shart: portal shu serverda bo'lsa `http://127.0.0.1:4500/api`. `.env.example` da bu qator yo'q — qo'lda qo'shing (`fjsti-tinglovchi` arxividagi `DEPLOY.md`, §2). Bo'sh bo'lsa chat so'rovlari `500 LISTENER_API_URL sozlanmagan` qaytaradi, qolgan modullar ishlayveradi |
| `TASK_ASSIGNEE_GRANT_STRICT` | `false` | 4.07 ijrochi biriktirish qat'iyligi — pastdagi ogohlantirishni o'qing |

> `ecosystem.config.js` ga sir yozmang — u kodning bir qismi va har yangilanishda almashtiriladi; sirlar faqat `.env` da.

### Ixtiyoriy o'zgaruvchilar (bo'sh qoldirilsa default ishlaydi)

| Kalit | Default | Ma'nosi |
|---|---|---|
| `PYTHON_PATH` | `python3` | Python interpretatori (§1); virtual muhit ishlatilsa — uning `bin/python` yo'li |
| `TESSERACT_PATH` | `PATH` dagi `tesseract` | tesseract boshqa joyda bo'lsa — to'liq yo'li |
| `OCR_LANGS` | o'rnatilganlardan `uzb`/`rus`/`eng` | OCR tillari, masalan `uzb+rus+eng` |
| `AUDIT_LOG_READS` | `records` | GET so'rovlarining audit jurnaliga yozilishi: `all` — hammasi (jurnal tez o'sadi), `records` — faqat aniq yozuv (`/<id>`) va eksport/PDF/yuklab olish, `none` — GET yozilmaydi. O'zgartiruvchi so'rovlar har doim yoziladi |
| `NOTIFY_CHANNEL_TIMEOUT_MS` | `3000` | Telegram/email/SMS kanaliga bitta yuborishda maksimal kutish (ms) |
| `FILE_URL_TTL_SECONDS` | ~10 yil | hujjat havolasi imzosining muddati (soniya). Qisqartirmang: bazaga yozilgan havolalar muddati o'tgach `403` bilan ochilmay qoladi (§0, `/files` bo'limi) |
| `ERI_REQUIRED` | `false` | `false` qoldiring. `true` — 4.02 tasdiqlash zanjirlarida haqiqiy ERI imzosi majburiy bo'ladi (`TEMP_ERI_PLACEHOLDER` qiymati rad etiladi); joriy frontend tasdiqlashda ERI imzosini yubormaydi, shuning uchun `true` bilan 4.02 dagi tasdiqlashlar to'xtaydi |
| `STRICT_RBAC` | `false` | `true` — ishga tushishda bazadagi ruxsatlar katalogi kod bilan mos kelmasa server to'xtaydi (`exit 1`); aks holda faqat ogohlantirish |
| `REDIS_HOST` / `REDIS_PORT` | `127.0.0.1` / `6379` | faqat Redis ishlatilsa (§1) |
| `RESIDENCY_ANNOUNCEMENT_FILES_DIR` | `<FILEPATH>uploads/residency-announcements` | 4.05 e'lon biriktirmalari |
| `RESIDENCY_ANNOUNCEMENT_MAX_FILE_MB` / `_MAX_FILES` / `_MAX_TOTAL_MB` | `25` / `10` / `100` | bitta fayl hajmi, e'londagi fayllar soni, umumiy hajm. nginx `client_max_body_size 25M` bitta so'rovni cheklaydi — kattaroq qiymat qo'ysangiz uni ham oshiring |
| `RESIDENCY_ANNOUNCEMENT_TMP_TTL_MIN` / `_TMP_SWEEP_MIN` | `60` / `60` | yakunlanmagan yuklamalarning saqlanish muddati va tozalash oralig'i (daqiqa) |
| `RESIDENCY_EXPULSION_ORDER_FILES_DIR` | `<FILEPATH>private/residency-expulsion-orders` | 4.05 chetlatish buyrug'i skanlari va buyruq loyihasi PDF'lari. `uploads/` va `public/build/` dan **TASHQARIDA** bo'lishi shart — aks holda har yuklash `500 scan_root_public` (§6.2) |
| `RESIDENCY_EXPULSION_SCAN_MAX_MB` | `10` | skan hajmi chegarasi; 25 dan katta qiymat 25 ga tushiriladi (nginx chegarasi) |
| `RESIDENCY_NOTICE_FILES_DIR` | `<FILEPATH>uploads/residency-notices` | 4.05 bildirgi fayllari |
| `RESIDENCY_IMPORT_MAX_MB` / `RESIDENCY_IMPORT_MAX_ROWS` | `5` / `1000` | 4.05 rezidentlar ro'yxati importi chegaralari |
| `RESIDENCY_SAMS_TICK_MINUTES`, `RESIDENCY_SAMS_STALE_TICKS`, `RESIDENCY_SAMS_CLOSE_GRACE_HOURS`, `RESIDENCY_SAMS_RESEND_MAX_DAYS`, `RESIDENCY_SAMS_DIGEST_HOUR` | `15` / `2` / `6` / `30` / `10` | 4.05 SAMS monitori (§6.2, «SAMS monitori»): SAMS yuboruvchisining tik oralig'i (daqiqa), necha tikdan keyin ma'lumot eskirgan hisoblanadi, kun yopilishini kutish (soat), avtomatik qayta yuborish so'rovining eng uzoq chegarasi (kun, ko'pi bilan `30` — ingest bugun-30 dan eskisini rad etadi) va bo'limga kunlik yig'ma yuboriladigan soat (UZ). Yaroqsiz qiymat — standart qiymat ishlatiladi va logda bitta ogohlantirish chiqadi |
| `GIFTED_IMPORT_MAX_MB` / `GIFTED_IMPORT_MAX_ROWS` | `5` / `1000` | 4.11 iqtidorli talabalar ro'yxati importi chegaralari |
| `SMS_EMAIL` / `SMS_PASSWORD` / `SMS_FROM` | bo'sh / bo'sh / `4546` | Eskiz.uz SMS shlyuzi hisobi; `SMS_EMAIL` yoki `SMS_PASSWORD` bo'sh bo'lsa SMS kanali o'chiq |
| `PDF_MINISTRY_1`, `PDF_MINISTRY_2`, `PDF_INSTITUTE_NAME`, `PDF_RECTOR_TITLE`, `PDF_KADRLAR`, `PDF_CITY` | institut matnlari | 4.02 o'quv reja va sillabus PDF sarlavhalari (vazirliklar, institut nomi, rektor lavozimi, imzo bloki, shahar). Ko'p qatorli qiymat qo'shtirnoq ichida `\n` bilan: `PDF_KADRLAR="1-qator\n2-qator"` |
| `SCOPUS_API_KEY` / `SCOPUS_INST_TOKEN` | bo'sh | 4.10 h-indeks: avval ochiq Scopus Preview ishlatiladi (serverda `curl` bo'lishi shart); kalit faqat Preview ishlamaganda zaxira sifatida ishlatiladi |
| `TRAINEE_AUDITORIUM_HOUR` | assistent normasi | faqat `yarn seed:trainee-norma` uchun — stajyor o'qituvchi auditoriya normasi |

`.env.example` dagi `CRYPTO_ALGORITHM`, `CRYPTO_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_ADMIN_EXPIRESIN`,
`JWT_REFRESH_ADMIN_EXPIRESIN`, `PUBLIC_FOLDER`, `ONEID_*`, `FRONTEND_URL`, `FRONTEND_LOGIN_CALLBACK` kalitlarini
tizim o'qimaydi — ularni to'ldirish shart emas (`ADMIN_*` orqali hech qanday hisob yaratilmaydi; birinchi
administrator — §3.3).

### ⚠️ `TASK_ASSIGNEE_GRANT_STRICT` — yakuniy qadam, tugma emas

`true` qilinganda `taskAssigneeGrant` da qatori **yo'q** har bir foydalanuvchi
hech kimga topshiriq bera olmaydi — jumladan **rektor, prorektor, dekan, kafedra
mudiri**. Faqat `super_admin`/`admin` mustasno.

Yangi o'rnatishda grant'lar **0 ta** bo'ladi, ya'ni darhol yoqsangiz butun
rahbariyat bloklanadi. To'g'ri tartib:

1. "Ijrochilarni biriktirish" sahifasida HAR BIR beruvchiga ro'yxat to'ldiring
2. o'sha sahifadagi «Ijrochilari» ustunida topshiriq beradigan hech bir foydalanuvchida **`umumiy qoida`** belgisi qolmasin
3. shundan keyingina `true` qiling

Faqat "kimga bera oladi" tekshiruviga ta'sir qiladi (`assertAssignableScope`).
`task:create` ruxsati alohida va oldinroq ishlaydi — STRICT'da ham "Yangi
topshiriq" formasi ochiladi, lekin ijrochi tanlash ro'yxati bo'sh bo'ladi va API'ga qo'lda ID
yuborilsa 403 qaytadi. Bayroq bo'sh yoki `false` (default) bo'lsa, ro'yxati bo'sh
foydalanuvchi rolining doirasi (`scopeLevel`) bo'yicha ishlaydi; ro'yxati
to'ldirilgan foydalanuvchi esa bayroqdan qat'i nazar faqat o'z ro'yxatidagilarga
topshiriq bera oladi. Qiymat faqat `true` bo'lganda yoqiladi.

### ⚠️ pm2: cluster mode ISHLATMANG
`ecosystem.config.js` da `instances: 1`, `exec_mode: "fork"` — **ataylab**.
Tizim bitta jarayonda ishlashga mo'ljallangan: socket ulanishlari (onlayn foydalanuvchilar
ro'yxati) jarayon xotirasida — Redis bo'lmasa har worker faqat o'z ulanishlarini ko'radi;
workload norma keshi (60 s) worker'lar orasida farq qiladi; `src/app/scheduler/` cron'lari
(`expulsionCron`, `samsMonitorCron`, `slaCheckerCron`, `eriExpiryCron`) cluster'da **har worker'da** ishlaydi
(dublikat yuborish/chetlatish). Cluster kerak bo'lsa avval Redis (socket.io adapteri uchun)
va cron uchun distributed lock kerak.

### `uploads/` saqlanishi shart
Yuklangan fayllar `uploads/` da. Deploy va yangilash paytida **o'chirmang** va zaxiraga oling.

4.5 chetlatish buyrug'i skanlari (akt dalili, shaxsiy ma'lumot) va tizim yaratgan buyruq loyihasi PDF'lari (`draft/` ostida, shaxsiy ma'lumot)
`uploads/` dan **tashqarida** — `private/residency-expulsion-orders` (§6.2). Ular ham o'chirilmaydi va zaxiraga olinadi.

---

## 3. RBAC seed — MAJBURIY

Kod o'zi yetarli emas: rol↔permission katalogi DB'da yashaydi.

### Bitta buyruq bilan — `yarn setup:seed` (tavsiya etiladi)

Pastdagi §3.0 dagi majburiy seedlarning **hammasini** to'g'ri tartibda bitta buyruq bajaradi — ularni bittalab
terish shart emas. Backend papkasida, pm2 foydalanuvchisi nomidan (`.env` §2 bo'yicha to'ldirilgan bo'lsin):

```bash
cd /srv/fjsti/backend
yarn setup:seed
```

Skript nima qiladi (tartib bilan):

1. **Tekshiradi — hech narsa yozmasdan:** `.env` dagi `MONGO_HOST` va `NODE_ENV=production`; §3.0 dagi
   `check-seed-runbook` tekshiruvi; seed rejasi (`seed/_deploy-plan.js`) — har bir rol/ruxsat seedi rejada, rejada
   test yoki demo seed yo'q; MongoDB'ga ulanish. Baza nomi va hozirgi holat (guruh, ruxsat, rol, foydalanuvchi soni)
   ekranga chiqadi.
2. **Rejani ko'rsatib, tasdiq so'raydi** (`ha` / `yo'q`). Bir vaqtda ikkinchi `setup:seed` ishga tushmasligi uchun
   bazaga qulf qo'yadi (`setupseedlocks` kolleksiyasi; ish tugagach o'chiriladi).
3. **Zaxira oladi** — yozishdan OLDIN `roles`, `permissions`, `permissiongroups` kolleksiyalari
   `scripts/backups/setup-seed-<baza>-<vaqt>.json` fayliga yoziladi.
4. **31 qadamni bajaradi** — §3.0 dagi «Asosiy seed buyruqlari» bloki (1-blok + 2-blok) aynan o'sha tartibda, oxirida
   §3.3 dagi PIN indeksi (`yarn migrate:oneidpin-index`). Har qadam alohida jarayonda ishlaydi, birinchi xatoda
   to'xtaydi. Seed `exit 0` bilan tugasa ham chiqishida `[SKIP] rol topilmadi` kabi o'tkazib yuborilgan qadam bo'lsa —
   xato deb to'xtaydi.
5. **Yakuniy tekshiruvlar:** permission katalog drifti (pastdagi «Seed'dan KEYIN» bandi, `exit 0` bo'lishi shart),
   `admin` roli yo'qligi va (`NODE_ENV=production` da) repodagi sinov seedlari yaratadigan ochiq PIN'li hisoblarning
   birortasi ham faol emasligi (ro'yxat — `seed/_deploy-plan.js` dagi `TEST_ACCOUNT_PINS`; §3.3 oxiridagi va «DEV-ONLY
   seedlar» bo'limidagi barcha sinov PIN'lari). Topilsa — har biri uchun bloklash buyrug'i ko'rsatiladi.
6. **Birinchi administrator:** bazada faol `super_admin` foydalanuvchisi bo'lmasa — terminalda JSHSHIR (ekranda `*`
   ko'rinishida, ikki marta), so'ng ism va familiyani (avval **ism**, keyin familiya, ixtiyoriy — otasining ismi) so'raydi
   va §3.3 dagi `seed/first-admin.seed.js` orqali yaratadi. JSHSHIR skriptga stdin orqali uzatiladi — shell tarixiga,
   jarayonlar ro'yxatiga (`ps`) va logga tushmaydi. Kiritilgan JSHSHIR boshqa hisobga tegishli bo'lsa — hech narsa
   yaratilmaydi va sababi ko'rsatiladi. Faol administrator bor bo'lsa — tegmaydi.
7. **Natija:** har qadam holati, tekshiruvlar, zaxira fayli va to'liq log (`scripts/backups/setup-seed-<baza>-<vaqt>.log`;
   logda `MONGO_HOST` paroli va 14 xonali raqamlar yashiriladi).

Odatda ~1 daqiqa. Muvaffaqiyatli tugagach backendni qayta yuklang — `pm2 reload institute-ais` — va logda
`[RBAC] Integrity OK` qatorini tekshiring (pastdagi «Asosiy seed buyruqlari» dan keyingi izoh).

| Bayroq | Vazifasi |
|---|---|
| `--dry` | Hech narsa yozmaydi: ko'rish rejimi bor seedlarni shu rejimda ishga tushirib, qaysi huquqlar **olib tashlanishini** yoki almashtirilishini xulosada ko'rsatadi. Yangilashda (§6) avval shu. Xulosa seed chiqishidan avtomatik ajratiladi — to'liq tafsilot `scripts/backups/setup-seed-dry-…log` da. Ko'rish rejimi yo'q seedlar o'tkaziladi va alohida ro'yxatlanadi: ular haqiqiy ishga tushirishda o'z bo'limlarini kanonik holatga keltiradi (admin panelida shu bo'limlarga qo'lda qo'shilgan huquqlar qaytarilishi mumkin). Ko'rish rejimida ishlamagan qadam (odatda oldingi qadam yaratadigan narsa hali yo'qligi sababli) «ko'rib bo'lmadi» deb belgilanadi va keyingilari davom etadi. Bo'sh bazada ko'rsatadigan farq yo'q |
| `--yes` | Hech narsa so'ramaydi (avtomatik deploy uchun). Bu holda birinchi administrator yaratilmaydi — natijada uni qo'lda yaratish buyrug'i ko'rsatiladi (§3.3) |
| `--skip-admin` | Birinchi administrator qadamini o'tkazadi |
| `--restore <fayl>` | Zaxiradan `roles`, `permissions`, `permissiongroups` ni to'liq qaytaradi (oldin joriy holat ham zaxiralanadi). Avval vaqtinchalik kolleksiyalarga yoziladi va faqat uchalasi muvaffaqiyatli bo'lsa almashtiriladi — xato bo'lsa joriy kolleksiyalarga tegilmaydi. Boshqa bazadan olingan zaxirani rad etadi — ataylab bo'lsa `--allow-other-db`. Keyin `pm2 reload institute-ais` |
| `--force-unlock` | Oldingi, to'xtab qolgan ishga tushirish qoldirgan qulfni olib tashlaydi. Qulf egasi shu serverdagi va endi mavjud bo'lmagan jarayon bo'lsa, skript uni o'zi aniqlab olib tashlaydi — bayroq faqat qulf boshqa serverdan qolganda kerak. Boshqa `setup:seed` haqiqatan ishlamayotganiga ishonch hosil qilgandan keyingina |
| `--out-dir <papka>` | Zaxira va log papkasi (default `scripts/backups`) |
| `--verbose` | Har seedning to'liq chiqishini ekranga ham chiqaradi |
| `--allow-dev` | `NODE_ENV=production` bo'lmagan (dev/QA) bazada ishlash. Dev muhitida `seed:admission-4.8` `qabul_xodim` sinov hisobini yaratadi — production'da ishlatmang |

Exit kodi: `0` — hammasi tayyor; `1` — qadam yoki tekshiruv xato (xato qadam va uning chiqishi ekranda; sababini
tuzatib, buyruqni qayta ishga tushiring — seedlar idempotent; seedlar yozilgan-u, faqat yakuniy tekshiruv o'tmagan
bo'lsa, skript buni alohida aytadi va zaxiradan qaytarish kerak emas); `2` — sozlama xatosi, qulf band yoki
tasdiqlanmadi (bazaga hech narsa yozilmagan); `130` — Ctrl+C yoki signal bilan to'xtatildi (qadamlar qisman yozilgan
bo'lishi mumkin — buyruqni qayta ishga tushiring). `0` dan boshqa har qanday kodda keyingi deploy qadamlariga
(`pm2 reload`) o'tmang.

⚠️ `npm run setup:seed --dry` **ishlatmang** — npm bayroqni skriptga uzatmaydi va buyruq yozish rejimida ishga tushadi.
Ko'rish rejimi tasdiq so'ramaydi; «Davom etamizmi?» savoli chiqsa, bu yozish rejimi — `yo'q` deb javob bering.
To'g'risi: `yarn setup:seed --dry` yoki `node scripts/setup-seed.js --dry`.

Qo'lda bajarish yoki bitta seedni qayta ishga tushirish kerak bo'lsa — pastdagi §3.0 buyruqlari o'z kuchida: skript
aynan ularni bajaradi. Yangi rol/ruxsat seedi qo'shilsa, uni `package.json`, shu hujjat **va** `seed/_deploy-plan.js`
ga kiritish shart — `check-seed-runbook` uchalasini tekshiradi.

### 3.0. Deploy-oldi tekshiruvi + productionda NIMA ishga tushadi

**Deploy'dan OLDIN** (`seed/` fayllari ↔ `package.json` ↔ shu hujjat mosligini tekshiradi):
```bash
node scripts/check-seed-runbook.js       # yoki: yarn check:seed-runbook
```
Kutilgan chiqish — uchalasi ham ✅ bo'lishi shart (aks holda `exit 1`):
```
✅ RBAC seed oilasi to'liq — script + runbook mos.
✅ Test-foydalanuvchi seedlarida fail-closed DEV_ENVS qo'riqchisi to'liq.
✅ yarn setup:seed rejasi RBAC seed oilasini to'liq qamraydi.
```
Skript bazaga ulanmaydi: u `seed/` papkasini, `package.json` ni,
`docs/DEPLOY.md` matnidagi `yarn <skript>` / `seed/<fayl>.seed.js`
eslatmalarini va `yarn setup:seed` rejasini (`seed/_deploy-plan.js`) o'qiydi. Shuning uchun bu fayl `docs/DEPLOY.md` da qolishi va §3
dagi seed buyruqlari hujjatdan o'chirilmasligi kerak.

Nega kerak: (a) yangi rol/permission seedi qo'shilib, bu hujjat yangilanmasa —
yangi muhitda uni hech kim ishga tushirmaydi va rol grantsiz qoladi;
(b) yangi test-foydalanuvchi seedida muhit qo'riqchisi bo'lmasa — production'da
ochiq PIN bilan kiriladigan hisob (backdoor) paydo bo'ladi. Ikkalasi ham shu
yerda, production'ga yetmasdan ushlanadi.

Chiqishdagi `TEKSHIRILSIN (noaniq, RBAC emas, hujjatda yo'q)` ro'yxati exit
kodiga ta'sir qilmaydi. Bu seedlar majburiy deploy ro'yxatiga kirmaydi va deploy
paytida ishga tushirilmaydi; ular orasida ma'lumotni o'chiradigan yoki
grantlarni qisqartiradigan bir martalik skriptlar ham bor. Ulardan birini
ishlatish zarur bo'lsa — avval zaxira oling, faylni ko'rib chiqing va DRY rejimi
bo'lsa avval shu rejimda ishga tushiring (ma'lumotnoma va qo'shimcha RBAC
seedlari uchun pastdagi «Ixtiyoriy seedlar» bandiga qarang).

#### Productionda ISHGA TUSHADI (tartib bilan)

1. **Permission katalogi** — pastdagi 1-blok: `seed:permission-groups` →
   `seed:permissions` → `seed:permissions:modules` → `seed:permissions:admission`
   → `seed:permissions:residency` → `seed:permissions:scientific`.
2. **Rol grantlari** — pastdagi 2-blok: `seed:super-admin` **eng birinchi**,
   darhol undan keyin `node seed/moderator-role.seed.js` (TZ 4.1
   "Bo'lim admini" aktori; ROL + GRANT yozadi, foydalanuvchi YARATMAYDI —
   production-safe), so'ng qolgan rol seedlari; `seed:admission-rektor` va
   `dashboard-rbac` — `rektor` rolini yaratadigan seedlardan KEYIN (ular `rektor`
   roli avvaldan mavjud deb hisoblaydi). Aniq tartib — pastdagi 2-blok.
   Tartib sababi — §3 dagi "Tartib nega shunday" bandi.

🔴 **Hech bir seed `admin` rolini yaratmaydi yoki unga grant bermaydi.**
`admin` nomi (`src/config/constants.js` dagi `ROLES.ADMIN`) 4.07, 4.09, 4.10,
4.13 xizmatlarida qattiq yozilgan bypass sifatida tekshiriladi
(`role.title === ROLES.ADMIN`) — bu nomdagi rol `super_admin` bilan bir qatorda
imtiyozli hisoblanadi. 4.7 va 4.13 dagi boshqaruv grantlari shuning uchun
`moderator` roliga beriladi. **Deploy'dan keyingi tekshiruv:** `roles`
kolleksiyasida `title="admin"` **bo'lmasligi** kerak (mongosh:
`db.roles.findOne({title:"admin"})` → `null`); rol nomlari drifti umuman esa
`node scripts/check-role-drift.js` bilan tekshiriladi (bazaga ulanmaydi;
`exit 0` = drift yo'q).

Bu ikki guruh — §3 sarlavhasi aytganidek **MAJBURIY**. Ular faqat rol↔ruxsat
katalogini yozadi va foydalanuvchi yaratmaydi (`moderator-role` ham faqat
`moderator` ROLINI yaratadi). Uchta `malaka-*` seedi (`seed:malaka-manager`,
`seed:malaka-teacher`, `seed:malaka-tinglovchi`) bu ro'yxatga kirmaydi: ular ochiq
PIN'li sinov hisoblarini yaratadi va production'da ishga tushirilmaydi (pastdagi
jadvalga va «DEV-ONLY seedlar» bo'limiga qarang).

`seed:admission-4.8` ROLNI har doim yozadi (production-safe); `oneIdPin:
"qabul_xodim"` sinov hisobi (`seed/admission-4.8.seed.js`) boshqa
test-foydalanuvchi seedlari bilan bir xil fail-closed `DEV_ENVS` qo'riqchisi
ostida — production'da bu qadam **faqat rolni** yozadi, foydalanuvchi
YARATMAYDI (chiqishda `SKIP sinov foydalanuvchisi` qatori ko'rinadi).

#### Productionda ISHGA TUSHMAYDI

| Nima | Nega |
|---|---|
| Test-foydalanuvchi seedlari (to'liq ro'yxat: pastdagi «DEV-ONLY seedlar» bo'limi) | Aksariyati **kod bilan bloklangan** — fail-closed `DEV_ENVS` allowlist, `NODE_ENV=production` da `throw` bilan to'xtaydi. 🔴 Istisnolar: `practice-users.seed.js` qo'riqchisi faqat `00000000000000` hisobini to'sadi, qolgan 4 ta ochiq PIN'li hisobni (`10000000000001…004` — `amaliyot_bolimi`, `rektor`, `tibbiyot_birlashmasi_rahbari`, `moderator`) istalgan muhitda yaratadi; `quality-login-user.seed.js` da qo'riqchi umuman yo'q. Ikkalasini ham production'da ishga tushirmang |
| Demo/sample seedlar: `domain-demo-data`, `malaka-demo-data`, `malaka-kimyo-demo`, `admission-demo`, `gifted-demo-data`, `studyload-demo`, `council-demo-data`, `council-sample-data`, `practice-sample-data`, `scientific-sample-data`, hamda nomi `-demo` / `-demo-data` / `-sample-data` bilan tugagan boshqa barcha seedlar (masalan `residency-demo-data`, `task-demo-data`, `quality-demo-data`) | Production ro'yxatiga ataylab kiritilmagan (§3.1, §3.2 — "FAQAT DEV/QA"). Bir qismida default DRY (`--write`/`--apply` talab qilinadi), qolganlari darhol YOZADI; **muhit qo'riqchisi yo'q** — himoya faqat "ishga tushirmang" qoidasi |
| `yarn seed:malaka-manager`, `yarn seed:malaka-teacher`, `yarn seed:malaka-tinglovchi` | 4.4 rollari uchun ochiq PIN'li **sinov hisoblarini** yaratadi, muhit qo'riqchisi yo'q; rol ruxsatlarini MERGE emas, to'liq almashtiradi (`malaka-teacher` esa `oqituvchi` rolidan 4.04 bo'limlarini olib tashlaydi). Rollar va grantlar uchun `seed:qual-roles` yetarli |
| `seed/setup-platform.js`, `seed/create-admin.js` | Dastlabki sozlash uchun yordamchi skriptlar, production uchun yaroqsiz — §3.3 |
| `seed/rektor-scope.seed.js` | `rektor` rolini test qulayligi uchun bitta modul doirasiga **cheklaydi** — production'da rol vakolatini kesadi |

🔴 **Quyidagilar ham hech qachon production'da ishga tushirilmasin:**

| Nima | Nega |
|---|---|
| `NODE_ENV=development mongosh <uri> seed/gifted-demo.seed.js` (⚠️ **AVVAL `node seed/gifted-users.seed.js`** — bu skript `41100000000001…005` PIN'larini qidiradi va topmasa `throw` qiladi; ⚠️ `gifted-demo-data.seed.js` bilan **ADASHTIRMANG** — ikkalasi ham bor, boshqa fayl; ⚠️ **`NODE_ENV=` prefiksi SHART** — mongosh `.env` ni o'qimaydi, prefikssiz qo'riqchi dev'da ham `quit(1)` beradi) | 🔴🔴 **DATA LOSS**: 6 ta 4.11 kolleksiyasini (`giftedstudents`, `evaluationcriterias`, `documenttypes`, `studentachievements`, `scholarships`, `scholarshipapplications`) `deleteMany({})` bilan TOZALAYDI. **Kod bilan bloklangan** — fail-closed `DEV_ENVS` qo'riqchisi faylning ENG BOSHIDA, birinchi `db.*` chaqiruvidan oldin (`quit(1)`) |
| `node seed/council-structure.seed.js --apply` | Qo'shimcha fakultet/kafedra daraxtini yaratadi (nomlari asosiy katalogdagidan boshqacha yozilgan — dublikat) + `users`ga `$set` + rol grant. Default DRY (`--apply` shart), lekin ishlatishdan oldin qo'lda ko'rik SHART |
| `node seed/indicators.seed.js` | 4.12 milliy reyting koeffitsientlarini `title` mos kelsa SO'RAMASDAN qayta yozadi, DRY yo'q |
| `node seed/methodical-specialties.seed.js` | "Eskirgan" deb topgan qatorlarni `deleteMany` bilan o'chiradi, apostrof variantini ko'rmaydi, default rejim YOZADI |
| `node seed/scientific-sample-data.seed.js` | Repoda ochiq PIN bilan `User.create(...)` qiladi, `DEV_ENVS` qo'riqchisi YO'Q (fayl nomida "users"/"test" yo'qligi sabab `check-seed-runbook.js` ham buni ushlamaydi — himoya faqat shu qoida) |
| `node seed/index.js` | Eskirgan skript, joriy versiyada ishlatilmaydi (ishga tushirilsa bazaga ulanishdan oldin `Cannot find module` xatosi bilan to'xtaydi) |
| `node seed/qual-exit-ready.seed.js`, `node seed/qual-cert-regenerate.seed.js` | Demo/operatsion skriptlar, default YOZADI, muhit qo'riqchisi yo'q. Rejali deploy qadami emas; zarurat bo'lsa avval `--dry` bilan natijani ko'ring |

> `practice-references.seed.js` (nomlar aniq mos kelmasa — masalan apostrof
> varianti — 14 viloyat dublikati) va `teacher-profiles.seed.js` (default
> YOZADI; profil normal oqimda xodim qo'shilganda `staff.service` orqali
> yaratiladi) ham shu xavfli sinfga kiradi — pastdagi «Ixtiyoriy seedlar»
> bandiga qarang.

⚠️ **Ixtiyoriy seedlar — ma'lumotnomalar (reference) va qo'shimcha RBAC.**
Quyidagilar yuqoridagi "ISHGA TUSHADI" ro'yxatiga **kiritilmagan**:
ma'lumotnomalarni admin panel (UI) orqali qo'lda ham kiritish mumkin. Ulardan
birini production bazasida ishlatmoqchi bo'lsangiz — avval zaxira oling va
DRY/diff chiqishini ko'rib chiqing (DRY rejimi bo'lmasa — pastdagi ogohlantirishni
o'qing):
`references.seed.js` (4.02 oqimini qo'lda sinash uchun namuna ma'lumotnomalar,
production uchun mo'ljallanmagan; idempotent, mavjud yozuvga tegmaydi) ·
`slaConfigs` (rol bo'yicha umumiy SLA muddatlari; DRY yo'q, mavjud sozlamani
qayta yozadi), hamda
mavjud rollarga ruxsat QO'SHADIGAN (ADDITIVE) RBAC yamoqlari:
`reference-read-rbac` (default DRY, `--write` bilan yozadi) · `chat-rbac` ·
`listener-rbac` · `oqituvchi-test-rbac`. 4.4 rollari uchun `listener-rbac` va
`oqituvchi-test-rbac` beradigan ruxsatlar `seed:qual-roles` da ham bor.
`check-seed-runbook.js` ularni "TEKSHIRILSIN (noaniq)" bo'limida ko'rsatadi.

🔴 `indicators` (mavjud koeffitsient `title` mos kelsa SO'RAMASDAN qayta yoziladi,
DRY yo'q), `practice-references` (apostrof farqi bo'lsa 14 viloyat dublikati, DRY
yo'q), `council-structure` (dublikat daraxt) va `teacher-profiles` (default
YOZADI) ixtiyoriy EMAS — ular production'da ishga tushirilmaydi (yuqoridagi
«Quyidagilar ham hech qachon production'da ishga tushirilmasin» jadvali va uning
ostidagi izoh); tegishli ma'lumotlar admin panel orqali kiritiladi.

**`academicTitles` va `positionAnnualHours` — DRY-default (`fermi-catalog.seed.js`
bilan bir xil naqsh).** Bayroqsiz chaqiruv HECH NARSA yozmaydi, faqat har bir
unvon/lavozim CREATE (faqat `academicTitles`) yoki UPDATE bo'lishini va UPDATE
bo'lsa qaysi maydon qanday **eskidan→yangiga** o'zgarishini ko'rsatadi:

```bash
node seed/academicTitles.seed.js            # DRY — to'liq chiqishni ko'ring
# rateTime/hourMultiplier o'zgarishi TT 4.2.4 me'yoriga mosligini tasdiqlagach:
node seed/academicTitles.seed.js --write

node seed/positionAnnualHours.seed.js        # DRY — annualHours/min/max diffini ko'ring
# 4.2 workloadValidator normasi o'zgarishini tasdiqlagach:
node seed/positionAnnualHours.seed.js --write
```

`--write` bo'lmasa (yoki `--write` va `--dry-run` birga berilsa) — DRY g'olib,
xuddi `yarn seed:fermi` / `yarn seed:fermi --write` bilan bir xil qoida.
Bu ikki seed majburiy ro'yxatga kirmaydi: production'da DRY chiqishi ko'rib
chiqilib, o'zgarishlar tasdiqlanmaguncha `--write` ishga tushirilmasin
(avval faqat DRY, hech qachon to'g'ridan `--write`).

**`norma-categories` — auditoriya normasi kategoriyalari.** Toza o'rnatishda: administrator admin panelda faol
auditoriya normasini yaratgach (4.2 yuklama taqsimotidan OLDIN) bir marta — DRY, so'ng `--write`. Faol yozuv bo'lmasa
skript «ACTIVE norma yozuvi YO'Q» deb hech narsa yozmaydi.
Xuddi shu DRY-default naqsh. NEGA KERAK: `auditoriumHour.categories[]` ni
**API ham, admin UI ham yoza olmaydi** (Joi sxemasida `categories` yo'q;
admin formasida faqat baza + `allowedStakes`), `references.seed.js` ning 18-bo'limi («Auditoriya normalari») esa
ularni faqat active yozuv UMUMAN yo'q bo'lganda yozadi. Kategoriya bo'lmasa
`workloadValidator.calcMinHour()` har lavozimni umumiy bazaga tushiradi —
masalan, faqat `trainee` kategoriyasi bo'lsa, dotsent ham, assistent ham bir
xil normani oladi va taqsimotdagi "me'yorga yetmagan / ortiqcha yuklama"
ogohlantirishlari ma'nosiz bo'ladi.

```bash
node seed/norma-categories.seed.js           # DRY — qaysi kategoriya qo'shiladi/yangilanadi
# professor 300 · docent 350 · senior_teacher 380 · assistant 400 · trainee 400
# (manba: references.seed.js §18 + trainee-norma.seed.js) — tasdiqlagach:
node seed/norma-categories.seed.js --write
```

MERGE: ro'yxatda yo'q slug **tegilmaydi** (faqat hisobotda), `title` faqat
bo'sh bo'lsa to'ldiriladi, nofaol yozuvlar o'tkazib yuboriladi. Idempotent —
qayta yurgizish 0 o'zgarish. Yozgandan keyin norma keshi **60 soniya**
(`NORMA_TTL_MS`) — taqsimot ekranida darhol ko'rinmaydi.

**Asosiy seed buyruqlari** (yuqoridagi "ISHGA TUSHADI" ro'yxati, shu tartibda):

```bash
# ── 1) Permission katalogi (UI guruhlash + ro'yxat — permit() bunga bog'liq emas, lekin tartib shu) ──
yarn seed:permission-groups       # TZ modul guruhlari (4.1–4.13 + qo'shimcha) — boshqa permission seedlar shu code'larga bog'lanadi
yarn seed:permissions             # permission katalogi (barcha modul, shu jumladan 4.5/4.10/4.13)
yarn seed:permissions:modules     # modul permissionlari (qual/studyload/science-council/task/council/gifted/practice)
yarn seed:permissions:admission   # 4.8 Xalqaro qabul katalogi
yarn seed:permissions:residency   # 4.5 Magistratura/klinik ordinatura katalogi
yarn seed:permissions:scientific  # 4.10 Ilmiy bo'lim katalogi

# ── 2) Rol grantlari ──────────────────────────────────────────────────────
yarn seed:super-admin                         # 🔴 super_admin roliga BARCHA modul×action — buni o'tkazib yuborilsa administrator hisobi imkoniyatsiz qoladi
node seed/moderator-role.seed.js -- --dry     # avval diffni ko'ring
node seed/moderator-role.seed.js              # moderator ROL + GRANT (TZ 4.1 "Bo'lim admini") — foydalanuvchi YARATMAYDI, prod-safe
# Quyidagi IKKI seed bayroqsiz ham MERGE qiladi (mavjud rol jimgina SKIP
#    qilinmaydi — grant har doim qo'llanadi, idempotent). `--sync-permissions`
#    bayrog'i qabul qilinadi, lekin xatti-harakatga ta'sir qilmaydi — eski
#    buyruq uni bersa ham xavfsiz. Avval har doim `--dry` bilan ko'ring — u
#    "+"/"-" diffni chiqaradi.
yarn seed:studyload-roles -- --dry      # avval diffni ko'ring
yarn seed:studyload-roles               # 4.2 O'quv yuklamalari: oqituvchi/kafedra_mudiri/oquv_uslubiy_boshqarma/reja_moliya/dekan/prorektor/rektor/arm va boshq.
#    ⚠️ Shu versiyadan `studyload-roles` `magistratura_bolim` ga o'quv reja kiritish (O'UB bilan bir xil CRUD) va
#       o'quv reja formasining 4 lug'atini (faqat o'qish) YOQADI — shu versiyada birinchi ishga tushirish = faollashuv.
#       `--dry` da faqat `magistratura_bolim` ning `+` qatorlari kutiladi; boshqa rolda `+` yoki istalgan `-` qatori
#       chiqsa — bazadagi grantlar seed bilan mos emas: yozishdan oldin farqni ko'rib chiqing.
yarn seed:teacher-roles    -- --dry     # avval diffni ko'ring
yarn seed:teacher-roles                 # 4.3 Shaxsiy ish reja zanjiri: dekan/kafedra_mudiri/oqituvchi va h.k.
#    ⚠️ `teacher-roles` ATAYLAB o'zgartiradi (TZ 4.3.9):
#       kafedra_mudiri.personalWorkPlan — `update` OLIB TASHLANADI, `approve`+`reject` QO'SHILADI.
yarn seed:council-roles                       # 4.9 Institut ilmiy kengashi: ilmiy_kengash_kotibi/ilmiy_kengash_azosi/oqituvchi/rektor
yarn seed:science-council-roles -- --dry      # avval ko'rish
yarn seed:science-council-roles               # yozish
yarn seed:quality-assurance-roles             # 4.12 sifat bo'limi (talim_sifati_nazorati): indicatorSubmission approve/reject
yarn seed:quality-role-access                 # 1) DRY-RUN — 4.12 rol menyu ruxsati; DBga YOZMAYDI, faqat diff
yarn seed:quality-role-access -- --write      # 2) YOZISH — bu qadamsiz hech narsa o'zgarmaydi
#    ⚠️ AVTORITAR seed (yuqoridagi `quality-assurance-roles` dan FARQLI):
#       · `talim_sifati_nazorati` — ro'yxatda yo'q section O'CHIRILADI. Talab:
#         QA faqat Indikatorlar / Tekshirish / E'lonlar / Hisobotlar ko'rsin.
#         DRY-RUN chiqishida "BUTUNLAY O'CHADI" qatorlarini VA "ESKI HOLAT"
#         ro'yxatini o'qing — ikkinchisi tiklash uchun yagona nusxa.
#       · `oqituvchi` — FAQAT qo'shiladi (4.12 sahifalari), qolgan
#         section'lariga tegilmaydi.
#       Oldidan `seed:permissions` + permissionGroups ("4.12" guruhi) shart.
#       · Admin panelida `talim_sifati_nazorati` rolini ochganda «E'lonlar» bo'limi uchun
#         «ro'yxat sahifasi ochilmaydi» ogohlantirishi chiqadi — bu kutilgan holat: e'lonlar
#         sahifasi `read` bilan ochiladi. `readAll` ni belgilash shart emas (belgilansa,
#         keyingi `yarn setup:seed` uni olib tashlaydi).
#       Yozgandan keyin chiqib-kirish SHART EMAS: backend ruxsatni har
#       so'rovda bazadan o'qiydi, sidebar uchun esa brauzerda F5 yetarli.
yarn seed:task-roles -- --dry                 # 4.7: avval diffni ko'ring — bu seed REVOKE ham qiladi (pastga qarang)
yarn seed:task-roles                          # 4.7 Topshiriqlar: rektor/prorektor/oquv_uslubiy_boshqarma/dekan/kafedra_mudiri (Rahbar) + oqituvchi (Xodim) + moderator (manageMembers, kategoriya CRUD) — TT 5.7 §4.7.2
yarn seed:practice-roles                      # 4.13 Amaliyot: amaliyot_bolimi/rektor/tibbiyot_birlashmasi_rahbari/moderator
yarn seed:residency-roles -- --dry           # 4.5: avval diffni ko'ring — DBga YOZMAYDI (seed faqat qo'shadi, olib tashlamaydi)
yarn seed:residency-roles                     # 4.5 Magistratura/klinik ordinatura: magistratura_bolim/rezident/klinik_ustoz/kafedra_mudiri/ilmiy_rahbar/magistrant/rektor
#    Bo'lim (`magistratura_bolim`) `residentAttendance:approve` ham oladi — Jurnaldagi «Sababli qilish» tugmasi;
#    katalog kaliti — `seed:permissions` / `seed:permissions:residency` (§6.2, «Bo'limning «Sababli qilish» huquqi»).
yarn seed:scientific-roles                    # 4.10 Ilmiy bo'lim: ilmiy_bolim/oqituvchi/kafedra_mudiri/dekan/prorektor/rektor/ilmiy_kengash_kotibi
yarn seed:rektor-kengash                      # 1) DRY-RUN — avval diffni ko'ring, DBga YOZMAYDI
yarn seed:rektor-kengash --write               # 2) 🔴 YOZISH — shu qadam SHART, aks holda hech narsa yozilmaydi
#    ⚠️ MODUL SEED'LARIDAN KEYIN ishga tushiring — u ikki rolning MODULLARARO
#    kamchiligini yopadi: `rektor` "Bosh sahifa" da 12 modul ko'rsatkichini
#    o'qiydi, `ilmiy_kengash_kotibi` esa 4.09 ekranlarini ochadi. Har modul
#    seedi faqat o'z rollarini yozadi, bu kesishmani faqat shu seed qoplaydi.
#    Faqat QO'SHADI (rektorga faqat read/readAll) — mavjud grantlar saqlanadi.
yarn seed:gifted-roles                        # 4.11 Iqtidorli yoshlar: talaba/iqtidorli_bolim/hakam/oqituvchi/prorektor/rektor
yarn seed:admission-4.8                       # 4.8 Xalqaro qabul: qabul_bolimi roli (prod-safe). Sinov user "qabul_xodim" faqat dev/qa (DEV_ENVS)
yarn seed:admission-rektor                    # 4.8 rektor monitoringi (internationalAdmission read+readAll) — `rektor` roli OLDIN yaratilgan bo'lishi shart (yuqoridagi seedlardan istalgani yetarli)
node seed/dashboard-rbac.seed.js -- --dry     # avval diffni ko'ring
node seed/dashboard-rbac.seed.js              # Rektor boshqaruv paneli (`dashboard:read`) — FAQAT rektor roliga. Bu seed o'tkazib yuborilsa rektor /bosh-sahifa da 403 oladi
yarn seed:qual-roles -- --dry                 # 4.4: avval diffni ko'ring (bu seed BITTA revoke qiladi — pastga qarang)
yarn seed:qual-roles                          # 4.4 uch rolni birdaniga: malaka_menejer + malaka_oqituvchi + malaka_tinglovchi
```

Rol seedlari **idempotent MERGE** (yuqorida ⚠️ bilan belgilangan revoke va
avtoritar holatlardan tashqari) — mavjud rollarning boshqa modul
permissionlari va `scopeLevel` i saqlanadi. Seedlardan keyin backendni qayta
yuklang (`pm2 reload institute-ais`): ishga tushishda `pm2 logs institute-ais`
(yoki `logs/combined.log`; dev muhitida — `yarn dev` konsoli) da
`[RBAC] Integrity OK` ko'rinishi kerak. Uning
o'rniga `[RBAC] DBda yo'q bo'lgan kanonik sectionlar` ogohlantirishi chiqsa —
1-blokdagi permission seedlarini qayta ishga tushiring.

> ⚠️ **`seed:task-roles` REVOKE ham qiladi.** U rahbarlardan
> (`rektor`/`prorektor`/`dekan`/`kafedra_mudiri`) `taskCategory` **create/update/
> delete** ni OLIB TASHLAYDI — kategoriya boshqaruvi faqat `moderator`da qolishi
> kerak (Administrator aktori = Rahbar huquqlari + kategoriyalarni boshqarish).
> Rahbarlarda `read`/`readAll` qoladi, ya'ni ro'yxat filtri ishlayveradi, faqat
> "Kategoriyalar" menyusi yo'qoladi. Boshqa modul ruxsatlariga tegmaydi. Avval
> `-- --dry` bilan diffni ko'ring.

> ⚠️ **`seed:qual-roles` ham BITTA REVOKE qiladi.** `malaka_oqituvchi` dan
> `qualAccessTestResult`/`qualExitTestResult` ning **create/update/delete** si
> olinadi — bu uchlik faqat TEST TOPSHIRISH endpointlari (`/start`,
> `/select-option`, `/finish`), o'qituvchi test topshirmaydi. Ko'rish/eksport
> va `qualTopicCompletion:update` (baholash) QOLADI. Seed uch 4.4 rolining
> `qual*` section'larini o'z ro'yxatiga tenglaydi, boshqa modul section'lari
> saqlanadi. Avval `-- --dry`: chiqishdagi `-` qatorlari — olib tashlanadiganlar.

**Tartib nega shunday:** permission katalogi (guruhlar → permissions →
modul-alohida permissions) har doim BIRINCHI — u faqat UI/admin-panel
ro'yxati uchun (`permit()` runtime'da to'g'ridan-to'g'ri `role.permissions`ni
o'qiydi, katalogga bog'liq emas), lekin izchillik uchun oldin yuriladi.
`seed:super-admin` rol grantlari orasida ENG BIRINCHI — u `src/config/constants.js`
dagi barcha `MODULES` × `ACTIONS` ni to'g'ridan-to'g'ri `super_admin` roliga
yozadi (boshqa hech qanday seedga bog'liq emas) va eng muhim fallback hisob
bo'lgani uchun boshqa rol seedlaridan biri qulasa ham administrator panel
orqali tuzatish imkoni qolishi kerak. `moderator-role` darhol undan KEYIN —
boshqa hech qanday seedga bog'liq emas, lekin TZ 4.1 "Bo'lim admini" aktori
(foydalanuvchi/rol/ma'lumotnoma boshqaruvi) imkon qadar erta ishlashi kerak.
O'tkazib yuborilsa — `moderator` roli bilan kirilganda 4.1 ekranlari
(Foydalanuvchilar/Rollar/Ma'lumotnomalar) 403 beradi. `task-roles` bazada
topilmagan rolni yaratmaydi (`[SKIP] rol topilmadi` deb o'tkazib yuboradi),
shuning uchun `moderator` roli undan oldin mavjud bo'lishi kerak.
`moderator-role` `practice-roles`/`task-roles`dan KEYIN qayta ishga tushirilsa
ham xavfsiz — ularning `moderator`ga bergan qo'shimcha grantlari (4.13
Sozlamalar, 4.7 manageMembers) saqlanadi (har biri o'z bo'limini boshqaradi,
kolliziya yo'q — `seed/role-seed-collisions.test.js`).
`seed:admission-rektor` esa **oxirida** — u `rektor` rolini avvaldan mavjud
deb hisoblaydi (topilmasa xato beradi); `studyload-roles`/`council-roles`/
`practice-roles`/`scientific-roles`ning istalgani rektor rolini allaqachon
yaratadi, shuning uchun ro'yxat oxirida joylashgani xavfsiz. `qual-roles`
(4.4) va `admission-4.8` o'z rollarini mustaqil yaratadi — tartib ular uchun
ahamiyatsiz, oxiriga qo'yildi.

O'tkazib yuborilsa: `science-council-roles` bo'lmasa — o'qituvchi 4.06
ro'yxatida 403 oladi, 4.06 forma reference'lari ham 403 beradi.
`practice-roles`/`residency-roles`/`scientific-roles` o'tkazib yuborilsa —
4.13 (Amaliyot), 4.5 (Magistratura/ordinatura), 4.10 (Ilmiy bo'lim) rollariga
modul grantlari berilmaydi va o'sha modullar foydalanuvchilarga 403 bilan
yopiladi. `council-roles` o'tkazib yuborilsa — 4.9 (Institut ilmiy kengashi)
rollariga grant berilmaydi, kengash a'zolari/kotibi/rektor/o'qituvchi kengash
sahifalarida 403 oladi. `super-admin` o'tkazib yuborilsa — toza deploy'da
administrator hisobi (super_admin roli) hech qanday ruxsatga ega bo'lmaydi (rol
document mavjud bo'lsa ham `permissions: []`) — tizimga umuman kirib bo'lmaydi.
`studyload-roles`/`teacher-roles`/`gifted-roles` o'tkazib yuborilsa — mos
ravishda 4.2, 4.3, 4.11 rollariga grant berilmaydi va o'sha modullar 403
bilan yopiladi. `admission-4.8`/`admission-rektor` o'tkazib yuborilsa —
qabul_bolimi/rektor 4.8 (Xalqaro qabul) moduliga kira olmaydi. `qual-roles`
o'tkazib yuborilsa — 4.4 (Malaka oshirish) rollari (`malaka_menejer`/
`malaka_oqituvchi`/`malaka_tinglovchi`) grant olmaydi — modul foydalanuvchilarga
yopiq qoladi. `task-roles` o'tkazib yuborilsa — 4.7 (Topshiriqlar) moduli faqat
`super_admin` bilan ishlaydi.

> **Jarayon qoidasi:** yangi rol seedi (`seed/*-roles.seed.js`) qo'shilganda
> uni **majburiy** ravishda uch joyga kiritish shart — `package.json` (`scripts`),
> shu hujjat (§3) **VA** `yarn setup:seed` rejasi (`seed/_deploy-plan.js`). Aks
> holda yangi muhitda seed ishga tushmay, modul rollariga grant berilmaydi.
> `node scripts/check-seed-runbook.js` (§3.0) bu moslikni tekshiradi va
> yetishmasa `exit 1` beradi (`yarn setup:seed` ham shu sababli ishga tushmaydi).

### Seed'dan KEYIN — permission katalog drifti (MAJBURIY)

`yarn setup:seed` bu tekshiruvni o'zi bajaradi (natijada «Ruxsatlar katalogi drifti» qatori). Seedlar qo'lda
bajarilgan bo'lsa:

```bash
node scripts/check-permission-drift.js     # exit 0 = drift yo'q · 1 = drift bor
```

**Nega aynan deploy'da:** skript `src/` dagi barcha `permit()` chaqiruvlaridan
talab qilinadigan `section:action` juftliklarini (`src/config/constants.js`
dagi `MODULES`/`ACTIONS` orqali) yig'adi va ularni `mongoose.connect()` bilan
**jonli bazadagi** `permissions` kolleksiyasi bilan solishtiradi (ulanish —
`.env` dagi `MONGO_HOST`). Buni faqat bazasi bor muhit bajara oladi, shuning
uchun bu tekshiruv deploy qadami. Skriptning o'zi yiqilsa (masalan, bazaga
ulanib bo'lmasa) — exit 2.

**Nima ushlaydi:** backend `permit()` talab qiladigan `section:action`
katalogda bo'lmasa — admin panelda checkbox **umuman chizilmaydi** ⇒ rolga
grant berib bo'lmaydi ⇒ sahifa **abadiy 403**. "Rolga vakolat berdim, baribir
403 beryapti" shikoyatining odatiy sababi shu.

Chiqishdagi sinflar (har birining soni exit kodiga qo'shiladi):

| Chiqishdagi qator | Ma'nosi | Nima qilish kerak |
|---|---|---|
| `[X] SECTION katalogda YO'Q` | kod talab qiladigan section katalogda yo'q | tegishli `seed:permissions*` |
| `[X] ACTION katalogda YO'Q` | section bor, lekin action yo'q | tegishli `seed:permissions*` |
| `[X] YECHILMAGAN permit()` | skaner o'qiy olmagan `permit()` shakli | kodni ko'ring (pastga qarang) |
| `[!] GURUHSIZ (admin UI chizmaydi)` | section hech bir guruhga bog'lanmagan | `seed:permission-groups`, so'ng `seed:permissions*` |

Exit 1 bo'lsa — deploy'ni **davom ettirmang**: yetishmayotgan section'lar uchun
tegishli `seed:permissions*` qadamini qayta ishga tushiring, so'ng shu tekshiruvni
takrorlang.

> Chiqishda alohida sinf bor:
>
> ```
> [X] YECHILMAGAN permit() (0):
> ```
>
> Bu — skanerning o'z ko'r nuqtasi. **0 dan farq qilsa**, kodda skaner o'qiy
> olmaydigan yangi `permit()` shakli paydo bo'lgan degani: avval o'sha joyni
> ko'ring, katalogni emas. U ham exit kodiga qo'shiladi, ya'ni skaner ko'rmagan
> chaqiruv jimgina o'tib ketmaydi. Skanerning o'zi (`scripts/permit-scan.js`)
> bazasiz ishlaydi va `yarn test` da qamrab olingan (`scripts/permit-scan.test.js`).

### DEV-ONLY seedlar (production'da ISHLATMANG)

```bash
node seed/task-users.seed.js --dry     # 9 ta sinov hisobi: har aktor uchun bittadan
node seed/cleanup-legacy-roles.js --dry  # kanonik bo'lmagan rollarni kanoniklarga ko'chirish (bir martalik)
# 4.4 sinov hisoblari — ochiq PIN, muhit qo'riqchisi YO'Q (production'da ishga tushirmang;
# rollar va grantlar uchun §3 dagi `seed:qual-roles` yetarli):
yarn seed:malaka-manager                      # 4.4 malaka_menejer (kurs/qabul/monitoring/testlar boshqaruvi)
yarn seed:malaka-teacher                      # 4.4 malaka_oqituvchi (umumiy "oqituvchi" dan ajratilgan, alohida rol)
yarn seed:malaka-tinglovchi                   # 4.4 malaka_tinglovchi (kurs tinglovchisi portali)
```

`task-users.seed.js` PIN'lari ketma-ket (`47000000000001` = `admin`) va login
faqat PIN bilan — shuning uchun unda **fail-closed allowlist** bor:
`NODE_ENV` ∈ {`dev`,`development`,`test`,`qa`,`local`} bo'lmasa **umuman
ishlamaydi** (o'rnatilmagan yoki `prod` deb xato yozilgan bo'lsa ham bloklanadi).
Production'da ishlatmang — u yerda hisoblar administrator tomonidan qo'lda
yaratiladi (§3.3).

`cleanup-legacy-roles.js` — bir martalik migratsiya: `constants.ROLES` da yo'q
rollardagi foydalanuvchilarni kanonik rollarga ko'chiradi, so'ng bo'shab qolgan
rollarni o'chiradi (KO'CHIR → TEKSHIR → O'CHIR). Standart rejim DRY — bazani
faqat `--apply` bilan o'zgartiradi. Muhit qo'riqchisi yo'q, lekin u faqat o'z
xaritasidagi eski sinov rollari bilan ishlaydi: xaritada yo'q kanonik bo'lmagan
rol yoki boshqa kolleksiyalarda kutilmagan havola topsa, hech narsa
o'zgartirmasdan to'xtaydi (exit 1). Toza bazada "Kanonik bo'lmagan rol yo'q"
deb chiqadi.

#### Barcha test-foydalanuvchi seedlari — `NODE_ENV` talabi bilan

Hammasida bir xil fail-closed qo'riqchi: `NODE_ENV` ∈ {`dev`, `development`,
`test`, `qa`, `local`}. Boshqa qiymatda (jumladan o'rnatilmagan yoki `prod` deb
typo qilingan) seed **hech narsa yozmasdan `throw` bilan to'xtaydi**.
🔴 **Istisno — `practice-users.seed.js`:** qo'riqchi faqat `00000000000000`
(`super_admin`) hisobini to'sadi; qolgan 4 ta hisobni (`10000000000001…004`)
u har qanday muhitda yaratadi.

| Seed | Nima yaratadi |
|---|---|
| `node seed/task-users.seed.js` | 4.7 uchun 9 sinov hisobi (har aktorga bitta), PIN `47000000000001…` |
| `node seed/studyload-users.seed.js` | 4.2 ning har roliga 1 test user, PIN prefiksi `4020…` |
| `node seed/magistratura-user.seed.js` | `magistratura_bolim` uchun 1 sinov hisobi, PIN `40200000000012` |
| `node seed/testUsers.seed.js` | 4.2 testi uchun 8 rolli user (`test_super_admin`, … — **matnli** PIN) |
| `node seed/workload-teacher-test-users.seed.js` | 4.2 (yuklama taqsimoti) sinovi uchun kafedra mudiri + 8 o'qituvchi, PIN `40300000000002`, `40400000000001…008` |
| `node seed/teacher-chain-users.seed.js` | 4.3 tasdiqlash zanjiri rollari uchun hisoblar, PIN `40500000000001…011` |
| `node seed/teacher-users.seed.js` | 4.3 oqimida yetishmayotgan 1 user (qolgan 3 tasi 4.2 seedida bor) |
| `node seed/council-users.seed.js` | 4.09 kengash demo userlari, PIN `2000000000000X` |
| `node seed/scientific-users.seed.js` | 4.10 ning 7 roli uchun bittadan user, PIN `410000000000XX` |
| `node seed/malaka-users.seed.js` | 4.04 uchun qo'shimcha o'qituvchi/tinglovchi hisoblari |
| `node seed/residency-test-users.seed.js` | 4.05 rollari uchun login-userlar + demo magistrant/rezident yozuvlari, PIN `45000000000021…027` |
| `node seed/gifted-users.seed.js` | 4.11 ning har roli uchun login-user (talaba, iqtidorli_bolim, 2 hakam, maslahatchi oqituvchi, prorektor, rektor), PIN `41100000000001…007`. 🔴 `gifted-demo.seed.js` dan OLDIN — u shu PIN'larni qidiradi va topmasa `throw` qiladi |
| `node seed/practice-users.seed.js` | 4.13 har roliga 1 user (`10000000000001…004` — 🔴 muhit qo'riqchisiz) + dev "ONE ID" hisobi `00000000000000` (faqat dev/QA muhitida) |
| `node seed/moderator-users.seed.js` | `moderator` uchun 1 sinov hisobi, PIN `40100000000001` (rolning o'zi `moderator-role.seed.js` da yaratiladi; rol bo'lmasa seed xato beradi) |

🔴 **Muhit qo'riqchisi YO'Q, lekin ochiq PIN'li hisob yaratadi** — quyidagilar
`NODE_ENV` ni tekshirmaydi (yozish rejimida istalgan muhitda hisob yaratadi),
production'da **ishga tushirmang**:

| Skript | Yaratadigan hisob(lar) |
|---|---|
| `node seed/practice-users.seed.js` | `10000000000001…004` (`amaliyot_bolimi`, `rektor`, `tibbiyot_birlashmasi_rahbari`, `moderator`) |
| `node seed/quality-login-user.seed.js` | `41200000000012` (`talim_sifati_nazorati`) |
| `yarn seed:malaka-manager` · `yarn seed:malaka-teacher` · `yarn seed:malaka-tinglovchi` | `11111111111111` · `22222222222222` · `33333333333333`. Bundan tashqari ular 4.4 rolining ruxsatlarini o'z to'plamiga tenglaydi, `malaka-teacher` esa `oqituvchi` rolidan 4.04 section'larini olib tashlaydi. 4.4 rollari uchun `seed:qual-roles` yetarli |
| `node scripts/seed-workload-teacher-fixtures.js` | Standart rejim DRY — faqat `--write` bilan yozadi: `40400000000005…008` (`oqituvchi`) hisoblari + `40400000000001…008` uchun tasdiqlangan (`approved`) `teacherprofiles` |

🔴 **QA / demo muhitida `NODE_ENV` ni TO'G'RI qo'ying — aks holda QA TO'XTAYDI.**
Bu seedlar `NODE_ENV=production` (yoki noma'lum/bo'sh qiymat) bilan **hech narsa
yaratmaydi**, ya'ni QA muhitida test hisoblari paydo bo'lmaydi va brauzerdan
kirib bo'lmaydi. QA/demo serverning `.env` ida:
```
NODE_ENV=qa        # yoki: dev | development | test | local
```
Xato belgisi: seed `bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="…")`
xabari bilan yiqiladi — bu **kutilgan** xulq, seed buzilgani emas. Production
serverda esa faqat `NODE_ENV=production` (§0).

⚠️ Bu hisoblarning PIN'lari seed fayllarida **ochiq** yozilgan va PIN rejimida
login faqat PIN bilan ketadi — shuning uchun ularni production bazasiga **hech
qachon** ko'chirmang (dev dump'ni prod'ga tiklash orqali ham).

### 3.1. `src/domain/` demo ma'lumoti — ⚠️ FAQAT DEV/QA, PRODUCTIONDA ISHLATMANG

`src/domain/` (talaba/imtihon/jurnal/davomat/dars jadvali) uchun dev/QA
muhitida namunaviy yozuvlar yaratadi. Bo'sh kolleksiyada `GET` har doim
`200 []` qaytaradi va sinov "yashil" ko'rinadi, lekin yozuv yaratish va
bog'lanishlar (`populate`) umuman sinalmagan bo'ladi — ular faqat yozuv bor
bo'lganda ishlaydi. Shuning uchun QA sinovidan oldin shu seedni ishga tushiring.

```bash
yarn seed:domain-demo -- --dry        # AVVAL SHUNI — nima yaratilishini ko'rsatadi, yozmaydi
yarn seed:domain-demo -- --write      # haqiqiy yozish
```

Bayroqsiz (`yarn seed:domain-demo`) — **dry-run** (xavfsiz default, hech
narsa yozmaydi). Idempotent — qayta ishga tushirish 0 yangi yozuv beradi.
Talab qiladigan reference ma'lumot (fakultet/kafedra/guruh/fan/o'quv yili)
oldindan bazada bo'lishi kerak (`yarn seed:refs`). Bundan tashqari «Ichki
kasalliklar kafedrasi»da kamida bitta faol `oqituvchi` va bitta faol
`kafedra_mudiri` rolli foydalanuvchi bo'lishi shart (`yarn seed:refs`
foydalanuvchi yaratmaydi). Bo'lmasa skript hech narsa yozmasdan aniq xabar
bilan to'xtaydi (`exit 1`).
Skript: `seed/domain-demo-data.seed.js`.

### 3.2. 4.04 Malaka oshirish demo ma'lumoti — ⚠️ FAQAT DEV/QA, PRODUCTIONDA ISHLATMANG

4.04 modulining bazaviy yozuvlarini (`qualCourseType`/`qualCourse`/`qualListener`
va h.k.) dev/QA uchun yaratadi (`malaka-kimyo-demo.seed.js` esa faqat MAVJUD
kurs/tinglovchini qidiradi, yaratmaydi). Bo'sh kolleksiyada `GET` har doim
`200 []` qaytaradi va sinov "yashil" ko'rinadi — hech narsa sinalmagan bo'ladi.

```bash
yarn seed:malaka-demo -- --dry        # AVVAL SHUNI — nima yaratilishini ko'rsatadi, yozmaydi
yarn seed:malaka-demo -- --write      # haqiqiy yozish
```

Bayroqsiz (`yarn seed:malaka-demo`) — **dry-run** (xavfsiz default, hech
narsa yozmaydi). Idempotent — qayta ishga tushirish 0 yangi yozuv beradi. Butun
zanjirni (kurs turi → kurs → mavzu → material → ariza → tinglovchi → obuna →
test → natija → shartnoma → to'lov → sertifikat) 3 turli holatdagi kurs va 7
turli holatdagi ariza (kutilmoqda/tasdiqlangan/rad etilgan) bilan yaratadi.
Talab qiladigan oldingi seedlar (test foydalanuvchilar): `seed:malaka-teacher`,
`seed:malaka-tinglovchi`, va `node seed/malaka-users.seed.js` — bo'lmasa
skript hech narsa yozmasdan aniq xabar bilan to'xtaydi (`exit 1`).
Skript: `seed/malaka-demo-data.seed.js`.

**Ixtiyoriy qo'shimcha (`malaka-kimyo-demo.seed.js`):** yuqoridagi
seed "Kimyo o'qitish metodikasi" kursi + 3 mavzuni allaqachon yaratadi.
`node seed/malaka-kimyo-demo.seed.js` shu kursga qo'shimcha vaziyatli-masala
javobi + to'lov tarixi demosini qo'shadi (idempotent, `malaka-demo-data`dan
KEYIN ishga tushirilishi shart — aks holda "Kurs topilmadi" bilan yiqiladi).

### 3.3. Birinchi administrator (super admin) — production protsedurasi

Birinchi administrator `yarn seed:first-admin` (`seed/first-admin.seed.js`)
bilan yaratiladi — pastdagi «PROTSEDURA» bo'limi. `yarn setup:seed` (§3 boshi)
bazada faol administrator bo'lmasa shu protsedurani terminalda so'rab o'zi
bajaradi (PIN indeksi va `seed:super-admin` ham undan oldin bajarilgan bo'ladi);
quyidagi qadamlar — uni qo'lda bajarish yoki `--yes` bilan ishga tushirilgan
holat uchun. Quyida boshqa mavjud skriptlar nega bu vazifaga yaramasligi
ko'rsatilgan.

**`yarn seed:super-admin` FOYDALANUVCHI YARATMAYDI.** U faqat `super_admin`
**rolini** yaratadi/yangilaydi va unga barcha modul×action ni beradi
(`seed/super-admin.seed.js`). Oxirida u
`Login: POST /api/auth → { "oneIdPin": "test_super_admin" }` deb chop etadi —
bu qator faqat dev/QA muhitiga tegishli: shu PIN'li foydalanuvchini bu seed emas, balki
`seed/testUsers.seed.js` (dev-only, production'da bloklangan) yoki
`seed/setup-platform.js` yaratadi. Ya'ni toza production bazada
`seed:super-admin` dan keyin ham **birorta hisob yo'q** — kirish mumkin emas.

Hisob yaratadigan boshqa skriptlar va nega ular production uchun **yaroqsiz**:

| Skript | Nima qiladi | Nega prod uchun yaroqsiz |
|---|---|---|
| `seed/testUsers.seed.js` | `test_super_admin` (matnli PIN) | dev-only — `DEV_ENVS` qo'riqchisi `throw` qiladi |
| `seed/setup-platform.js` | `admin`, `test_super_admin`, `qabul_xodim`, `rahbar` (matnli PIN) | PIN'lar repoda ochiq va matnli, muhit qo'riqchisi yo'q; ustiga `super_admin`, `qabul_bolimi`, `rektor` rollarining `permissions` ini hardcode qiymatga **QAYTA YOZADI** (seedlar bergan vakolatlar yo'qoladi) |
| `seed/create-admin.js` | PIN `00000000000001` va `00000000000002` | PIN'lar repoda ochiq, muhit qo'riqchisi yo'q; dev yordamchi skript — shu PIN'li mavjud hisoblarni ham qayta yozadi |
| `seed/moderator-users.seed.js` | moderator, PIN `40100000000001` | test hisobi — `DEV_ENVS` qo'riqchisi ostida (production'da `throw`); `moderator` ROLI alohida `moderator-role.seed.js` da |

⚠️ **PIN formati:** `POST /api/auth` PIN **formatini tekshirmaydi**
(`src/modules/4.01-auth/auth/auth.validation.js` — `oneIdPin:
Joi.string().required()`). Ya'ni `test_super_admin` kabi 14 xonali JSHSHIR
bo'lmagan matn ham, bazada shunday hisob bo'lsa, to'liq ishlaydigan login
kalitidir; 14 raqam talabi faqat frontend login formasida, API'da emas.
Shuning uchun production bazasida test hisoblari bo'lmasligi shart (§3.0 va
pastdagi «Login rejimi» bo'limi).

#### PROTSEDURA — `yarn seed:first-admin`

```bash
# Serverda, backend papkasida. Har bir buyruqni BO'SH JOY bilan boshlang —
# shunda u shell tarixiga tushmaydi (bash: `HISTCONTROL=ignorespace`).
 yarn migrate:oneidpin-index:dry                                     # 0) unique indeks bor-yo'qligini/dublikatni tekshir
 yarn migrate:oneidpin-index                                         # 0) yo'q bo'lsa — yarat (§0)
 yarn seed:super-admin                                               # 1) ROL (avval, majburiy)
 node seed/first-admin.seed.js --pin <14-RAQAM> --name "Ism Familiya" --dry   # 2) quruq yurish
 node seed/first-admin.seed.js --pin <14-RAQAM> --name "Ism Familiya"         # 3) haqiqiy yozuv
# `yarn seed:first-admin` o'rniga to'g'ridan `node` ishlatiladi: yarn skriptni ishga tushirishdan oldin buyruq
# qatorini PIN bilan birga (`$ node seed/first-admin.seed.js --pin …`) ekranga chiqaradi.
```

⚠️ **0-qadam nega majburiy:** `yarn seed:first-admin` o'zi `oneIdPin_unique_partial`
indeksini yaratmaydi (`autoIndex: false`). Skript avval hisob bor-yo'qligini
tekshirib, keyin yaratadi — bu atomik EMAS, shuning uchun dublikat PIN'ga qarshi
yagona haqiqiy himoya aynan shu indeks. Indeks yo'q bo'lsa **haqiqiy yozuvda**
(`--dry`siz) skript aniq xato bilan `exit 1` qiladi va `yarn migrate:oneidpin-index`
ni ko'rsatadi — o'zi davom etmaydi. `--dry` rejimida esa bu faqat OGOHLANTIRISH
(to'xtatmaydi), chunki `--dry` ning ma'nosi — bazaga tegmasdan rejani ko'rsatish.

Skript kafolatlari (har biri `seed/first-admin.seed.test.js` testlari bilan tekshiriladi):

| Xususiyat | Xatti-harakat |
|---|---|
| PIN manbasi | **faqat** `--pin` argumenti yoki `--pin-stdin` (PIN standart kirishning birinchi qatoridan o'qiladi; `yarn setup:seed` shu yo'lni ishlatadi) — kodda, `.env`da, default qiymatda YO'Q. Ikkalasi birga berilsa — `exit 1` |
| PIN formati | aynan **14 raqam** (`/^\d{14}$/`); `test_super_admin` kabi matn **rad etiladi** |
| Ism | `--name` majburiy, kamida ikki so'z ("Ism Familiya"); uchinchi so'z otasining ismiga (`middleName`) yoziladi |
| Chiqish | PIN **hech qachon** chop etilmaydi; dublikat (`E11000`) xatosida umumiy xabar chiqadi, boshqa xato matnlaridagi 14 raqamli qiymatlar `redact()` bilan yashiriladi |
| Mavjud hisob | 🔴 **qayta yozilmaydi** — xabar berib `exit 0`. Jim almashtirish YO'Q |
| `super_admin` roli | mavjud bo'lishi SHART — yo'q bo'lsa aniq xato + `exit 1` (rolni O'ZI yaratmaydi) |
| `--dry` | rejani ko'rsatadi, bazaga **hech narsa** yozmaydi — `autoIndex: false` + `autoCreate: false` (bo'sh `users`/`roles` kolleksiyalari ham yaratilmaydi) |
| `oneIdPin_unique_partial` indeksi | yozishdan OLDIN tekshiriladi — yo'q bo'lsa haqiqiy yozuvda `exit 1` (`yarn migrate:oneidpin-index` ko'rsatiladi); `--dry`da faqat ogohlantirish, to'xtatmaydi |
| Muhit qo'riqchisi | **ATAYLAB yo'q** — bu aynan production protsedurasi; xavfsizlik muhitga emas, PIN manbasiga tayanadi (PIN faqat `--pin` yoki `--pin-stdin` dan, chiqishga tushmaydi, mavjud hisob qayta yozilmaydi) |
| Yozilgan maydonlar | `firstName`, `lastName`, `middleName`, `oneIdPin`, `role`, `active: true` — aniq allowlist |

⚠️ `--pin` argumenti server `ps` chiqishida ko'rinadi va shell tarixiga tushishi
mumkin. Ishlatib bo'lgach tekshiring: `history | grep first-admin`. Buning oldini
olish uchun `yarn setup:seed` ning interaktiv qadamidan foydalaning (PIN ekranda
`*` bilan kiritiladi va skriptga stdin orqali uzatiladi).

#### Login rejimi (production)

**Birinchi administrator qanday kiradi.** Kirish usuli `.env` dagi
`AUTH_PROVIDER` bilan tanlanadi (`src/modules/4.01-auth/_authProviders/`).
Production'da (`NODE_ENV=production`) server faqat quyidagi ikki holatda ishga
tushadi — boshqa har qanday qiymatda (bo'sh, noma'lum, yoki `pin` bayroqsiz)
boot fail-closed `throw` bilan **to'xtaydi**:

| `.env` | Natija |
|---|---|
| `AUTH_PROVIDER=oneid` | server ishga tushadi, lekin bu versiyada OneID orqali kirish qo'llab-quvvatlanmaydi: har bir kirish urinishi `501 "OneID sozlanmagan"` qaytaradi — **hech kim, jumladan super admin ham, tizimga kira olmaydi** |
| `AUTH_PROVIDER=pin` **va** `ALLOW_PIN_IN_PROD=true` | PIN rejimi — foydalanuvchi `POST /api/auth` ga o'zining 14 raqamli PIN'ini yuborib kiradi (production frontend'dagi «Login» formasi) |

Ya'ni production `.env` da **ikkala** bayroq ham bo'lishi
shart: `AUTH_PROVIDER=pin` **va** `ALLOW_PIN_IN_PROD=true`. 🔴 Bittasi yetishsa
boot to'xtaydi. `.env.example` da `ALLOW_PIN_IN_PROD=false` — production'da uni
`true` ga o'zgartiring. Bayroq faqat aynan `true` qiymatini qabul qiladi
(katta-kichik harf farqi yo'q; `1`/`yes` ishlamaydi) va faqat `"pin"` qiymatiga
tegishli — bo'sh/noma'lum `AUTH_PROVIDER` ni ochmaydi. PIN rejimi yoqilgan
production'da server har ishga tushganda log'ga shu haqda ogohlantirish yozadi.

⚠️ **PIN rejimida xavfsizlik:**
- PIN — yagona kirish kaliti: parol ham, provayder tekshiruvi ham, ikkinchi
  bosqich ham yo'q. Bazadagi har bir `oneIdPin` qiymati (matnli bo'lsa ham)
  to'liq login kaliti — yuqoridagi «Qo'shimcha fakt».
- `POST /api/auth` da brute-force cheklovlari (§0): IP bo'yicha 15 daqiqada
  100 ta, bitta PIN bo'yicha 15 daqiqada 8 ta muvaffaqiyatsiz urinish (so'ng
  `429`). Bundan tashqari bitta IP + PIN juftligi 15 daqiqa ichida 8 marta xato
  bo'lsa, u **30 daqiqaga qulflanadi** (`429` + `Retry-After`) — qulf davomida
  to'g'ri PIN bilan ham kirib bo'lmaydi.
- Har bir kirish urinishi audit jurnaliga yoziladi; muvaffaqiyatsiz urinishlarda
  PIN'ning faqat oxirgi 4 raqami saqlanadi.

**`qabul_xodim` sinov hisobi — deploy'dan keyingi tekshiruv.**
`seed:admission-4.8` (§3.0) production'da faqat `qabul_bolimi` ROLINI yozadi;
`oneIdPin: "qabul_xodim"` sinov hisobi (`seed/admission-4.8.seed.js`) fail-closed
`DEV_ENVS` qo'riqchisi ostida — production'da yaratilmaydi (skript "SKIP sinov
foydalanuvchisi" deb yozadi). PIN matnli va repoda ochiq bo'lgani uchun bu hisob
PIN rejimidagi production'da **ishlaydigan backdoor** bo'lardi — shuning uchun
deploy'dan keyin tekshiring, natija `null` bo'lishi kerak:
`db.users.findOne({ oneIdPin: "qabul_xodim" }, { active: 1 })`

Hisob topilsa (masalan, dev/QA bazasi nusxasi tiklangan yoki seed dev
`NODE_ENV` bilan ishga tushirilgan bo'lsa) — darhol bloklang yoki o'chiring:

```js
// mongosh — bloklash (login `active === false` da to'xtaydi:
//           `src/modules/4.01-auth/auth/auth.service.js`)
db.users.updateOne({ oneIdPin: "qabul_xodim" }, { $set: { active: false } })
// yoki butunlay o'chirish:
db.users.deleteOne({ oneIdPin: "qabul_xodim" })
```

Xuddi shu qoida yuqoridagi jadvaldagi boshqa ochiq test PIN'lariga ham
tegishli (`admin`, `test_super_admin`, `rahbar`, `00000000000001`,
`00000000000002`, `40100000000001`) — ular production bazasida bo'lmasligi kerak.

---

## 4. Frontend — backend ICHIGA yig'iladi

**Model:** frontend alohida serverdan uzatilmaydi. `yarn build` natijasi
backend'ning `public/build/` papkasiga ko'chiriladi va backend uni o'zi beradi:

```js
// src/index.js
const root = path.join(__dirname, "../public/build");
app.use(express.static(root));
app.get("/*", (req, res) => res.sendFile("index.html", { root }));
```

`public/build/` backend arxivida yo'q — u deploy paytida frontend build'idan
yaratiladi (pastdagi qadamlar).

Frontend **sanfak-frontend** arxivida keladi. Uning ichidagi qisqa `DEPLOY.md`
shu bo'limdagi qadamlarni takrorlaydi va ixtiyoriy `VITE_*` kalitlarini (ilova
nomi, asosiy rang, mavzu) sanab beradi.

### 🔴 `VITE_API_URL` — nisbiy bo'lishi SHART

`src/shared/config/app-config.ts` (frontend arxivida):
```ts
apiUrl: env.VITE_API_URL ?? 'http://localhost:4000/api'
```

Vite env'ni **build paytida** bundle ichiga yozadi. Berilmasa — deploy qilingan
ilova foydalanuvchi brauzeridan `http://localhost:4000/api` ga murojaat qiladi
va **umuman ishlamaydi**.

Backend frontend'ni bir xil origin'dan uzatgani uchun to'g'ri qiymat — nisbiy:

```
VITE_API_URL=/api
```

Buning foydasi: CORS umuman kerak emas · `withCredentials: true`
(`src/shared/api/client.ts`) bir xil originda tabiiy ishlaydi · domen o'zgarsa
qayta build kerak emas.

Bu qiymat frontend arxividagi `.env.production` faylida allaqachon yozilgan —
`yarn build` uni o'zi oladi, build uchun `.env` yaratish **kerak emas**.
`.env.production` ni o'zgartirmang.

> ⚠️ Production build uchun `.env.example` ni `.env` ga nusxalamang — u lokal
> ishlab chiqish uchun (`VITE_APP_NAME=Platform`,
> `VITE_API_URL=http://localhost:4000/api`). Shunday build'da ilova nomi
> institut nomi o'rniga «Platform» bo'lib chiqadi. Ixtiyoriy `VITE_*` kalitlari (ilova nomi, asosiy rang, mavzu)
> kerak bo'lsa — ularni build'dan OLDIN `.env.production.local` ga yozing (§6 dagi yangilash uni saqlaydi).

### Qadamlar

`sanfak-frontend` arxivini serverda `/srv/fjsti/frontend` papkasiga oching (pm2 foydalanuvchisi nomidan):

```bash
unzip -q sanfak-frontend.zip -d /srv/fjsti/          # arxiv ichida: sanfak-frontend/
mv /srv/fjsti/sanfak-frontend /srv/fjsti/frontend
```

So'ng:

```bash
cd /srv/fjsti/frontend
yarn install --frozen-lockfile
yarn build                        # → dist/

# Backend ichiga ko'chirish (eski build butunlay almashtiriladi)
rm -rf /srv/fjsti/backend/public/build
mkdir -p /srv/fjsti/backend/public/build
cp -r dist/. /srv/fjsti/backend/public/build/
```

`yarn install` ni `--production` bilan ishlatmang: `yarn build`
(`tsc --noEmit && vite build`) uchun devDependencies (`typescript`, `vite`) kerak.

Build to'g'ri API manzili bilan yig'ilganini tekshirish — §7.

> Backend'ni qayta ishga tushirish **shart emas**: `express.static` fayllarni har
> so'rovda diskdan o'qiydi. Vite asset nomlariga hash qo'yadi, shuning uchun
> brauzer yangi `index.html` orqali yangi fayllarni oladi.

---

## 5. nginx

Buyruqlar root huquqi bilan (`sudo`). `sayt.uz` o'rniga o'z domeningizni yozing.

```bash
sudo apt-get install -y nginx certbot
sudo cp /srv/fjsti/backend/deploy/nginx.conf.example /etc/nginx/sites-available/fjsti
sudo sed -i 's/<DOMAIN>/sayt.uz/g' /etc/nginx/sites-available/fjsti    # 4 joyda almashtiriladi
sudo ln -s /etc/nginx/sites-available/fjsti /etc/nginx/sites-enabled/
```

**Birinchi o'rnatish — sertifikat hali yo'q.** Namunadagi `ssl_certificate` fayllari
(`/etc/letsencrypt/live/sayt.uz/...`) mavjud bo'lmaguncha `nginx -t` xato beradi. Shuning uchun:

1. `/etc/nginx/sites-available/fjsti` dagi 443-portli `server { ... }` blokini vaqtincha `#` bilan o'chiring.
2. Sertifikatni oling. `--deploy-hook` SHART — usiz certbot sertifikatni diskda yangilaydi, lekin nginx eskisini
   berishda davom etadi va ~90 kundan keyin sayt muddati o'tgan sertifikat bilan ochiladi:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   sudo mkdir -p /var/www/certbot
   sudo certbot certonly --webroot -w /var/www/certbot -d sayt.uz --deploy-hook "systemctl reload nginx"
   ```
3. 443-blokni qaytaring va tekshiring:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot renew --dry-run      # avtomatik yangilanish ishlashini tekshiradi
   ```

Sertifikat allaqachon bor serverda 1–3-qadamlar kerak emas — `sudo nginx -t && sudo systemctl reload nginx` yetarli.
`certbot --nginx` ishlatmang: u shu konfiguratsiyani o'zi qayta yozadi.

**nginx bu yerda YUPQA qatlam** — statikni o'zi uzatmaydi. Backend ham API, ham
frontend'ni bergani uchun nginx faqat: TLS terminatsiya · gzip · `/socket.io/`
WebSocket upgrade · `/files/` (ixtiyoriy IP cheklovi shu blokka qo'yiladi) ·
`/api-docs` → 404 · **qolgan hammasini backendga proxy**.

SPA fallback ham backendda (`app.get("/*")`), shuning uchun nginx'da `try_files`
va `root` **kerak emas**.

⚠️ nginx'da `Content-Security-Policy` sarlavhasini qo'shmang — backend uni o'zi
yuboradi (`helmet`, `src/index.js`); ikkinchi sarlavha ziddiyat keltiradi.

**`/files/` — yuklangan fayllar.** Yuklangan rasm va hujjatlarning barcha
havolalari shu yo'l orqali beriladi. Namunadagi `location /files/` blokida IP
cheklovi yo'q: hujjatlar (pdf/doc/xlsx/video va h.k.) backendda HMAC-imzoli
havola bilan himoyalangan — imzosiz yoki muddati o'tgan so'rov `403` oladi (§0).
Fayllarni faqat institut tarmog'idan ochiladigan qilish kerak bo'lsa, shu blokka
`proxy_pass` dan oldin qo'shing:

```nginx
allow <tarmoq>;     # masalan 10.0.0.0/8
deny  all;
```

⚠️ Bu cheklov ro'yxatdagi tarmoqdan tashqaridagi hamma uchun rasm va hujjatlarni
yopadi: tarmoqdan tashqarida ishlaydigan xodimlar va ommaviy sahifalar (masalan
xalqaro qabul arizasi) foydalanuvchilari fayllarni ocha olmaydi. Faqat
`allow 127.0.0.1; deny all;` qoldirilsa, fayllar hech bir foydalanuvchida
ochilmaydi. Hujjat va sertifikatlardagi tekshiruv QR-kodlari `/verify/...` yo'liga
ishora qiladi — bu cheklov ularga ta'sir qilmaydi.

**Yuklash hajmi.** Namunada `client_max_body_size 25M` — bu bitta so'rov
tanasining (so'rovdagi barcha fayllar yig'indisining) chegarasi. Backend umumiy
fayl yuklashda bitta fayl uchun 50 MB gacha, 4.04 kurs videolari uchun 200 MB
gacha, 4.05 e'lon biriktirmalari uchun bitta so'rovda 10 tagacha fayl (har biri
25 MB gacha, bitta e'londa jami 100 MB gacha) qabul qiladi. Kattaroq yuklashlar
kerak bo'lsa `client_max_body_size` ni oshiring (masalan `200M`) — aks holda
25 MB dan katta so'rovlar nginx'da `413` xatosi bilan rad etiladi va backendga
yetib bormaydi.

> Backend o'zi oddiy HTTP (TLS'siz) ishlaydi, uning CSP sarlavhasida esa
> `upgrade-insecure-requests` bor (`src/index.js`): brauzer sahifadagi barcha
> so'rovlarni HTTPS ga o'tkazadi. Shuning uchun ilova brauzerda faqat TLS ortida
> ishlaydi — `http://<server>:4000` ga to'g'ridan ochilsa sahifa fayllari
> yuklanmaydi. TLS, gzip va `/api-docs` ni qo'shimcha yopish (backend uni
> production'da o'zi ham ochmaydi — §0) uchun nginx qo'llaniladi. nginx ortida
> `.env` da `LISTEN_HOST=127.0.0.1` qo'ying — 4000-port tashqaridan ochilmaydi va
> nginx qatlami chetlab o'tilmaydi (`.env.example` dagi qiymat `0.0.0.0` — barcha
> interfeyslar). `TRUST_PROXY=1` (default) backend oldida aynan bitta proxy
> (nginx) turishini nazarda tutadi; backend oldida hech qanday proxy bo'lmasa
> `TRUST_PROXY=false` qo'ying — aks holda mijoz `X-Forwarded-For` sarlavhasi
> orqali o'z IP manzilini soxtalashtirib, rate limiter'ni aylanib o'tishi mumkin.

**Ixtiyoriy tezlashtirish:** hashli statik fayllarni (`/assets/`) nginx
to'g'ridan `public/build/assets/` dan uzatishi mumkin — tezroq, backendni bezovta
qilmaydi. Yoqish uchun 443-portdagi `server { ... }` blokiga qo'shing va yo'l
backend papkasiga to'g'ri kelishini tekshiring:

```nginx
location /assets/ {
    alias /srv/fjsti/backend/public/build/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}
```

Bu faqat optimizatsiya — busiz ham hammasi ishlaydi.

---

## 6. Yangilash (update)

Yangi versiya ikki arxiv ko'rinishida keladi: `sanfak-backend` va `sanfak-frontend`. Yangilashdan oldin yangi
arxivdagi `docs/DEPLOY.md` ni o'qing — qo'shimcha seed/migratsiya qadamlari §3 va §6 da yoziladi.

Serverda arxivda YO'Q, lekin saqlanishi SHART bo'lgan narsalar: `.env`, `uploads/`, `private/`, `logs/`,
`public/build/`, `.venv/` (§1, ixtiyoriy), `scripts/backups/` va `scripts/prod-fixes/prod-fix-backups/` (migratsiya skriptlarining JSON
zaxiralari), `node_modules/`. Pastdagi `rsync` ularni chetlab o'tadi.

Zaxirada `.env` sirlari, butun baza va `private/` dagi skanlar bor — `/srv/backups` faqat root/pm2 foydalanuvchisiga
ochiq bo'lsin.

Oldingi versiyada ishlagan (ma'lumotli) bazani shu versiyaga birinchi marta yangilayotgan bo'lsangiz, 1-qadamdagi
`yarn install` dan keyin, seed'lar va `pm2 reload` dan OLDIN §6.1 va §6.2 ga o'ting va ulardagi bir martalik qadamlarni
o'sha yerda ko'rsatilgan tartibda bajaring (§6.2 ning ayrim qadamlari reload'dan keyin keladi).

```bash
# 0) Zaxira — har yangilashdan oldin: DB + backend papkasi (.env, uploads/, private/, public/build/ bilan)
sudo install -d -m 700 -o "$(id -un)" /srv/backups   # birinchi marta: egasi — pm2 foydalanuvchisi, faqat unga ochiq
STAMP=$(date +%F-%H%M)
cd /srv/fjsti/backend
mongodump --uri "$(grep '^MONGO_HOST=' .env | cut -d= -f2-)" --out /srv/backups/db-$STAMP
tar -czf /srv/backups/backend-$STAMP.tgz --exclude=backend/node_modules -C /srv/fjsti backend

# 1) Backend — yangi arxivni TOZA /tmp/sanfak-backend ga oching (eski ochilgan nusxa qolsa, yangi versiyada
#    o'chirilgan fayllar serverda qolib ketadi); arxiv yo'lini moslang:
rm -rf /tmp/sanfak-backend && unzip -q ~/sanfak-backend.zip -d /tmp/ && ls /tmp/sanfak-backend/package.json
rsync -a --delete \
  --exclude=/.env --exclude=/node_modules/ --exclude=/uploads/ --exclude=/private/ \
  --exclude=/logs/ --exclude=/public/ --exclude=/scripts/backups/ \
  --exclude=/scripts/prod-fixes/prod-fix-backups/ --exclude=/.venv/ \
  /tmp/sanfak-backend/ /srv/fjsti/backend/
cd /srv/fjsti/backend && yarn install --frozen-lockfile --production
# Yangi versiyada qo'shilgan .env kalitlari — chiqqanlarini §2 jadvali bo'yicha .env ga qo'shing
# (§2 dagi «tizim o'qimaydi» ro'yxatidagilarni e'tiborsiz qoldiring):
diff <(grep -oE '^[A-Z0-9_]+=' .env.example | sort) <(grep -oE '^[A-Z0-9_]+=' .env | sort) | grep '^<'
# src/scripts/requirements.txt o'zgargan bo'lsa: .venv/bin/pip install -r src/scripts/requirements.txt (yoki pip3, §1)
node scripts/check-seed-runbook.js     # yangi seed qo'shilganmi / qo'riqchi bormi (§3.0)
# Ma'lumotli bazani shu versiyaga BIRINCHI marta yangilayotgan bo'lsangiz — shu yerda §6.1 va §6.2 ning
#   reload'dan OLDINGI qadamlarini bajaring; reload'dan KEYINGILARINI — quyidagi `pm2 reload` dan so'ng.
# Seedlar (§3 boshi): yangi versiyadagi section va rol grantlari bazaga faqat shu yo'l bilan tushadi.
#   Bu ikki buyruqni alohida-alohida bajaring (ikkinchisi tasdiq so'raydi — blokni bir yo'la joylashtirmang):
yarn setup:seed --dry                  # avval ko'ring: qaysi huquqlar olib tashlanadi/almashtiriladi (hech narsa yozmaydi)
yarn setup:seed                        # barcha seedlar + drift tekshiruvi; exit kodi 0 bo'lmasa DAVOM ETTIRMANG
pm2 reload institute-ais               # fork rejimida reload = restart: bir necha soniya uzilish bo'ladi

# 2) Frontend — yangi arxivni TOZA /tmp/sanfak-frontend ga oching, so'ng backend ichiga qayta yig'iladi:
rm -rf /tmp/sanfak-frontend && unzip -q ~/sanfak-frontend.zip -d /tmp/ && ls /tmp/sanfak-frontend/package.json
rsync -a --delete --exclude=/node_modules/ --exclude=/.env --exclude=/.env.local --exclude=/.env.production.local /tmp/sanfak-frontend/ /srv/fjsti/frontend/
cd /srv/fjsti/frontend
yarn install --frozen-lockfile && yarn build
rm -rf /srv/fjsti/backend/public/build && mkdir -p /srv/fjsti/backend/public/build
cp -r dist/. /srv/fjsti/backend/public/build/
```

Ikkala arxiv birga kelganda 2-qadamni (frontend) backend `pm2 reload` idan OLDIN yoki u bilan bir o'tirishda bajaring:
yangi frontend eski backend bilan ishlaydi, eski frontend esa yangi backend bilan har doim emas (§6.2, «Keldi» dalili —
ordinatura «Keldi» `400` qaytaradi).

Ixtiyoriy `VITE_*` kalitlarini `.env.production.local` ga yozing — `rsync` uni o'chirmaydi; `.env.production` esa
har yangilashda arxivdan almashtiriladi.

Frontend uchun `pm2 reload` **shart emas** — `express.static` diskdan o'qiydi.
Backend kodi o'zgargandagina reload qiling.

Rollback — kod va frontend build 0-qadamdagi zaxiradan qaytariladi (`.env`, `uploads/`, `private/` joyida qoladi).
Ushbu versiyadan oldingisiga qaytishda kodni qaytarishdan OLDIN §6.2 dagi barcha **Rollback** bandlarini (ayniqsa chetlatish buyrug'i va avtomatik bildirgilar uchun) bajaring:

```bash
rm -rf /tmp/sanfak-rollback && mkdir -p /tmp/sanfak-rollback
tar -xzf /srv/backups/backend-<STAMP>.tgz -C /tmp/sanfak-rollback --exclude=backend/uploads --exclude=backend/private --exclude=backend/logs
rsync -a --delete \
  --exclude=/.env --exclude=/node_modules/ --exclude=/uploads/ --exclude=/private/ \
  --exclude=/logs/ --exclude=/scripts/backups/ \
  --exclude=/scripts/prod-fixes/prod-fix-backups/ --exclude=/.venv/ \
  /tmp/sanfak-rollback/backend/ /srv/fjsti/backend/
cd /srv/fjsti/backend && yarn install --frozen-lockfile --production
pm2 reload institute-ais
```

DB migratsiyalari avtomatik qaytarilmaydi — seed'lar additive, lekin model o'zgarishi bo'lsa DB'ni
`/srv/backups/db-<STAMP>` zaxirasidan tiklang: `pm2 stop institute-ais`, so'ng
`mongorestore --uri "mongodb://127.0.0.1:27017" --drop --nsInclude 'institute-ais.*' /srv/backups/db-<STAMP>`
(baza nomi `MONGO_HOST` dagi bilan bir xil bo'lsin), keyin `pm2 start institute-ais`; zaxiradan keyin kiritilgan ma'lumotlar yo'qoladi.

### 6.1. Fan dasturi (v259) tasdiqlash zanjiri dekanda tugaydi — MAJBURIY bir martalik migratsiya

Faqat shu versiyadan oldingi kod bilan ishlagan (ma'lumotli) bazani yangilashda — toza o'rnatishda kerak emas
(1-qadam DRY-RUN hisoboti 0 ta hujjat ko'rsatsa, o'tkazib yuboring). Bir martalik, **kod deploy bilan bir vaqtda, seed'dan OLDIN**. Migratsiyasiz jarayondagi (hali tasdiqlanmagan) v259
fan dasturlari `prorektor`/`rektor` bosqichida «ko'rinmas navbat» bo'lib qoladi: navbat ko'rinishi joriy zanjirdan
hisoblanadi, unda bu rollarning bosqichi yo'q (fail-closed).

```bash
node scripts/migrate-scienceprogram-v259-chain.js            # 1) DRY-RUN — hisobotni ko'ring (yozmaydi)
node scripts/migrate-scienceprogram-v259-chain.js --apply    # 2) yozish — avval scripts/backups/ ga JSON zaxira
node seed/studyload-roles.seed.js                            # 3) rektor/prorektor `scienceProgram` → VIEW_ONLY (MERGE)
pm2 reload institute-ais                                     # 4) avval §6 blokidagi `yarn setup:seed` (exit 0). §6.2 ham bajarilsa — reload'ni SHU YERDA QILMANG: §6.2 ning reload'gacha bo'lgan qadamlaridan (1-qadam status backfill, 2-qadam davomat indeksi, «Restart'dan OLDIN» papka, samsVerified dry-run) va `yarn setup:seed` dan keyin BITTA reload
```

Qoida: `approved`/`rejected` bosqichlar (tarix) va `approved` hujjatlar TEGILMAYDI; faqat `pending`
holatdagi eski bosqichlar olib tashlanadi, `dean` qo'shiladi; v142 shaklidagi hujjatlarga tegilmaydi; idempotent (qayta yurgizish
0 o'zgarish; `prorektor`/`rektor` bosqichli eski hujjat bo'lmasa, skript hech narsa yozmaydi). Tasdiqlangan
eski hujjatlar muqovasi o'z zanjiridan (rektor) chiqaveradi — qayta generatsiya shart emas. Tezkor tekshiruv:
yangi v259 fan dasturi → 5 imzo, dekan yakunlaydi, muqovada «<fakultet> fakulteti dekani», 7-band
«…fakulteti Kengashining…».

### 6.2. Magistratura va klinik ordinatura (4.5) — chetlatish buyrug'i, davomat va SAMS integratsiyasi

Bu bo'lim — 4.5 moduli uchun doimiy ma'lumotnoma (tartib, papkalar, tekshiruvlar, qo'lda DB protseduralari).
Chetlatish buyrug'i uchun alohida seed va yangi npm paket **yo'q**.

**Oldingi versiyada ishlagan (ma'lumotli) bazani shu versiyaga yangilashda tartib qat'iy** (toza bazaga o'rnatishda bu
migratsiyalar kerak emas). Boshlashdan oldin — §6 dagi zaxira. Har skript avval bayroqsiz (dry-run — hech narsa
yozmaydi) ishga tushiriladi, hisobot ko'rilgach `--apply` bilan. 1-, 2-, 4- va 6-qadamdagi skriptlar `--apply` da
(o'zgartiradigan yozuv bo'lsa) `scripts/backups/` ga JSON zaxira yozadi va chiqishda `Zaxira: <yo'l>` qatorini beradi —
bu yo'lni saqlang (qaytarish uchun kerak). 5-qadam zaxira yozmaydi.

1. **Holat maydonini to'ldirish** — `node scripts/migrate-45-resident-status.js` → `--apply`. Qachon: yangi fayllar joylangach
   (§6, 1-qadamdagi `rsync`) va `pm2 reload` dan OLDIN, uzilishsiz bitta o'tirishda. Sababi: `status` maydoni bo'lmagan eski
   rezident yozuvlari yangi kodning holat bo'yicha filtrlarida ko'rinmaydi; skript ularga `status: "oquvda"` yozadi.
2. **Davomat: bir dars — bitta yozuv** — `node scripts/migrate-45-attendance-lesson-index.js` → `--apply`. Qachon:
   `pm2 reload` dan OLDIN va 5-qadamdan OLDIN. Takroriy davomat qatorlarini yo'qotib, unikal indeksni yaratadi — batafsil
   pastdagi «Davomat: dars bo'yicha unikal indeks» bandida.
3. **Kod** — pastdagi «Restart'dan OLDIN» bandidagi papkani yarating, §6 blokidagi `yarn setup:seed --dry` →
   `yarn setup:seed` ni bajaring (exit 0), so'ng reload'ni boshlanish vaqti bilan bitta qatorda bajaring va chiqqan
   vaqtni saqlang (6-qadamda kerak): `date -u +%FT%TZ; pm2 reload institute-ais`. `yarn setup:seed --dry` dan OLDIN —
   pastdagi «Bo'limning «Sababli qilish» huquqi» bandidagi faqat-o'qish tekshiruvi (`klinik_ustoz` da `approve` yo'qligi).
4. **`node scripts/migrate-45-expulsion-orders.js`** → `--apply` — faqat reload'dan KEYIN: skript
   `resident_open_unique` indeksini (yangi kod ishga tushganda quradi) va 1-qadamni talab qiladi, aks holda
   yozmasdan to'xtaydi.
5. **`node scripts/recount-45-unexcused-hours.js`** → `--apply` — 08:00 tekshiruvini (sweep) darhol bajaradi,
   xabarlar yuboriladi. Server vaqti bilan **07:30–09:00 oralig'ida ishga tushirmang**: cron bilan parallel ishlab,
   bitta loyihani ikki marta e'lon qilishi mumkin.
6. **Dars bali 0..10 → 0..100** — faqat bazada eski (10 ballik) dars baholari bo'lsa; reload'dan KEYIN:
   `node scripts/migrate-45-lesson-score-100.js --graded-before=<3-qadamdagi vaqt>` (dry-run — reja va anomaliyalar),
   so'ng xuddi shu buyruq `--apply` bilan. Ballarni joyida ×10 qiladi (8 → 80; avval sessiya freymlari, keyin davomat
   qatorlari; `updatedAt` va boshqa maydonlarga tegmaydi). `--graded-before` — reload BOSHLANGAN vaqt (tugagan vaqt
   emas): undan keyin yangi kod qo'ygan 0..100 baholar qamrovga tushmaydi, shuning uchun to'xtatish shart emas.
   `0 < ball ≤ 10` dan tashqari qiymatlar (anomaliya) hech qachon ko'chirilmaydi — bunday qator bo'lsa `--apply` rad
   etadi; ularni qo'lda ko'rib chiqing yoki `--anomalies=keep` bilan (ular joyida qoladi) ishga tushiring. `--apply`
   `scripts/backups/` ga zaxira yozadi; qaytarish — `--revert=<zaxira.json>`.

**Restart'dan OLDIN** — skan ildizi `uploads/` DAN TASHQARIDA (ichida bo'lsa har yuklash `500 scan_root_public`):

```bash
mkdir -p /srv/fjsti/backend/private/residency-expulsion-orders
chown <pm2-foydalanuvchi>: /srv/fjsti/backend/private/residency-expulsion-orders
chmod 700 /srv/fjsti/backend/private/residency-expulsion-orders
```

Boshqa joy — `.env` da `RESIDENCY_EXPULSION_ORDER_FILES_DIR=<mutlaq yo'l>` (u ham `uploads/` va `public/build/` dan
tashqarida bo'lishi shart). Papka `uploads/` bilan birga zaxiraga olinadi. Ixtiyoriy: `RESIDENCY_EXPULSION_SCAN_MAX_MB`
(default `10`, ko'pi bilan `25` — nginx chegarasi).

**Restart'dan KEYIN:**
1. `pm2 logs institute-ais` da 4.5 moduli uchun `[router] … yuklanmadi — SKIP` qatori bo'lmasligi kerak.
2. Indekslar: `db.residencyexpulsionorders.getIndexes()` — `resident_open_unique` (partial `{status:"loyiha"}`)
   va `status_draftedAt`. (Kolleksiya nomi — `Model.collection.collectionName`, qotirmang.)
3. Bo'lim xodimi: `GET /api/expulsion-orders/paginate?page=1&limit=1` → `200`; super_admin:
   `PUT /api/expulsion-orders/<id>/sign` (bo'sh tana bilan ham) → `403 not_office_signer`.
4. Sinov skani `uploads/` ostida hech narsa yaratmaydi.

**Post-check** (hammasi `0` bo'lishi kerak):

```js
const O = db.residencyexpulsionorders;
// yarim qolgan imzo (buyruq imzolangan, rezidentga qo'llanmagan) 10 daqiqadan eski — bo'lim o'sha so'rovni qayta yuborsin
O.countDocuments({ status: "imzolangan", residentAppliedAt: null, signedAt: { $lt: new Date(Date.now() - 600e3) } });
// imzolangan buyrug'i bor rezidentning ochiq loyihasi (sweep yarashtirishi yopadi)
O.aggregate([{ $match: { status: "imzolangan" } },
  { $lookup: { from: "residencyexpulsionorders", localField: "resident", foreignField: "resident", as: "all" } },
  { $match: { "all.status": "loyiha" } }, { $count: "n" }]);   // bo'sh natija = 0
db.residents.countDocuments({ status: "chetlatilgan", expulsionOrderCreated: true });
```

⚠️ Rezidentdagi `expulsionOrderCreated` bayrog'ini ochiq (`loyiha`) buyruqlar soni bilan solishtirsangiz, imzolangan
buyrug'i bor rezidentlarni solishtirishdan chiqaring — yarim imzoda bayroq imzolangan buyruqqa ko'rsatadi.

**Imzoni qaytarish (faqat mas'ul shaxs qarori bilan, qo'lda; API yo'q).** Faqat buyruqda `needsResume: false` bo'lsa bajariladi. Ikki yozuv
atomik EMAS — har birining `modifiedCount` i `1` ekanini tekshiring:

```js
const id = ObjectId("<buyruq>"), now = new Date();
const o = db.residencyexpulsionorders.findOne({ _id: id, status: "imzolangan" });
// Belgi chizig'i — JONLI joriy o'quv yili soati (saqlangan `totalUnexcusedHours` sweep'gacha eskirgan bo'lishi mumkin).
// Oyna: joriy o'quv yili 1-sentabr 00:00Z .. 31-avgust 23:59:59Z; bo'sh `hours` — 2 soat.
const from = new Date("<YYYY>-09-01T00:00:00Z"), to = new Date("<YYYY+1>-08-31T23:59:59.999Z");
const hours = (db.attendances.aggregate([
  { $match: { resident: o.resident, status: "absent", active: true, deletedAt: null, date: { $gte: from, $lte: to } } },
  // `hours || 2`: 0, null, yo'q, NaN → 2 (kod bilan AYNAN bir xil).
  { $group: { _id: null, h: { $sum: { $cond: [
    { $and: [{ $isNumber: "$hours" }, { $ne: ["$hours", 0] }, { $eq: ["$hours", "$hours"] }] }, "$hours", 2] } } } },
]).toArray()[0] || { h: 0 }).h;
db.residencyexpulsionorders.updateOne({ _id: id, status: "imzolangan" }, {
  $set: { status: "rad_etilgan", closedAt: now, closeNote: "qo'lda: <sabab, qaror raqami>", hoursAtClose: hours,
          "deliveries.rejected": now }, // avtomatik «loyiha rad etildi» xabari ketmasin
  $push: { history: { at: now, action: "rad_etildi", source: "runbook", actor: null,
                      actorName: "<kim bajardi>", hours: hours, note: "qo'lda: <sabab>" } } });
// Imzodan OLDINGI holat: odatda "oquvda"; `meros` ta'tilda imzolangan bo'lsa — "akademik_tatil".
db.residents.updateOne({ _id: o.resident, status: "chetlatilgan" },
  { $set: { status: "<oquvda|akademik_tatil>", expulsionOrderCreated: false, expulsionOrderCreatedAt: null } });
// Imzo bo'yicha qaror xabarlari (rezidentda va bo'limda) noto'g'ri bo'lib qoladi — lentadan olinadi (o'chirilmaydi).
db.notifications.updateMany(
  { eventType: { $in: ["residency_expulsion_signed", "residency_expulsion_basis_lost_office"] }, "metadata.orderId": String(id) },
  { $set: { active: false } });
```

Belgi chizig'i tufayli shu o'quv yilida soat `hours` dan oshmaguncha yangi loyiha ochilmaydi.

**Rollback** (chetlatish buyrug'ini imzolashni bilmaydigan oldingi versiyaga qaytish): oldin post-check'dagi birinchi
son (yarim imzo) `0` bo'lishi SHART — bo'lim ularni aynan o'sha so'rov bilan yakunlasin. Oldingi versiya imzolangan
buyruqni bilmaydi: yarim imzodagi rezidentning bayrog'ini tozalab, uni ro'yxatlarga qaytarardi yoki ikkinchi loyiha
(bo'limga xabar bilan) ochardi. Shundan keyin kodni qaytarish ma'lumot uchun xavfsiz (u `chetlatilgan` holatini
o'zgartirmaydi), lekin rad etish belgi chizig'i yo'qoladi — rad etilgan, soati hamon 72+ rezidentga keyingi 08:00
tekshiruvida (sweep) YANGI loyiha (xabari bilan) ochiladi.

Agar 4-qadam (`migrate-45-expulsion-orders.js --apply`) bajarilgan bo'lsa va oldingi versiyaga qaytilsa —
kodni qaytarishdan OLDIN, yangi kod hali diskda turganda:
`node scripts/migrate-45-expulsion-orders.js --revert=scripts/backups/expulsion-orders-default-<stamp>.json`
(4-qadam chiqishidagi `Zaxira:` yo'li). U faqat hali `loyiha` holatida turgan va tarixida bitta yozuv bor buyruqlarni
bekor qiladi hamda skript qayta faollashtirgan rezidentlarni `active: false` ga qaytaradi; bo'lim qaror qilgan
buyruqlar va ularning rezidentlari tegilmaydi (chiqishda ro'yxati beriladi). Skript yangi kodga tayanadi — kod
qaytarilgach ishlamaydi; usiz eski kod qayta faollashtirilgan, hamon bayroqli rezidentlarni yana nofaol qilishi yoki
bayrog'ini tozalashi mumkin.
Qaytarishni ham server vaqti bilan 07:30–09:00 oralig'ida bajarmang.

#### Buyruq loyihasi PDF'i

`GET /api/expulsion-orders/:id/draft-pdf` — birinchi so'rov PDF'ni yaratadi va **bir marta** saqlaydi, keyin har doim
o'sha fayl qaytariladi. Migratsiya, seed, env va qo'shimcha npm paket **kerak emas**; `draftPdf` maydoni ixtiyoriy,
alohida indeks yo'q. Fayllar yuqoridagi skan papkasining o'zida (`private/residency-expulsion-orders` yoki
`RESIDENCY_EXPULSION_ORDER_FILES_DIR`), `draft/YYYY/MM/` ostida saqlanadi — jarayon papkani o'zi yaratadi, alohida
`mkdir` shart emas.

**Restart'dan OLDIN** — shriftlar (yo'q bo'lsa loyiha PDF'i `500`, buzuq qog'oz chiqmaydi):

```bash
ls src/shared/pdfGenerators/fonts/{times,timesbd,timesi,timesbi}.ttf
```

**Restart'dan KEYIN:**
1. Bo'lim xodimi: ochiq `tizim` loyiha uchun `GET /api/expulsion-orders/<id>/draft-pdf` → `200`, PDF ochiladi: harflar
   to'g'ri, har Ilova sahifasida jadval sarlavhasi, har sahifa pastida `Kod: <id>` va `i / N`, «Jami» = jadval.
2. Qayta `GET` — o'sha bayt; `private/residency-expulsion-orders/draft/YYYY/MM/` da bitta fayl, egasi pm2 foydalanuvchisi.
3. `uploads/` ostida yangi narsa yo'q; super_admin → `403 not_office_signer`; `GET /api/expulsion-orders/<id>` javobida
   `draftPdf` bor, `storageKey` yo'q.

**Qayta chiqarish (faqat qo'lda, API yo'q).** Faqat hali skani yo'q ochiq buyruq uchun (masalan, rezident ismi
tuzatilgan bo'lsa). Eski fayl diskda dalil sifatida QOLADI; tarixdagi `pdf_yaratildi` yozuvi uning sha256 ini saqlaydi:

```js
db.residencyexpulsionorders.updateOne(
  { _id: ObjectId("<buyruq>"), status: "loyiha", scan: null },
  { $set: { draftPdf: null } });   // modifiedCount 1 bo'lsin; keyingi GET yangi PDF yaratadi
```

**Rollback:** faqat kod. Oldingi versiya kodi `draftPdf` ni o'qimaydi (javobga faqat oq ro'yxatdagi maydonlar
chiqadi), fayllar diskda dalil sifatida qoladi.

#### Bo'limga loyiha eslatmalari

Ochiq (`loyiha`) buyruqlar bo'yicha bo'limga ilova ichida eslatma yuboriladi: 3-kun, keyin 7, 14, 21… (buyruq
yaratilgan kundan, UZ kalendari bo'yicha). Alohida cron **yo'q** — eslatmalar 08:00 dagi kundalik tekshiruv (va
`recount --apply`) muvaffaqiyatli tugagach yuboriladi. Migratsiya, seed, env, indeks, npm paket **kerak emas**;
buyruqda `remindedStage` maydoni saqlanadi (maydoni yo'q eski hujjat `null` deb hisoblanadi).

**Deploydan OLDIN** — bir kunda keladigan eslatmalar sonini baholash (kolleksiya nomini qotirmang):

```js
const O = db.getCollection("residencyexpulsionorders");   // Order.collection.collectionName bilan tekshiring
O.countDocuments({ status: "loyiha", origin: "meros" });   // migratsiya yaratgan — hammasi migratsiyadan 3 kun keyin
O.countDocuments({ status: "loyiha", origin: "tizim" });
```

`migrate-45-expulsion-orders --apply` yaratgan barcha `meros` loyihalar va birinchi sweep ochgan `tizim` loyihalar
deploydan ~3 kun o'tib **bir kunda** eslatma oladi (har loyihaga, har bo'lim xodimiga bittadan), keyin haftalik. Bo'limni
oldindan ogohlantiring. ⚠️ `recount-45-unexcused-hours.js --apply` ham muddati kelgan eslatmalarni yuboradi.

**Restart'dan KEYIN** (birinchi muddatli kundan): `pm2 logs institute-ais` da `[ExpulsionCron] Tekshiruv yakunlandi` dan
keyin `[4.5 expulsionOrder] eslatmalar: <yuborildi>/<tayyor> loyiha (muddati kelgan <n>)`. `officeRecipients: ... topilmadi`
— hech narsa band qilinmaydi, rol/xodim tuzatilgach ertasi kuni yuboriladi. `... o'tkazib yuborildi — bo'lim hozir qaror
qila olmaydi` — nofaol yoki o'chirilgan rezident loyihasi (migratsiya tugamagan) — tekshiring.
Server vaqt zonasi (`timedatectl`): cron server vaqti bilan 08:00 da; UTC serverda eslatma ~13:00 UZ da keladi (kun hisobi
bunga bog'liq emas).

Cheklovlar: `migrate-45-expulsion-orders --revert` yopgan `meros` loyihaning eslatmalari keyingi 08:00 sweep'igacha
(yarashtirish ularni oladi) faol qoladi; UZ yarim tunini kesib o'tgan ikki parallel ishga tushish (cron +
`recount --apply`) bitta loyihada ikki bosqichni faol qoldirishi mumkin — keyingi eslatma bosqichida o'zi tuzaladi.

**Rollback:** kodni qaytarish yetarli (maydon kodsiz inert). Ixtiyoriy: eslatmalarni olish —
`db.notifications.updateMany({ eventType: "residency_expulsion_draft_office", "metadata.reminderStage": { $exists: true }, active: true }, { $set: { active: false } })`.

#### «Keldi» dalili faqat serverda — `samsVerified` migratsiyasi

`samsVerified` ni faqat server yozadi (so'rov tanasidagi qiymat tashlanadi). Ordinaturada qo'lda «Keldi» qo'yilmaydi
(`400 present_requires_sams`), magistraturada qo'lda tasdiq (`manualVerified`) qoladi. `PUT /api/attendance/:id` faqat
aniq ruxsat etilgan maydonlarni qabul qiladi (allowlist), yozuv CAS bilan bajariladi (o'qish–yozish orasida qator
o'zgarsa `409 state_changed`).

Mavjud ma'lumot uchun bir martalik, qaytariladigan migratsiya — `scripts/migrate-45-sams-verified.js`: eski versiyada
frontend yozgan har `samsVerified: true` (`session: null` qatorlar) → `manualVerified: true`. Seed, env, indeks, npm
paket **kerak emas**.
**Tartib:** dastlabki dry-run — yangi kod fayllari joyiga qo'yilgach, `pm2 reload` dan OLDIN; reload'dan KEYIN — yana
dry-run, so'ng `--apply`, SAMS worker yoqilishidan OLDIN (pastda).

**Frontend BIRINCHI** yangilanadi (yoki backend bilan bir oynada): eski frontend bilan ordinatura «Keldi» har saqlashda
`400` qaytaradi («Kelmadi» va magistratura ishlaydi).

⚠️ **Oraliq davr:** yangi backend ishga tushgandan SAMS worker yoqilguncha ordinaturada yangi `present` yaratib
bo'lmaydi, ya'ni yangi darslarga ball qo'yilmaydi. Mavjud yozuvlar (va ularning ballari) tahrirlanadi. Soxta `absent`
paydo bo'lmaydi (hech narsa avtomatik `absent` yozmaydi).

**Restart'dan KEYIN:** `pm2 logs institute-ais` — 4.05 uchun `[router] … yuklanmadi — SKIP` yo'q. Ordinatura
rezidentiga, shu sana/dars uchun yozuv YO'Q kombinatsiyada (aks holda takroriy dars `400` i chiqadi):
1. `POST /api/attendance` `status: "present"` (bayroqsiz) → `400 { reason: "present_requires_sams" }`. `reason` yo'q
   bo'lsa — yangi kod ishlamayapti: TO'XTANG, 2-qadamni yubormang.
2. Shu so'rov `samsVerified: true, manualVerified: true` bilan → yana `400 present_requires_sams` (ikkala bayroq ham
   e'tiborsiz). Ikkala qadamda ham hech narsa saqlanmaydi.

🔴 Prod'da `absent` YOZUVI bilan tekshirmang: u haqiqiy rezidentga sababsiz soat qo'shadi va 6/72 soat zanjirini
(ogohlantirish, chetlatish loyihasi, xabarnomalar) ishga tushiradi. `absent` da bayroqlar tashlanishini tekshirish kerak
bo'lsa — faqat sinov (dev/QA) bazasida.

**Migratsiya — reload'dan KEYIN, SAMS yuboruvchisi yoqilishidan OLDIN.** Yuboruvchi yoqilgandan keyin ishga tushirilsa, SAMS
sessiya proyeksiyasi yozgan haqiqiy dalil qo'lda tasdiqqa aylanib qolardi (`session: null` filtri — ikkinchi himoya).
Xulq neytral: har qatorda `(samsVerified || manualVerified)` o'zgarmaydi, `updatedAt` tegilmaydi — downtime yo'q.

```bash
node scripts/migrate-45-sams-verified.js              # dry-run — hisobotni ko'rib chiqing
node scripts/migrate-45-sams-verified.js --apply      # zaxira → CAS yozuv → invariant tekshiruvi; exit 1 bo'lsa — dry-run'dan qayta boshlang
# exit 1 sabablari: parallel o'zgarish (poyga), invariant buzilishi (rejadagi qatorlarda) yoki qamrov to'liq emas (nishonda yangi qator)
```

Dry-run'da qarang: sarlavhadagi `Baza:` — to'g'ri baza; nishon soni holat/dastur bo'yicha, allaqachon qo'lda tasdiqli,
soft-delete, ballli, muallifsiz; **nishondagi eng so'nggi `createdAt` reload vaqtidan KEYIN bo'lsa — TO'XTANG** (yangi
kod ishga tushgach frontend `samsVerified: true` yozolmaydi, demak uni hali boshqa manba yozmoqda; skript chiqishidagi
«… ishga tushirilganidan (reload) KEYIN bo'lsa — TO'XTANG» ogohlantirishi aynan shu backend reload'ini bildiradi). Eng so'nggi
`updatedAt` — faqat ma'lumot uchun: yangi kod eski dalilli qatorlarni tahrirlashga ruxsat beradi, oddiy ball tahriri ham
uni yangilaydi. Bu yerdagi nishon soni reload'dan oldingi dastlabki dry-run'dagidan KO'P bo'lishi mumkin (reload'gacha
eski kod ishlab turadi). «present bo'lmagan dalilli qatorlar» soniga ham qarang: ular `PUT` bilan `present` ga o'tkazilishi
mumkin — ro'yxatini tizim uchun mas'ul shaxsga bering.

**Post-check:**

```js
const A = db.attendances;
A.countDocuments({ samsVerified: true, session: null });                              // 0
A.countDocuments({ manualVerified: true });           // = dry-run manualTrue + ko'chirilgan − allaqachon qo'lda tasdiqli (± jonli magistratura tasdiqlari)
A.countDocuments({ status: "present", samsVerified: { $ne: true }, manualVerified: { $ne: true } });  // ≤ dry-run (faqat kamayadi)
```

`scripts/backups/sams-verified-<db>-<vaqt>.json` ni prod zaxiralari bilan **saqlang** — bu ko'chirishning yagona izi
(ko'chirilgan qatorlarda `manualVerifiedBy/At` = `null`).

**Rollback:** faqat kod — ma'lumotga bog'liqlik yo'q (eski backend ham `samsVerified || manualVerified` ni o'qiydi,
yangi frontend eski backend bilan ishlaydi). Migratsiyani qaytarish ixtiyoriy va **faqat SAMS worker yoqilishidan
OLDIN**: `node scripts/migrate-45-sams-verified.js --revert=<zaxira.json>`. Faqat hali ko'chirilgan holatdagi VA
zaxiradan keyin tahrirlanmagan (`updatedAt`) qatorlar qaytadi; qolganlari «tegilmadi» deb sanaladi (jumladan tasdig'i
olinib, keyin qayta tasdiqlangan qator). Zaxira boshqa bazaniki bo'lsa (masalan, prod nusxasidan tiklangan sinov bazasi — `_id` lar bir xil) — rad etiladi;
ataylab bo'lsa `--allow-other-db`. Poyga (exit 1) tufayli `--apply` qayta ishga tushirilgan bo'lsa — har bir `--apply`
zaxirasini qaytaring, istalgan tartibda.

#### 6 soatda avtomatik davomat bildirgisi

Rezident joriy o'quv yilida 6 soat sababsiz qoldirsa, muvaffaqiyatli 08:00 tekshiruvidan (va `recount --apply` dan)
keyin tizim `residencyNotice` (`kind: "avtomatik"`, PDF bilan) yaratadi va bo'lim xodimlariga ilova ichida xabar beradi;
soat 6 dan tushsa bildirgi `bekor_qilingan` bo'ladi. Migratsiya, seed, yangi env, RBAC o'zgarishi va npm paket **yo'q**;
yangi cron yo'q. Birinchi chiqarish alohida buyruqsiz bo'ladi: birinchi muvaffaqiyatli sweep yoki `recount --apply`
6+ soatli HAR rezidentga bildirgi chiqaradi (PDF ~0,1 s CPU har biriga) va bo'limning har xodimiga har bildirgi uchun
bitta xabar yuboradi.

**Tartib:**
1. Deploydan OLDIN — 6+ soatli rezidentlar sonini sanang (pastdagi 1-so'rov) va bo'limni birinchi chiqarish kuni
   keladigan ilova ichidagi xabarlar to'lqini haqida oldindan ogohlantiring. Bildirgi papkasi va shriftlarni
   tekshiring («Talablar»).
2. `pm2 reload` dan KEYIN — `resident_year_auto_faol_unique` indeksini tekshiring («Indeks»).
3. Birinchi chiqarish — navbatdagi 08:00 tekshiruvi yoki `node scripts/recount-45-unexcused-hours.js --apply`.
   `--apply` butun kundalik 4.5 tekshiruvini bajaradi (chetlatish loyihalari, eslatmalar va xabarlar ham yuboriladi):
   uni §6.2 dagi umumiy tartibda (`migrate-45-expulsion-orders` dan keyin) ishga tushiring, avval esa bayroqsiz
   ishga tushirib (`node scripts/recount-45-unexcused-hours.js` — faqat taqqoslash hisoboti, bazaga yozmaydi)
   natijani ko'rib chiqing. Sweep yiqilsa skript `exit 1` bilan tugaydi. `--apply` ni server vaqti bilan 07:30–09:00
   oralig'ida ishga tushirmang — 08:00 tekshiruvi bilan parallel ishlaydi.
4. Chiqarishdan keyin — `pm2 logs` dagi natija qatorini («Loglar») va 2–4-so'rovlarni tekshiring; `yangi X` sonini
   1-so'rovda sanalgan son bilan solishtiring.
5. Qaytarishda — «Rollback semantikasi» dagi ma'lumot qadami kod qaytarilishidan OLDIN, kod qaytarish bilan bir
   o'tirishda va server vaqti bilan 07:30–09:00 dan tashqarida bajariladi (oradagi 08:00 tekshiruvi yangi avtomatik
   bildirgi yaratishi mumkin).

**Talablar.** Shriftlar `src/shared/pdfGenerators/fonts/{times,timesbd,timesi,timesbi}.ttf` (chetlatish buyrug'i
loyihasi PDF'i bilan umumiy — yuqoridagi `ls` tekshiruvi). Bildirgi papkasi — `uploads/residency-notices` (yoki
`RESIDENCY_NOTICE_FILES_DIR`), pm2 foydalanuvchisi yoza oladigan (ustoz bildirgisi bilan bir papka). Papka boshqa
joyga qo'yilsa — uni ham zaxiraga qo'shing.

**Indeks — qulf bazada.** `resident_year_auto_faol_unique`: kalit `{ resident: 1, "auto.countingYear": 1 }`,
`unique: true`, `partialFilterExpression: { "auto.state": "faol" }` (satr tengligi bo'yicha — qo'lda yozilgan
bildirgilar indeksga kirmaydi). Mongoose uni boot'da quradi, lekin qurish xatosini JIM yutadi (logda ham chiqmaydi);
indekssiz parallel sweep'lar (cron + `recount --apply`) bitta rezidentga ikki faol bildirgi chiqarishi mumkin. Tekshirish —
`getIndexes()` (kolleksiya nomi — `Notice.collection.collectionName`, odatda `residencynotices`).

**Loglar** (`pm2 logs institute-ais`):
- har muvaffaqiyatli sweep'dan keyin — `[ExpulsionCron] Tekshiruv yakunlandi` dan so'ng
  `[4.5 autoAbsenceNotice] avtomatik bildirgilar: yangi X, bekor Y, e'lon Z`;
- `officeRecipients: ... topilmadi` — hech narsa band qilinmaydi, rol/xodim tuzatilgach keyingi sweep e'lon qiladi;
- `bekor qilingan bildirgilarning qolib ketgan N ta xabari olindi` — bekor qilishda olinmay qolgan xabarlarni sweep
  o'zi oldi (har kuni takrorlansa — Mongo/tarmoqni tekshiring).

**Diagnostika so'rovlari** (1-so'rov — deploydan oldin va birinchi chiqarishdan keyin; 2–4 — chiqarishdan keyingi
tekshiruv):

```js
// 1) Bir kunlik to'lqin: N bildirgi; xabarlar = N × faol `magistratura_bolim` xodimlari.
// Joriy o'quv yili: 1-sentabr 00:00Z .. 31-avgust 23:59:59Z; bo'sh `hours` — 2 soat (kod bilan bir xil).
const from = new Date("<YYYY>-09-01T00:00:00Z"), to = new Date("<YYYY+1>-08-31T23:59:59.999Z");
db.attendances.aggregate([
  { $match: { status: "absent", active: true, deletedAt: null, date: { $gte: from, $lte: to } } },
  { $group: { _id: "$resident", h: { $sum: { $cond: [
    { $and: [{ $isNumber: "$hours" }, { $ne: ["$hours", 0] }, { $eq: ["$hours", "$hours"] }] }, "$hours", 2] } } } },
  { $match: { h: { $gte: 6 } } },
  { $lookup: { from: "residents", localField: "_id", foreignField: "_id", as: "r" } }, { $unwind: "$r" },
  { $match: { "r.active": true, "r.deletedAt": null, "r.status": { $in: [null, "oquvda"] },
              "r.program": { $in: ["magistratura", "ordinatura"] } } },
  { $count: "n" },
]);

const N = db.getCollection("residencynotices");   // Notice.collection.collectionName bilan tekshiring
// 2) E'lon qilinmagan faol bildirgi (1 kundan eski) — bo'lim ro'yxati bo'sh yoki xabar saqlanmadi. 0 bo'lsin.
N.countDocuments({ kind: "avtomatik", "auto.state": "faol", "auto.notifiedAt": null, createdAt: { $lt: new Date(Date.now() - 864e5) } });
// 3) E'lon belgisi bor, xabari yo'q (band qilish va yuborish orasida jarayon to'xtatilgan). 0 bo'lsin;
//    aks holda o'shalarga `{ $set: { "auto.notifiedAt": null } }` — keyingi sweep e'lon qiladi.
N.aggregate([{ $match: { kind: "avtomatik", "auto.state": "faol", "auto.notifiedAt": { $ne: null } } },
  { $project: { id: { $toString: "$_id" } } },
  { $lookup: { from: "notifications", localField: "id", foreignField: "metadata.noticeId", as: "a" } },
  { $match: { a: { $size: 0 } } }, { $count: "n" }]);
// 4) Bekor qilingan, lekin faol xabari qolgan bildirgi — har sweep joriy va o'tgan yilnikini tuzatadi. Sweep'dan keyin 0.
N.aggregate([{ $match: { kind: "avtomatik", "auto.state": "bekor_qilingan" } },
  { $project: { id: { $toString: "$_id" } } },
  { $lookup: { from: "notifications", localField: "id", foreignField: "metadata.noticeId", as: "a" } },
  { $match: { a: { $elemMatch: { eventType: "residency_absence_notice_auto", active: true } } } }, { $count: "n" }]);
```

Cheklovlar: yaratish/bekor qilish ≤ 24 soat kechikadi (bo'lim shu kuni sababli deb tan olingan bildirgini ko'rishi
mumkin); ikki parallel ishga tushishda (cron + `recount --apply`) ortiqcha PDF fayl diskda qolishi mumkin (logda
`fayl yetim qoldi`). Frontendda avtomatik bildirgi «Avtomatik» nishoni bilan faqat o'qish uchun ko'rsatiladi,
`bekor_qilingan` bildirgi — «Bekor qilingan — soat 6 dan tushdi» yorlig'i bilan.

**Rollback semantikasi.** Faqat kodni qaytarish YETMAYDI: eski model enum'i va majburiy `sender` avtomatik bildirgini
ko'rish/qaror yozishda `400` beradi. Shuning uchun ma'lumot qadami kod qaytarilishidan OLDIN bo'lishi shart — avtomatik
bildirgilar soft-delete qilinadi, bo'lim xabarlari o'chiriladi:

```js
db.getCollection("residencynotices").updateMany({ kind: "avtomatik", deletedAt: null },
  { $set: { deletedAt: new Date(), deletionReason: "avtomatik bildirgi rollback" } });
db.notifications.updateMany({ eventType: "residency_absence_notice_auto", active: true }, { $set: { active: false } });
```

Indeks qolishi mumkin (inert) yoki `dropIndex("resident_year_auto_faol_unique")`. Qayta deploy: o'sha `deletedAt` larni
`null` qiling — aks holda bu rezidentlar shu o'quv yilida yangi bildirgi olmaydi (o'chirilgan faol bildirgi indeks
kalitini ushlab turadi).

#### Mashg'ulot sessiyalari

`/api/residency-sessions` — mashg'ulotni e'lon qilish (klinik ustoz yoki bo'lim xodimi), ro'yxat va bekor qilish.
Migratsiya, seed, yangi env kaliti, npm paket va RBAC o'zgarishi **talab qilinmaydi**. Ikki yangi kolleksiya (`residencysessions`,
`residencysessionrosters` — nomini `Model.collection.collectionName` dan tekshiring) boot'da mongoose `autoIndex` bilan
indekslari bilan yaratiladi. `attendance` ga yozilmaydi — 6/72 soat hisobi o'zgarmaydi.

**Deploydan OLDIN** — e'lon mavjud `residentAttendance` grantiga tayanadi (yangi kalit yo'q):

```js
db.roles.find({ title: { $in: ["klinik_ustoz", "magistratura_bolim"] } },
  { title: 1, permissions: { $elemMatch: { section: "residentAttendance" } } });
// ikkalasida create, readAll, update bo'lsin; yetishmasa — `node seed/residency-roles.seed.js` (additiv)
```

**Restart'dan KEYIN:**
1. `pm2 logs institute-ais` — 4.05 uchun `[router] … yuklanmadi — SKIP` YO'Q.
2. Indekslar — mongoose indeks qurish xatosini JIM yutadi (logda ham chiqmaydi); qurilmasa idempotentlik va
   «bir darsga bitta freym» jimgina yo'qoladi:

   ```js
   db.residencysessions.getIndexes();
   // session_announced_unique (unique, partial {status:"announced"}), day_desc, group_day, announcedBy_day
   db.residencysessionrosters.getIndexes();
   // session_resident_unique, resident_lesson_live_unique (ikkalasi unique, partial {cancelledAt:null}), resident_day
   ```
3. Bo'lim xodimi: `GET /api/residency-sessions/paginate?page=1&limit=1` → `200`; super_admin: `POST
   /api/residency-sessions` (to'g'ri tana) → `403 not_session_announcer`.

**Post-check** (hammasi `0`):

```js
// bekor qilingan sessiyaning jonli freymi
db.residencysessionrosters.aggregate([{ $match: { cancelledAt: null } },
  { $lookup: { from: "residencysessions", localField: "session", foreignField: "_id", as: "s" } },
  { $match: { "s.status": "cancelled" } }, { $count: "n" }]);   // bo'sh natija = 0
// fan-out uzilgan sessiya (10 daqiqadan eski) — kun ochiq bo'lsa, e'lonchi xuddi shu e'lonni qayta yuborib tiklaydi
db.residencysessions.countDocuments({ status: "announced", fannedOutAt: null, createdAt: { $lt: new Date(Date.now() - 600e3) } });
```

Birinchi so'rov `0` dan katta bo'lsa (bekor qilishning freym qadami uzilgan) — qo'lda baza tuzatish SHART EMAS: bo'lim
xodimi o'sha sessiyaga `PUT /api/residency-sessions/:id/cancel` ni qayta yuboradi — javob `409
session_already_cancelled`, lekin server avval jonli freymlarni bekor qiladi (xuddi shu darsga yangi e'lon ham ularni
supuradi). Keyin so'rov `0` bo'lishi kerak. Ikkinchi so'rov `0` dan katta bo'lsa — e'lonchi (kun hali ochiq bo'lsa)
aynan o'sha e'lonni qayta yuboradi: javob `409 session_already_announced`, lekin server fan-out'ni davom ettiradi.

**Rollback:** faqat kod — ikki kolleksiya inert (boshqa kod o'qimaydi, `attendance` ga yozilmagan). Kolleksiyalarni
drop qilish ma'lumotni butunlay o'chiradi — faqat mas'ul shaxsning aniq qarori bilan.

#### Sessiya bahosi, yechimi va davomatga proyeksiyasi

Migratsiya, backfill, seed, yangi env kaliti, npm paket va RBAC o'zgarishi **talab qilinmaydi**. Yangi maydonlar
(`attendances.session`/`sessionRev`/`scoreRev`, freymdagi dalil, revizya va ball maydonlari,
`residencysessions.rosterFrozenAt`) `null` default bilan; kod ularni `null` va yo'q maydon sifatida bir xil o'qiydi
(`{session: null}` yo'q maydonni ham topadi). SAMS ma'lumotlari kelmaguncha (SAMS tomonidagi yuboruvchi yoqilmaguncha)
sessiya qatorlari davomatga yozilmaydi va sessiyaga baho qo'yish `409 not_confirmed` qaytaradi — xavfsiz holat.
`amaliy` sessiyasiga baho umuman qo'yilmaydi — `409 lesson_type_not_graded`.

**Restart'dan KEYIN:**
1. `pm2 logs institute-ais` — 4.05 uchun `[router] … yuklanmadi — SKIP` YO'Q.
2. Indeks — Mongoose qurish xatosini jim yutadi (`attendance.model.js` tinglovchisi `[4.5 attendance] indeks qurilmadi`
   deb loglaydi — bu faqat signal, dalil faqat `getIndexes()`); qurilmasa bir sessiya × rezidentga ikki qator (soat ikki
   marta) paydo bo'lishi mumkin. Birinchi deployda indeks bo'sh to'plam ustida quriladi (sessiya qatori hali yo'q) va
   `resident_lesson_unique` (pastdagi «Davomat: dars bo'yicha unikal indeks») bilan yonma-yon turadi:

   ```js
   db.attendances.getIndexes()
   // attendance_session_resident_unique: { session: 1, resident: 1 }, unique,
   //   partialFilterExpression: { session: { $type: "objectId" } }
   ```
3. SAMS yuboruvchisi yoqilmaguncha sessiya qatorlari soni `0` bo'lishi kerak:
   `db.attendances.countDocuments({ session: { $type: "objectId" } })`.

**Kuzatish (SAMS yuboruvchisi yoqilgach).** Loglar: `[4.5 sessionResolution] …` (sessiya, freym, tuzatish o'tishi yoki
qayta hisob xatosi — faqat id'lar bilan; freym xatosi o'tishni to'xtatmaydi, keyingi yechim qayta urinadi);
`[4.5 sessionProjection] qo'lda yozilgan dars bor — o'tkazildi …` (o'tish davri: o'sha darsda eski qo'lda yozilgan qator
bor — sessiya qatori yozilmaydi) va `[4.5 sessionProjection] dars kaliti to'qnashuvi … index=…` (`resident_lesson_unique`
indeksi; keyingi yechim qayta urinadi). Oxirgi ikkisi takrorlansa — bo'lim o'sha qo'lda yozilgan qatorni tekshiradi.
`warn` `[4.5 sessionResolution] tuzatish chegarasi (3) — qator freymdan orqada qolishi mumkin session=… cancelled=…
residents=…` — bir martalik bo'lsa 7 kunlik oyna ichida keyingi yechim o'tishi tuzatadi; oynadan tashqari kun uchun yoki
takrorlansa — tizim uchun mas'ul dasturchiga murojaat qiling.

**Rollback:** faqat kod — yangi maydonlar va indeks inert qoladi. Sessiya qatorlari faqat SAMS yuboruvchisi
yoqilgandan keyin paydo bo'ladi. Oldingi versiyaga qaytilsa va bu qatorlarni sababsiz soat hisobidan chiqarish kerak
bo'lsa (ixtiyoriy, mas'ul shaxs qarori bilan):

```js
db.attendances.updateMany({ session: { $type: "objectId" }, deletedAt: null },
  { $set: { deletedAt: new Date(), deletionReason: "session_rollback" } })
```

keyin `node scripts/recount-45-unexcused-hours.js --apply` (server vaqti bilan 07:30–09:00 oralig'ida emas).

#### SAMS davomat ma'lumotlarini qabul qilish (4.5)

`GET /api/residency-sams/roster` va `POST /api/residency-sams/ingest` (SAMS tomonidagi yuboruvchi uchun, JWT'siz,
`X-Sams-Service-Key` sarlavhasi bilan) hamda bo'limning uzilish oynasi API'si `/api/residency-sams-outages`.
Migratsiya, backfill, seed va qo'shimcha npm paket talab qilinmaydi. To'rtta kolleksiya (`residencysamspresences`,
`residencysamsorgdays`, `residencysamssyncstates`, `residencysamsoutages`) qo'lda yaratilmaydi — birinchi yozuvda
paydo bo'ladi.

**Tartib.** Avval SANFAK `.env` ga kalit qo'yiladi, backend qayta ishga tushiriladi (`pm2 reload institute-ais`) va
quyidagi tekshiruvlar o'tadi. SAMS tomonidagi yuboruvchi eng oxirida, xuddi shu kalit bilan yoqiladi. Yoqishdan OLDIN
quyidagilar bajarilgan bo'lsin:
1. `migrate-45-sams-verified.js --apply` («Keldi» dalili bandi);
2. bo'limning «Sababli qilish» huquqi va frontendning shu versiyasi (pastda, «Bo'limning «Sababli qilish» huquqi») —
   SAMS yozgan noto'g'ri `absent` uchun birinchi chora shu tugma;
3. yoqish bilan BIR UZ kunida, yoqishdan oldin — bo'lim e'lon qilgan uzilish oynasi (pastda, «SAMS faktlari: sessiya
   yechimi…» → «Kutilgan ma'lumot»); usiz birinchi kechalik reconcile o'tgan 6 kunni darhol yopadi.

Yoqilgandan keyin — pastdagi «SAMS monitori» va «SAMS faktlari: sessiya yechimi…» bandlaridagi log va so'rovlar.

**Kalit (`.env`).** `SAMS_SERVICE_KEY` — kamida 32 belgi, `SERVICE_KEY` dan FARQLI, faqat SAMS tomonidagi yuboruvchi
bilan ulashiladi; SAMS tomonida ham aynan shu qiymat (`RESIDENCY_SYNC_SERVICE_KEY` o'zgaruvchisiga) o'rnatiladi.
Yaratish — shell
tarixiga tushmasligi uchun bosh probel bilan: ` openssl rand -hex 32`. Qiymat hech qayerga (log, xabar, tiket)
yozilmaydi. Kalit qo'yilmaguncha (shuningdek 32 belgidan qisqa yoki `SERVICE_KEY` bilan bir xil bo'lsa) endpointlar
**har doim `401`** qaytaradi — shuning uchun kod kalitdan oldin deploy qilinsa ham shaxsiy ma'lumot tashqariga
chiqmaydi. Kalit yaroqsiz bo'lsa bootda bitta `[residency-sams] SAMS_SERVICE_KEY sozlanmagan` ogohlantirishi chiqadi
(boot yiqilmaydi). Kalit almashtirilganda yangi qiymat ikki tomonga ham qo'yiladi.

**Restart'dan KEYIN:**
1. `pm2 logs institute-ais` — 4.05 moduli va umumiy boot uchun `[router] … yuklanmadi — SKIP` qatori yo'q.
2. Kalitsiz: `curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/api/residency-sams/roster` → `401`.
3. `.env` ga kalit qo'yilgach (shell'da `$SAMS_SERVICE_KEY` o'zgaruvchisi YO'Q — kalit `.env` dan o'qiladi, javobdan
   faqat oyna va son chiqariladi). Kalit terilmaydi va buyruq argumentiga (argv) yozilmaydi: sarlavha `-H @<(printf …)`
   bilan beriladi (curl ≥ 7.55; `ps` da ko'rinmaydi), buyruq boshidagi bo'sh joy uni shell tarixidan saqlaydi:
   ` curl -s -H @<(printf 'X-Sams-Service-Key: %s\n' "$(grep '^SAMS_SERVICE_KEY=' /srv/fjsti/backend/.env | cut -d= -f2-)") https://<domain>/api/residency-sams/roster | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.window,(j.jshshirs||[]).length)})'`
   → oyna (`{ from: …, to: … }`) va son chiqadi (`undefined 0` chiqsa — kalit qabul qilinmadi, `401`):
   `window` = bugun-6..bugun (UZ), `jshshirs` soni — ordinatura kogortasi (faol, holati `oquvda` yoki bo'sh,
   JSHSHIR'i 14 raqamli rezidentlar). Javobda JSHSHIR'lar (shaxsiy ma'lumot) bor — uni faylga, xabar yoki tiketga
   saqlamang, faqat sonini tekshiring.
4. Birinchi paketdan keyin indekslar (mongoose avtomatik indeks qurish xatosini jim yutadi — logda ham chiqmaydi; ingest
   esa unique indeks qurilmasa `500` qaytaradi va hech narsa yozmaydi):
   ```js
   db.residencysamspresences.getIndexes()   // resident_day_unique (unique), dbname_1_day_1
   db.residencysamsorgdays.getIndexes()     // dbname_day_unique (unique)
   db.residencysamssyncstates.getIndexes()  // key_1 (unique)
   ```
5. Audit jurnali — ingest so'rovlari unga yozilmaydi: `db.auditlogs.countDocuments({ path: /^\/api\/residency-sams\/ingest/ })`
   → `0`. Rad etilgan kalitlar faqat `pm2 logs` da: `[residency-sams] rejected service key ip=… path=…`. Har paket
   bitta info qatori beradi:
   `[residency-sams] ingest window=… tenants=… presence=<qator>/<eskirgan> superseded=<n> orgDays=… unknown=…
   conflicts=… ms=…`. `superseded` — javob bergan klinikada yakuniy paket qayta yozmagan qisman rezident qatorlari
   (`stale` ga tushiriladi); odatda 0, rezident klinika almashtirganda yoki kogortadan chiqqanda musbat.

**Soat.** SAMS va SANFAK soatlari NTP bilan sinxronlanadi; farq > 5 daqiqa bo'lsa paketlar `400 window_in_future` /
`emitted_at_out_of_range` oladi. SAMS server vaqt zonasi UTC+5 bo'lishi shart — aks holda har paketda
`[residency-sams] serverUtcOffsetMinutes=… (kutilgan 300)` ogohlantirishi chiqadi.

**Qayta yuborish so'rovi (qo'lda, mongosh orqali; SAMS monitorining avtomatik so'rovi ham bor — rosterda ikkalasining
ertarog'i beriladi).** Roster `resendFrom` ni [bugun-30, bugun] ga kesib beradi; yuboruvchi o'sha kundan boshlab qayta
yuboradi. So'rovdan keyin kelgan, `failedTenants` siz va `manual` bo'lmagan paketlar birgalikda [so'ralgan kun .. bugun]
ni qoplagach ingest so'rovni o'zi tozalaydi (`resendCleared: true`; `resendRequestedAt` ham `null` bo'ladi — keyingi
so'rov eski vaqtni meros olmaydi); biror klinika o'qilmagan paket qamrovga kirmaydi va so'rovni saqlab qoladi.
`resendRequestedAt` ni albatta qo'ying (qo'yilmasa — birinchi paket uni qo'yadi va so'rov bir o'tish kechroq tozalanadi).
So'rovni faqat shu buyruq bilan yozing: hujjatni o'chirib qayta yaratmang va `resendClearedAt` ga tegmang — u tozalash
belgisi, parallel ingest tozalangan so'rovning eski holatini yangi so'rovga qo'llamasligi unga bog'liq:
```js
db.residencysamssyncstates.updateOne({ key: "default" },
  { $set: { resendFrom: "YYYY-MM-DD", resendRequestedAt: new Date() } }, { upsert: true })
```

**Uzilish oynasi.** Faqat bo'lim (`residencyLesson:update` huquqi) yaratadi/bekor qiladi; `dbname` SAMS'dan kamida bir
marta kelgan bo'lishi kerak (aks holda `400 unknown_clinic`), shuning uchun yuboruvchi yoqilmaguncha faqat «barcha
klinikalar» (`dbname: null`) oynasi yaratiladi.

**Rollback:** kodni oldingi versiyaga qaytarish yetarli (route'lar va audit istisnosi ketadi). Kolleksiyalar inert
qoladi yoki `db.<kolleksiya>.drop()` bilan olinadi — ularni bu integratsiyadan boshqa kod o'qimaydi; o'chirilgan
ma'lumotni SAMS oxirgi 31 kun uchun `resendFrom` orqali qayta yuborishi mumkin. Yuboruvchini o'chirish SAMS tomonida
bajariladi: SANFAK'dagi mavjud ma'lumot saqlanadi, yuborilmagan kunlar «o'lchanmagan» bo'lib qoladi.

#### Davomat: dars bo'yicha unikal indeks

`attendances` kolleksiyasida `resident_lesson_unique` indeksi: kalit `{ resident: 1, date: 1, science: 1, lessonType: 1 }`
(tartib muhim), `unique: true`, `partialFilterExpression: { deletedAt: null }`. Bir darsga (`resident`, `date`,
`science`, `lessonType`; `null` = `null`) bitta jonli yozuv bo'ladi; takroriy `POST`/`PUT` → `400 duplicate_lesson`.
Seed, `.env` kaliti, RBAC o'zgarishi va yangi npm paket **yo'q**. Toza bazada indeksni yangi kod o'zi quradi — skript
kerak emas. Ma'lumotli bazani yangilashda — bir martalik, qaytariladigan migratsiya
`scripts/migrate-45-attendance-lesson-index.js`, yuqoridagi tartibning 2-qadami (reload'dan va sababsiz soatlarni
qayta hisoblashdan OLDIN).

**Nega skript, avtomatik indeks emas.** Mongoose avtomatik indeks qurishdagi xatoni jim yutadi: bazada bitta dublikat
bo'lsa indeks qurilmaydi va cheklov yo'q bo'lib qoladi. `attendance.model.js` bunday xatoni
`[4.5 attendance] indeks qurilmadi …` deb loglaydi — bu faqat signal. Skript dublikatlarni yo'qotadi, indeksni o'zi
yaratadi va `indexes()` bilan tasdiqlaydi (aks holda `exit 1`). Keyingi reload'dagi avtomatik qurish shu indeksni
ko'radi — o'zgarish yo'q.

**Skript rejimlari** (`--db=<baza>` — boshqa baza; zaxira nomida ham ko'rinadi):

| Rejim | Nima qiladi |
|---|---|
| bayroqsiz / `--dry` | HECH NARSA yozmaydi: indeks holati; dublikat guruhlari va ortiqcha qatorlar; ziddiyatli guruhlar (qoladigan ↔ olib tashlanadigan qator holati va farq qilgan maydonlar); joriy o'quv yili sababsiz soati kamayadigan rezidentlar (har biri uchun kamayish va «migratsiyadan keyin joriy yil» soati — recount dry-run ham, `--apply` ham aynan shu sonni ko'radi; pastdagi «Sababsiz soatlarni qayta hisoblash bilan bog'liqlik»); bir kunda turli vaqtli qatorlar (faqat hisobot, tegilmaydi) |
| `--apply` | EJSON zaxira (`scripts/backups/attendance-lesson-index-<baza\|default>-<vaqt>.json`; o'zgartiriladigan qator yoki yaratiladigan indeks bo'lsa — har ishga tushirish o'z zaxirasini yozadi, yiqilgani ham; o'zgarish yo'q qayta ishga tushirish zaxira yozmaydi) → ortiqcha qatorlarni soft-delete (`deletionReason: "duplicate_lesson:<qoladigan _id>"`; faqat olib tashlanadigan qator ham, qoladigani ham rejadagidek bo'lsa: jonli, o'sha dars kaliti, o'sha `session`/`active`/`status`; aks holda o'tkaziladi) → `createIndex` → `indexes()` tekshiruvi. Idempotent. `exit 1`: spetsifikatsiyasi boshqa indeks yoki shu kalitli boshqa nomli indeks bor; bir darsda 2+ sessiya qatori (hech narsa yozilmaydi); «yangi dublikat … yoki qator o'zgardi» (jonli yozuv — qayta ishga tushiring) |
| `--revert=<zaxira>` | indeksni tushiradi (shu ishga tushirish yaratgan bo'lsa) va faqat hali o'sha belgili qatorlarni asl holiga qaytaradi; keyin o'zgarganlari «Tegilmadi» ro'yxatida. Bir nechta zaxira bo'lsa — har biri uchun alohida, tartib ixtiyoriy. Boshqa bazaning zaxirasini rad etadi (`--allow-other-db`) |

Qaysi qator qoladi: sessiya qatori → faol (`active !== false`) → `excused` < `present` < `absent` → eng eski
`createdAt` → eng kichik `_id`. Migratsiya faqat qator olib tashlaydi — sababsiz soat hech qachon oshmaydi; sweep
chaqirilmaydi, saqlangan `totalUnexcusedHours` ni 5-qadam (`recount-45-unexcused-hours.js --apply`) yoki 08:00
tekshiruvi yangilaydi. Soati kamaygan rezident uchun mavjud mexanizmlar ishlaydi: ochiq `tizim` loyihasi yopiladi,
imzolangan buyruq bo'lsa bir martalik xabar yuboriladi, muzlatilgan PDF'da o'chirilgan dars qoladi (kerak bo'lsa
«Buyruq loyihasi PDF'i» bandidagi qayta chiqarish).

**Sababsiz soatlarni qayta hisoblash bilan bog'liqlik.** `recount-45-unexcused-hours.js` ning dry-run rejimi ham
(`deletedAt: null` filtri bilan), `--apply` rejimi ham soft-delete qilingan davomat qatorlarini hisobga olmaydi — shu
migratsiya olib tashlagan qatorlar ikkala rejimda ham sanalmaydi, ya'ni dry-run hisoboti `--apply` natijasi bilan bir
xil. Migratsiya hisobotida har ta'sirlangan rezident uchun kamayish va bitta son beriladi —
`−<soat> soat · migratsiyadan keyin joriy yil: <son>`; recount (dry-run ham, `--apply` ham) shu rezident uchun aynan shu
«joriy yil» ni ko'rsatadi.

**Tekshiruv** (mongosh):

```js
db.attendances.getIndexes().filter(i => i.name === "resident_lesson_unique")
// [{ key: { resident: 1, date: 1, science: 1, lessonType: 1 }, unique: true, partialFilterExpression: { deletedAt: null }, … }]
db.attendances.aggregate([{ $match: { deletedAt: null } },
  { $group: { _id: { r: "$resident", d: "$date", s: { $ifNull: ["$science", null] }, l: { $ifNull: ["$lessonType", null] } }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } }, { $count: "n" }])   // bo'sh natija = 0 dublikat
db.attendances.countDocuments({ deletionReason: /^duplicate_lesson:/ })   // = --apply dagi soft-delete soni
```

`pm2 logs institute-ais` da `[4.5 attendance] indeks qurilmadi` qatori bo'lmasin (qo'shimcha signal; dalil —
`getIndexes()`). Zaxira fayl(lar)ini baza zaxiralari bilan birga **saqlang** — olib tashlangan qatorlarning to'liq
nusxasi shu yerda.

**Rollback:** faqat kodni qaytarish xavfsiz — indeks qoladi (eski kod takroriy yozuvga `400 «Davomat qo'shishda xato»`
beradi, dublikat yozilmaydi). `--revert` ni FAQAT kodni qaytarish bilan birga va yangi kod hali diskda turganda
bajaring: yangi kod bilan qolsa keyingi ishga tushishda indeks dublikatlar tufayli qurilmaydi (faqat log) va cheklov
yo'qoladi. `--apply` bir necha marta ishga tushgan bo'lsa (yiqilgan + qayta) — har zaxira uchun `--revert`, tartib
ixtiyoriy (birinchisi indeksni tushiradi, har biri faqat o'z belgili qatorlarini tiklaydi); oxirida
`db.attendances.countDocuments({ deletionReason: /^duplicate_lesson:/, deletedAt: { $ne: null } })` = `0`.

#### SAMS monitori: kuzatuv, yetkazish belgisi va bo'limga xabarlar

SAMS ma'lumotlari oqimini kuzatadi: kelmay qolgan yoki yakunlanmagan kunlarni «eskirgan» (`stale`) deb belgilaydi
(watchdog), qaysi kungacha ma'lumot to'liq yetkazilganini hisoblaydi va teshiklar uchun `resendFrom` ni avtomatik
so'raydi, klinikalar qamrovi va rezidentlar uchun bazaviy chiziq yuritadi. Bo'lim uchun — «SAMS holati» sahifasi
(`/residency/sams-holati`, API `/api/residency-sams-status`) va ilova ichidagi SAMS xabarlari. Migratsiya, backfill,
seed, yangi npm paket va RBAC o'zgarishi **talab qilinmaydi**. Ikki yangi kolleksiya (`residencysamspackets` — paket
jurnali, `residencysamsalerts` — xabarlar daftari) boot'da (Mongoose indekslarni qurganda) paydo bo'ladi, ikkalasi ham
90 kunlik TTL bilan.

**Cron.** `src/index.js` → `startSamsMonitorCron()` — har 15 daqiqada, :07/:22/:37/:52 da (SAMS tiklari orasida). SAMS
yuboruvchisi o'chiq bo'lsa ham ishlaydi — tik arzon (paket yo'q = teshik yo'q, ogohlantirish yo'q). Tizim bitta pm2
jarayonida ishlaydi (§2): ustma-ust tik qo'riqlangan, ikki jarayon bo'lib qolsa ham kunlik yig'ma baribir bir marta
yuboriladi (unique kalit).

**Env (ixtiyoriy, §2 «Ixtiyoriy o'zgaruvchilar»):** `RESIDENCY_SAMS_TICK_MINUTES` (15, ruxsat 5..60; SAMS
yuboruvchisining tik oralig'i bilan bir xil bo'lsin), `RESIDENCY_SAMS_STALE_TICKS` (2, ruxsat 2..8 → 30 daqiqa),
`RESIDENCY_SAMS_CLOSE_GRACE_HOURS` (6, ruxsat 1..23 → kecha ertasi kuni 06:00 UZ gacha yakunlanishi kutiladi),
`RESIDENCY_SAMS_RESEND_MAX_DAYS` (30, ruxsat 7..30), `RESIDENCY_SAMS_DIGEST_HOUR` (10, ruxsat 0..23). Yaroqsiz qiymat —
standart qiymat va bitta `[4.5:SAMS] <KALIT>="<qiymat>" yaroqsiz (butun <min>..<max>) — standart <n> ishlatiladi`
ogohlantirishi.

**Restart'dan KEYIN:**
1. `pm2 logs institute-ais` — bootda bitta `[SamsMonitorCron] SAMS monitor cron job ro'yxatdan o'tdi (har 15 daqiqada,
   :07/:22/:37/:52)`; keyingi :07/:22/:37/:52 da `[4.5:SAMS] monitor stale=<klinika-kun>/<rezident qatori> tenants=<n>
   digest=<holat> liveness=<ok|stale|never> failed=<n> ms=<n>`. `digest` — `not_due` (10:00 gacha), `done`, `empty`,
   `sent`, `lost`, `no_recipients`; `failed` — oxirgi paketdagi o'qilmagan klinikalar soni. `[4.5:SAMS] monitor <qadam>
   yiqildi: <xato>` — o'sha qadam xatosi (qadamlar bir-birini to'xtatmaydi). Har tikda takrorlanadigan ogohlantirishlar:
   `[4.5:SAMS] SAMS paketlari to'xtadi: oxirgi qabul …` (oxirgi paket 30 daqiqadan eski, lekin ≤ 7 kun) va
   `[4.5:SAMS] oxirgi paketda o'qilmagan klinikalar: <n> (<dbname>,…)` — SAMS tomonidagi yuboruvchi holatidagi oxirgi
   xatoni tekshiring.
2. Indekslar — Mongoose avtomatik qurish xatosini JIM yutadi (logda ham chiqmaydi), dalil faqat `getIndexes()`:
   ```js
   db.residencysamspackets.getIndexes()   // receivedAt_1, expireAfterSeconds: 7776000
   db.residencysamsalerts.getIndexes()    // key_1 (unique), createdAt_1 (expireAfterSeconds: 7776000), kind_1_createdAt_-1
   db.residencysamspresences.getIndexes() // dbname_1_day_1 (ingest bandidagi indeks — monitor ham undan foydalanadi)
   ```
3. Bo'lim xodimi: `GET /api/residency-sams-status/overview` → `200`; `klinik_ustoz` → `403`.

**Watchdog loglari.** Kunlar eskirgan deb belgilanganda bitta ogohlantirish: `[4.5:SAMS] watchdog: stale orgDays=<n>
(bugun=<n>) presence=<n> kunlar=<dbname>:<kun>,…` (faqat klinika va kun — shaxsiy ma'lumot yo'q).
`[4.5:SAMS] watchdog: <dbname>:<kun> yangiroq paket yutdi — tegilmadi` (info) — parallel paket kelgan, xato emas.
Kechqurundan ertalab 06:00 gacha kechagi kun «ochiq» — bu kutilgan (kechalik reconcile 00:05–05:59 da); 06:00 dan keyin
yakuniy bo'lmasa — `stale` va avtomatik `resendFrom`.

**Qayta yuborish.** Roster `resendFrom` — qo'lda qo'yilgan va avtomatik qiymatning ertarog'i; avtomatik so'rov faqat
jonli klinikalar uchun (oxirgi 2 kunda paket kelgan VA oxirgi paketda tenant bloki yoki `failedTenants` da bor) va ko'pi
bilan 30 kun orqaga. Tushib qolgan yoki roster rezidenti qolmagan klinika teshiklari «SAMS holati» sahifasida ko'rinadi
(`live: false`), lekin so'ralmaydi — klinika qaytib kelsa, o'zi so'raladi.

**Xabarlar.** Faqat `magistratura_bolim`, faqat ilova ichida: `residency_sams_digest` («SAMS davomati — kunlik yig'ma»,
kuniga bir marta, faqat yangi elementlar bilan) va `residency_sams_tenants_changed` (klinikalar to'plami o'zgarganda,
darhol). Bo'lim xodimlari ro'yxati bo'sh bo'lsa — yuborilmaydi va keyingi tikda qayta uriniladi. Band qilingan, lekin
yuborilmagan yig'ma (`sent: false`, bo'sh delta bo'lmasa) — jarayon band qilish bilan yuborish orasida to'xtagan: o'sha
kun xabari yo'qolgan, asosiy ko'rinish — «SAMS holati» sahifasi:
```js
db.residencysamsalerts.find({ sent: false }).sort({ createdAt: -1 }).limit(5)
```

**Rollback:** kodni qaytarish yetarli. `residencysamspackets` / `residencysamsalerts` — `drop()` yoki TTL o'zi
tozalaydi. Watchdog `stale` qilgan qatorlar keyingi paketda tiklanadi yoki o'lchanmagan qoladi — xavfsiz tomon (hech
qachon «kelmadi» emas).

#### SAMS faktlari: sessiya yechimi, ball oynasi va server vaqtlari

Migratsiya, backfill, seed, env, indeks, npm paket va RBAC o'zgarishi **talab qilinmaydi**. Sxema o'zgarishlari
additiv: chetlatish buyrug'i tarixidagi manba (`history[].source`) qiymatlariga `sams`; uzilish oynasiga ichki
`resolutionPendingSince` (`null`) va `resolutionAttempts` (`0`) — maydoni yo'q eski oyna «kutilayotgan o'tish yo'q» deb
o'qiladi (`{$ne: null}` uni olmaydi), API javobida ko'rinmaydi. Kod §6 dagi oddiy yangilanish bilan keladi; SAMS
yuboruvchisini birinchi marta yoqishdan oldingi qadam — pastdagi «Kutilgan ma'lumot» dagi uzilish oynasi.

**Nima o'zgaradi.** Qabul qilingan SAMS qatorlari mashg'ulot sessiyalari yechimiga ulanadi: ingest paketi (oyna kunlari,
7 kunlik oyna) va uzilish oynasini yaratish/bekor qilish (joriy o'quv yili, majburiy) fonda sessiya yechimini
rejalashtiradi — jarayon ichida, bir vaqtda bitta navbat, navbatdagi so'rovlar birlashadi, cron yo'q. Ingest uchun holat
saqlanmaydi: 7 kunlik oyna ichidagi yo'qolgan o'tishni keyingi paket tuzatadi. Uzilish oynasining o'tishi esa bazadagi
belgi (token) bilan saqlanadi: xatosiz tugamasa (baza yoki sessiya xatosi, yiqilgan qayta hisob yoki jarayon to'xtadi)
SAMS monitori tiki (:07/:22/:37/:52, restart'dan keyin ham) uni qayta rejalashtiradi, 5 urinishgacha; qayta urinish
xatosiz tugagach oyna kunlarida sessiya qatori bor har rezident qayta hisoblanadi va belgi shundan keyin tozalanadi.
`POST`/`PUT /api/attendance` da `checkInTime`/`checkOutTime` jimgina tashlanadi (vaqtlarni faqat server yozadi; eski
frontend xato olmaydi). Ordinaturada qo'lda yozilgan qatorga ball qo'yish sharti — kelgan–ketgan oralig'i klinik ish kuni
bilan **kesishadi** (avval butunlay ish kuni ichida bo'lishi kerak edi).

**Loglar.** Har ingest paketi va har uzilish oynasini yaratish/bekor qilishga bitta:
`[4.5 samsPresenceSync] yechim: runs=<n> days=<n> sessions=<n> changed=<n> recounted=<n> errors=<n>`
- `runs` — yechim o'tishlari (majburiy va oddiy alohida), `days` — yechilgan kunlar, `sessions` — yechilgan sessiyalar,
  `changed` — **yozilgan yoki yashirilgan davomat qatorlari** (freym o'tishlari sanalmaydi), `recounted` — 6/72 soat
  hisobidan xatosiz o'tgan rezidentlar, `errors` — yiqilgan freym/sessiya/o'tish VA qayta hisobi yiqilgan rezidentlar
  (har biriga `[4.5 sessionResolution] qayta hisob yiqildi resident=<id>: <xato>`).
- Tartib kafolatlanmaydi: navbat ingest ichida boshlanadi va paket jurnali, `resendFrom` tozalash va yetkazish belgisidan
  OLDIN tugashi mumkin — `yechim:` qatori o'z `[residency-sams] ingest window=…` qatoridan oldin ham, keyin ham chiqadi.
  Paketlar tez kelsa navbat birlashadi: bitta `yechim:` qatori ikki ingest uchun (`runs` > 1 yoki `days` yig'indisi).
- SAMS yuboruvchisi yoqilmaguncha `yechim:` qatori faqat bo'lim uzilish oynasini yaratsa/bekor qilsa chiqadi va
  `changed=0 recounted=0` — sessiya qatori yo'q (freymlar baribir `pending` → `unmeasured`, ular sanalmaydi).

Xatolar (hech biri ingest/uzilish javobini yiqitmaydi):
- `[4.5 samsPresenceSync] yechim o'tishi yiqildi force=<true|false> days=<birinchi>..<oxirgi> (<n>): <xato>` — butun
  o'tish (masalan, baza); shu navbatning yakun qatori `yechim: runs=<k> … errors=<≥1>` (yolg'iz o'tish bo'lsa `runs=0
  days=0 … errors=1`). `force=false` — keyingi paket (7 kun ichida) tuzatadi; `force=true` — uzilish belgisi qoladi,
  quyidagi qator;
- `[4.5 samsOutage] qayta yechim tugallanmadi outage=<id> days=<birinchi>..<oxirgi> (<n>) urinish=<k>/5 — monitor tiki
  qayta urinadi` — keyingi monitor tikida `warn` `[4.5 samsOutage] qayta yechim qayta rejalashtirildi: outages=<n>`, yangi
  `yechim:` qatori va (qayta urinish xatosiz bo'lsa) `info` `[4.5 samsOutage] qayta urinish qayta hisobi outage=<id>
  days=<birinchi>..<oxirgi> (<n>) residents=<n> failed=0` — shundan keyin belgi tozalanadi. `failed` > 0 — har rezidentga
  `[4.5 samsOutage] qayta hisob yiqildi outage=<id> resident=<id>: <xato>`, rezidentlar ro'yxati o'qilmasa —
  `[4.5 samsOutage] qayta urinish qayta hisobi yiqildi outage=<id>: <xato>`; ikkalasida ham belgi qoladi va yana
  `tugallanmadi` qatori chiqadi. `… urinish=5/5 — qayta urinilmaydi` — avtomatik tiklash tugadi (quyidagi «Qo'lda
  tiklash»);
- `[4.5:SAMS] monitor outages yiqildi: <xato>` — monitor tikining shu qadami (keyingi tikda qayta);
  `[4.5 samsPresenceSync] onDone yiqildi: <xato>` — belgi tozalanmadi (keyingi tik qayta uradi, urinish sarflanadi);
  `[4.5 samsPresenceSync] drenaj yiqildi: <xato>` — kutilmagan, navbat keyingi so'rovda davom etadi;
- `[residency-sams] sessiya yechimi rejalashtirilmadi: <xato>`, `[4.5 samsPresenceSync] rejalashtirilmadi: <xato>` va
  `[4.5 samsOutage] qayta yechim rejalashtirilmadi outage=<id>: <xato>` — rejalashtirish amalga oshmadi (javob baribir
  muvaffaqiyatli; uzilish belgisi qoladi — tik qayta uradi);
- freym / sessiya darajasidagi xatolar — `[4.5 sessionResolution] …` qatorlari («Sessiya bahosi, yechimi va davomatga
  proyeksiyasi» bandiga qarang); ular `yechim:` qatorining `errors` ida sanaladi.

Kutilayotgan uzilish o'tishlari (yaratish/bekor qilishdan bir necha daqiqa o'tib bo'sh bo'lishi kerak):

```js
db.residencysamsoutages.find({ resolutionPendingSince: { $ne: null } }, { from: 1, to: 1, dbname: 1, resolutionPendingSince: 1, resolutionAttempts: 1 })
```

**Qo'lda tiklash** (5 urinish tugagan — `urinish=5/5`): avval sababni `[4.5 sessionResolution] …` / `yechim o'tishi
yiqildi` qatorlaridan toping va tuzating; keyin urinishlar sonini nolga qaytaring — keyingi monitor tiki (≤ 15 daqiqa)
o'tishni qayta rejalashtiradi:

```js
db.residencysamsoutages.updateOne({ _id: ObjectId("<id>"), resolutionPendingSince: { $ne: null } }, { $set: { resolutionAttempts: 0 } })
```

**Kutilgan ma'lumot.**
- Kun faqat YOPILGANDA `absent` bo'ladi — kun tugagach yuborilgan paket bilan; bugungi tik faqat `present` ni beradi yoki
  kutadi (`pending`). Odatda bu kechalik reconcile (SAMS tomonida 01:30 dan keyingi birinchi tik).
- ⚠️ **SAMS yuboruvchisi birinchi marta yoqilganda** (uzilish oynasisiz) birinchi reconcile `bugun-6..bugun-1` ni DARHOL
  yopadi: sessiyalar e'lon qilina boshlagandan beri skansiz rezidentlar o'sha zahoti `absent` bo'ladi — `changed` > 0,
  `recounted` > 0, 6 soat ogohlantirishlari (umumiy Telegram guruhiga ham) va 72 soat loyihalari shu paytda chiqadi.
  7 kundan eski sessiyalar `pending` da qoladi (muzlatilgan, baholanmaydi). Bunga yo'l qo'ymaslik uchun: yoqish bilan
  BIR UZ kunida, yoqishdan oldin bo'lim `[max(sessiyalar e'lon qilina boshlagan kun, bugun-6) .. bugun]` uzilish
  oynasini e'lon qiladi (o'sha kunlar «o'lchanmagan» bo'ladi; `to` = bugun ruxsat etilgan). Sessiyalar e'lon qilina
  boshlagan kun — mashg'ulot sessiyalari bor versiya o'rnatilgan kun. `..bugun-1` EMAS: oyna yoqishdan oldingi kuni e'lon
  qilinsa o'sha kun ochiq qolardi. Haqiqiy skan baribir `present`; yoqish kunining skansiz rezidentlari ham `absent`
  bo'lmaydi. Yoqish keyingi kunga surilsa — surilgan kun(lar) uchun qo'shimcha oyna. Yoqilgandan keyin (birinchi
  tiklardan so'ng, ≤ 30 daqiqa) o'tgan kunlardagi `absent` sessiya qatorlari `0` bo'lishi SHART; `> 0` — oyna qo'llanmagan
  yoki qamrovi noto'g'ri: TO'XTANG va oyna sanalarini tekshiring:

  ```js
  db.attendances.countDocuments({ session: { $type: "objectId" }, deletedAt: null, status: "absent", date: { $lt: ISODate("<bugun YYYY-MM-DD>T00:00:00Z") } })
  ```
- Qayta yuborish / teshik to'ldirish paketi 7 kundan eski kunni yechmaydi: o'sha kunlar sessiyasi `pending` qoladi —
  o'sha kunga istalgan uzilish oynasi (istalgan klinika uchun) yaratilmaguncha yoki bekor qilinmaguncha (ataylab;
  soxta `absent` chorasi pastda).
- Uzilish oynasi (bitta klinika uchun `dbname` bilan ham) yaratilganda va bekor qilinganda o'sha kunlarning BARCHA
  sessiyalari majburiy qayta yechiladi: oyna faqat o'z klinikasiga qo'llanadi, boshqa klinikalar rezidentlari joriy
  yakuniy fakt bilan — 7 kundan eski muzlagan `pending` freymlar ham `absent`/`present` bo'lishi mumkin (6/72 soat
  oqibatlari bilan). Bo'lim katta oynani server vaqti bilan 07:30–09:00 dan tashqarida yaratsin/bekor qilsin.
- Chetlatish buyrug'i tarixidagi yangi yozuvlar `source: "sams"` (tungi 72 soat loyihasi — `cron`, pastda). Qo'lda
  yozilgan eski `checkInTime`/`checkOutTime` o'zgarmaydi.
- **Tungi ushlash.** 22:00–08:00 UZ da SAMS yechimi 6 soat ostonasini kesgan rezidentga ogohlantirish YUBORILMAYDI —
  `info`: `[4.5 expulsionCheck] 6 soat ogohlantirishi 08:00 sweep'gacha ushlab turildi resident=<id> soat=<n>`; uni 08:00
  tekshiruvi (sweep) chiqaradi (server vaqti bilan; UTC serverda ≈ 13:00 UZ). Sweep o'tkazib yuborilsa — keyingi
  sweep'gacha (≤ 24 soat); `recount --apply` oxirgi chora (guruh Telegram xabari ketmaydi). 72 soat ostonasi ham xuddi
  shunday: loyiha hujjati OCHILMAYDI, bo'limga va rezidentga xabar yo'q — `info`: `[4.5 expulsionCheck] 72 soat loyihasi
  08:00 sweep'gacha ushlab turildi resident=<id> soat=<n>`; loyihani sweep ochadi (buyruq tarixida manba `cron`), agar
  loyiha ochish tekshiruvi uni rad etmasa (masalan, rad etish belgi chizig'i yoki rezident holati mos kelmasa).
  `recount --apply` ushlangan loyihalarni ham ochadi, lekin bo'lim xodimlariga shaxsiy Telegram xabari ketmaydi (faqat
  ilova ichida) — bo'limga qo'lda xabar bering. Log qatori «bu kecha ochilmadi» degani — «08:00 da albatta ochiladi»
  emas. SAMS yuboruvchisi tunda yoqilsa, birinchi reconcile ogohlantirishlari va 72 soat loyihalari 08:00 da chiqadi.

**Soxta `absent` (7 kundan eski kun, skan keyin paydo bo'ldi).** Skan SAMS'da tuzatilgan, lekin SANFAK kunni qayta
yechmagan (o'tish yo'qoldi yoki tuzatish kundan 6 kun o'tgach qayta yuborish bilan keldi) — qator `absent` qoladi va soati
6/72 hisobida. Chora (kod o'zgarishisiz):
1. **Birinchi tanlov — Jurnal → «Sababli qilish» tugmasi** (bo'lim xodimi; API: `PUT /api/attendance/<id>/approve-excuse`,
   sessiyaning `absent` qatori uchun ham ruxsat bor; huquq — pastdagi «Bo'limning «Sababli qilish» huquqi»). Faqat shu
   qator o'zgaradi, boshqa rezidentlarga ta'sir yo'q; qator `excused` bo'ladi (`present` emas — ustoz baholay olmaydi),
   qaytarib bo'lmaydi.
2. **Uzilish yo'li — faqat rezident baholanishi (`present`) shart bo'lsa.** Skan SANFAK'ka yetmagan bo'lsa avval o'sha
   kundan qayta yuborish so'rovi («SAMS davomat ma'lumotlarini qabul qilish» → «Qayta yuborish so'rovi»); keyin o'sha
   BITTA kunga, `dbname` = rezidentning klinikasi bilan oyna yaratiladi va `yechim:` qatoridan keyin bekor qilinadi (bekor
   qilish o'tishi joriy SAMS qatorini o'qib `present` beradi); server vaqti bilan 07:30–09:00 dan tashqarida.
   ⚠️ Yon ta'sir — bo'limga oldindan ayting: ikkala majburiy o'tish o'sha kunning BARCHA sessiyalaridagi har rezidentni
   qayta yechadi. Oyna klinikasida haqiqatan kelmagan rezidentlarning 6 soat ogohlantirishi bekor qilinib, bekor qilishda
   QAYTA yuboriladi (Telegram — rezidentga va umumiy guruhga), 72 soat loyihasi bekor qilinib YANGISI ochiladi (bo'limga
   yangi xabar); boshqa klinikalarning muzlagan `pending` freymlari yakuniy fakt bilan yechiladi (yuqoridagi «Kutilgan
   ma'lumot»).

**Qayta hisob kechikishi.** Qayta hisob o'tish OXIRIDA bir marta bajariladi.
- Ingest o'tishi qatorlarni yozib, qayta hisobdan oldin to'xtasa (pm2 reload/crash) yoki xato bilan tugasa (`yechim
  o'tishi yiqildi force=false …` yoki `yechim: … errors=<≥1>`), keyingi o'tish qatorni o'zgarmagan ko'radi — saqlangan
  soat, 6 soat ogohlantirishi va 72 soat loyihasi 08:00 sweep'da tuzaladi (≤ 24 soat). Shoshilinch bo'lsa —
  `node scripts/recount-45-unexcused-hours.js --apply` (server vaqti bilan 07:30–09:00 da emas; u muddati kelgan
  eslatmalarni ham yuboradi).
- Uzilish o'tishi (`force=true`) — belgi qoladi, monitor tiki qayta urinadi va qayta urinish oyna kunlaridagi sessiya
  qatori bor har rezidentni qayta hisoblaydi: `qayta urinish qayta hisobi … failed=0` qatoridan keyin saqlangan soat
  to'g'ri. Kutilayotgan o'tishlar so'rovi (yuqorida) bo'sh bo'lsa — uzilish yo'li tuzalgan.
- Katta uzilish oynasi yaratilgan/bekor qilingan bo'lsa, reload'ni `yechim:` qatori chiqqunicha kuting (aks holda tik
  butun o'tishni qayta bajaradi).

**Rollback:** faqat kod. Sessiya qatorlari va 6/72 soat oqibatlari — «Sessiya bahosi, yechimi va davomatga
proyeksiyasi» bandidagi rollback (ixtiyoriy soft-delete + `recount-45-unexcused-hours.js --apply`). Chetlatish buyrug'i
tarixidagi `source: "sams"` yozuvlari bazada qoladi — ularni o'chirmang (tarix dalili). Uzilish oynasidagi belgi
maydonlari oldingi versiyada o'qilmaydi (inert). Qaytarilgan kodda `/api/attendance` yana `checkInTime`/`checkOutTime`
ni qabul qiladi.

#### Bo'limning «Sababli qilish» huquqi

Jurnal «Kunlik dars» va rezidentning «darslar tarixi» sahifasida bo'lim xodimi bitta «Kelmadi» darsini sababli qiladi
(«Sababli qilish» tugmasi; API — `PUT /api/attendance/<id>/approve-excuse`, endpoint o'zgarmagan). Backend tomonda faqat
seed: `magistratura_bolim` roliga `residentAttendance:approve` (`seed:residency-roles`) va ruxsat katalogiga shu kalit
(`seed:permissions` va `seed:permissions:residency`) — hammasi `yarn setup:seed` tarkibida (§3). Migratsiya va env kerak emas — ruxsat
har so'rovda bazadan o'qiladi. Tugma frontendning (`sanfak-frontend`) shu versiyasida.

1. **`yarn setup:seed --dry` dan OLDIN — faqat o'qish (mongosh):**

   ```js
   db.roles.find({ title: { $in: ["magistratura_bolim", "klinik_ustoz"] } }, { title: 1, permissions: { $elemMatch: { section: "residentAttendance" } } })
   db.permissions.findOne({ section: "residentAttendance" }, { _id: 0, title: 1, active: 1, actionKeys: 1, groups: 1 })
   ```

   `klinik_ustoz` da `approve` bo'lmasin. Bor bo'lsa — avval `node seed/trim-overbroad-grants.seed.js` (sukut bo'yicha
   dry-run, hech narsa yozmaydi; hisobotda boshqa rollardan olinadigan ortiqcha amallar ham ko'rsatiladi — ko'rib
   chiqing), so'ng `node seed/trim-overbroad-grants.seed.js --write`. Chiqishni saqlab qo'ying (masalan, faylga):
   `magistratura_bolim` da `approve` shu versiyadan OLDIN bor-yo'qligi — rollback shunga qaraydi. Katalog qatoridagi
   `actionKeys` da standart 7 kalit (`create`, `read`, `readAll`, `update`, `delete`, `search`, `filter`) va `approve`
   dan boshqa kalit bo'lsa — `seed:permissions` va `seed:permissions:residency` uni jimgina olib tashlaydi (ikkalasi
   `actionKeys` ni aynan shu 8 taga qayta yozadi; `seed:permissions` da ko'rish rejimi yo'q — `yarn setup:seed --dry`
   uni o'tkazib yuboradi, `seed:permissions:residency` ning `--dry` qatori esa bir xil chiqadi); bunday kalit qo'lda qo'shilgan bo'lsa — `yarn setup:seed`
   dan oldin hal qiling.
2. **`yarn setup:seed --dry`** (to'liq chiqish — `scripts/backups/setup-seed-dry-…log` yoki `--verbose`): katalog
   qadamida `~ residentAttendance … [UPDATE] 8 action` (katalogda `approve` hali yo'q bo'lsa), `seed:residency-roles`
   qadamida `[magistratura_bolim] … residentAttendance+[approve]` (grant allaqachon bor bo'lsa — bu qism chiqmaydi).
   Keyin §6 dagi `yarn setup:seed`.
3. Yakuniy drift tekshiruvida (`yarn setup:seed` ichida yoki `node scripts/check-permission-drift.js`)
   `residentAttendance:approve` qatori bo'lmasin; 1-qadamdagi so'rov endi bo'limda `approve` ni, `klinik_ustoz` da esa
   uning yo'qligini ko'rsatadi.
4. Frontend — §6, 2-qadam; foydalanuvchilar sahifani yangilaydi (F5) — tugma profil (`/auth/profile`) yangi huquqni
   olib kelgach chiqadi.

**Kutilgan ma'lumot:** sababli qilingan qatorda `excused`, `excuseReason`, `excuseApprovedBy`; sababsiz soat darhol
qayta sanaladi (6 / 72 dan pastga tushsa ogohlantirish / loyiha bekor qilinadi). Bu qayta hisob tunda ushlanmaydi:
22:00–08:00 da sababli qilingandan keyin ham soat ≥ 6 / ≥ 72 qolsa, tunda ushlangan ogohlantirish / loyiha shu zahoti
chiqadi (umumiy guruh Telegrami bilan) — bo'limga ayting. Allaqachon yaratilgan 6 soatlik avtomatik davomat bildirgisi
shu amal bilan darhol qaytarilmaydi (soat 6 dan tushgan bo'lsa keyingi 08:00 tekshiruvi uni `bekor_qilingan` qiladi;
aks holda bo'lim uni qo'lda yopadi). Bekor qilish (undo) yo'q — xato bo'lsa faqat mongosh orqali, mas'ul shaxs qarori
bilan.

⚠️ Rol tahrirlagichi: «Rezident davomati» bo'limida `klinik_ustoz` uchun «hammasini tanlash» bosilmasin — katalog
yangilangach u `approve` ni ham beradi (frontend tugmasi faqat bo'lim xodimiga ko'rinadi, lekin API ruxsati ochilib
qoladi).

**Rollback:** oldingi frontend build — tugma yo'qoladi; odatda shu yetarli. Grantni olish
(`db.roles.updateOne({title: "magistratura_bolim", "permissions.section": "residentAttendance"},
{$pull: {"permissions.$.actionKeys": "approve"}})`) FAQAT 1-qadam yozuvi bo'limda `approve` shu versiyadan OLDIN
YO'Qligini ko'rsatgan bo'lsa. Aks holda grant avval ham bor edi — olinsa `approve-excuse` hammaga `403` qaytaradi
(soxta `absent` ning birinchi chorasi ham yopiladi). Katalogdagi kalit qoladi — zararsiz.

---

## 7. Deploy'dan keyin tekshirish

```bash
pm2 status                                   # institute-ais → online
pm2 logs institute-ais --lines 50            # xato yo'qmi

curl -I https://<domain>/                    # 200 + Content-Type: text/html
curl -sI https://<domain>/some/deep/route    # 200 (SPA fallback ishlayapti)
curl -I https://<domain>/api-docs            # 404 bo'lishi KERAK

# Frontend build haqiqatan yangimi va API yo'li NISBIY mi:
ls -la /srv/fjsti/backend/public/build/index.html
grep -o 'localhost:4000' -r /srv/fjsti/backend/public/build/assets/ | head
#   ⬆️ hech narsa chiqmasligi kerak. Chiqsa — build noto'g'ri API manzili bilan
#      yig'ilgan: `.env.production` ni tekshirib, qayta build qiling.
```

Brauzerda: login → menyu rollarga mos ko'rinadi → bitta ro'yxat sahifasi ma'lumot bilan ochiladi → DevTools Network'da
401/403 to'lqini yo'q.
