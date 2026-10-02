# DEPLOY — frontend

Frontend alohida serverda ishlamaydi: `yarn build` natijasi backend'ning
`public/build/` papkasiga ko'chiriladi va backend uni API bilan bir xil
origin'dan o'zi uzatadi.

To'liq qo'llanma (server talablari, backend, `.env`, RBAC seed'lar, nginx,
yangilash, tekshiruvlar) — **sanfak-backend** arxividagi `docs/DEPLOY.md`.
Bu fayl faqat frontend qadamlarini qisqacha takrorlaydi.

---

## 1. Talablar

| Komponent | Versiya |
|---|---|
| Node.js | **20.19 yoki yangiroq** (`.nvmrc`: 20; `yarn.lock` dagi `vite@7` `^20.19.0 \|\| >=22.12.0` talab qiladi — eski 20.x da `yarn install` «engine is incompatible» bilan to'xtaydi) |
| yarn | 1.x (`yarn.lock` bilan) |

---

## 2. `VITE_API_URL` — nisbiy bo'lishi SHART

Vite env qiymatlarini **build paytida** bundle ichiga yozadi. Production build
`.env.production` faylidagi qiymatni oladi:

```
VITE_API_URL=/api
```

Frontend va API bir xil origin'dan uzatilgani uchun nisbiy `/api` — CORS kerak
emas, `withCredentials` tabiiy ishlaydi, domen o'zgarsa qayta build shart emas.
`.env.production` ni o'zgartirmang: agar build lokal manzil
(`http://localhost:4000/api`) bilan yig'ilsa, ilova foydalanuvchi brauzerida
umuman ishlamaydi, build esa hech qanday ogohlantirishsiz muvaffaqiyatli tugaydi.

Ixtiyoriy kalitlar — serverda ularni **`.env.production.local`** fayliga yozing (build'dan OLDIN; backend `DEPLOY.md`
§6 dagi yangilash uni saqlaydi). `.env.example` ni `.env` ga nusxalamang — u faqat lokal ishlab chiqish uchun
(`VITE_APP_NAME=Platform`, `VITE_API_URL=http://localhost:4000/api`); shunday build'da ilova nomi institut nomi
o'rniga «Platform» bo'lib chiqadi. «Default» — kalit berilmaganda koddagi qiymat:

| Kalit | Default | Vazifasi |
|---|---|---|
| `VITE_APP_NAME` | institut nomi | ilova sarlavhasi |
| `VITE_PRIMARY_COLOR` | `#34C18C` | asosiy rang |
| `VITE_THEME_MODE` | `light` | `light` yoki `dark` |
| `VITE_API_URL` | `http://localhost:4000/api` | faqat lokal ishlab chiqish uchun; production'da `.env.production` dagi `/api` ishlatiladi |

---

## 3. Build va backend ichiga joylash

```bash
unzip -q sanfak-frontend.zip -d /srv/fjsti/          # arxiv ichida: sanfak-frontend/ (pm2 foydalanuvchisi nomidan)
mv /srv/fjsti/sanfak-frontend /srv/fjsti/frontend    # birinchi o'rnatishda; yangilash — backend DEPLOY.md §6
cd /srv/fjsti/frontend
yarn install --frozen-lockfile
yarn build                        # → dist/  (tsc + vite build)

rm -rf /srv/fjsti/backend/public/build
mkdir -p /srv/fjsti/backend/public/build
cp -r dist/. /srv/fjsti/backend/public/build/
```

Backend'ni qayta ishga tushirish **shart emas**: `express.static` fayllarni har
so'rovda diskdan o'qiydi. Vite asset nomlariga hash qo'yadi, shuning uchun
brauzer yangi `index.html` orqali yangi fayllarni oladi.

---

## 4. Tekshirish

```bash
ls -la /srv/fjsti/backend/public/build/index.html
grep -o 'localhost:4000' -r /srv/fjsti/backend/public/build/assets/ | head
#   ⬆️ hech narsa chiqmasligi kerak. Chiqsa — build noto'g'ri API manzili bilan
#      yig'ilgan: `.env.production` ni tekshirib, qayta build qiling.
```

Brauzerda: login → menyu rolga mos ko'rinadi → ro'yxat sahifasi ma'lumot bilan
ochiladi → DevTools Network'da 401/403 to'lqini yo'q.

---

## 5. Lokal ishlab chiqish (faqat dasturchi kompyuterida — serverda EMAS)

```bash
cp .env.example .env
yarn install
yarn dev                          # http://localhost:5173 — backend http://localhost:4000 da ishlab turishi kerak
```

| Buyruq | Vazifasi |
|---|---|
| `yarn dev` | Vite dev server |
| `yarn build` | Production build (tsc + vite) |
| `yarn typecheck` | TypeScript tekshiruvi |
| `yarn lint` | ESLint |
| `yarn test` | Vitest |
| `yarn test:e2e` | Playwright |
