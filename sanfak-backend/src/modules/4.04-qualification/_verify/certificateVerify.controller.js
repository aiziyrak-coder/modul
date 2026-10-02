"use strict";

const fs = require("fs");
const path = require("path");
const winston = require("#shared/winston.logger");
const { verifyCertificateByCode } = require("./certificateVerify.service");

const INSTITUTE = "Farg'ona jamoat salomatligi tibbiyot instituti";

const LOGO_URI = (() => {
  try {
    const p = path.join(__dirname, "../_pdf/assets/logo.png");
    return `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
  } catch (err) {
    winston.warn(`[qualCertificateVerify] logotip o'qilmadi: ${err.message}`);
    return "";
  }
})();

const FONT_URI = (() => {
  try {
    const p = path.join(__dirname, "assets/inter-latin.woff2");
    return `data:font/woff2;base64,${fs.readFileSync(p).toString("base64")}`;
  } catch (err) {
    winston.warn(`[qualCertificateVerify] shrift o'qilmadi: ${err.message}`);
    return "";
  }
})();

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${dt.getFullYear()}`;
}

function fmtPeriod(from, to) {
  const a = fmtDate(from);
  const b = fmtDate(to);
  if (a && b) return `${a} — ${b}`;
  return a || b || "";
}

function fmtForm(form) {
  if (form === 1) return "Onlayn";
  if (form === 2) return "Oflayn";
  return "";
}

function fmtHours(h) {
  return h ? `${h} soat` : "";
}

const FONT_FACE = FONT_URI
  ? `@font-face{font-family:'Inter';font-style:normal;font-weight:400 700;
     font-display:swap;src:url(${FONT_URI}) format('woff2')}`
  : "";

const STYLE = `
${FONT_FACE}
*,*::before,*::after{box-sizing:border-box}
:root{
  --brand:#34C18C; --brand-hover:#2DAB7B; --brand-active:#259468;
  --brand-wash:rgba(52,193,140,.10);
  --ink:#121926; --ink-2:#697586; --ink-3:#98A2B3;
  --line:#E3E8EF; --line-2:#EEF2F6; --head:#EEF2F6; --row:#F9FAFB;
  --card:#FFFFFF; --bg:#F5F7FB; --sider:#E8ECF3;
  --bad:#F04438; --bad-wash:rgba(240,68,56,.10);
  --shadow:0 1px 2px 0 rgba(0,0,0,.05);
  --shadow-lg:0 1px 2px 0 rgba(0,0,0,.05),0 10px 28px -12px rgba(47,66,108,.28);
  --r:8px; --r-lg:12px;
}
@media (prefers-color-scheme:dark){
  :root{
    --brand:#3FD79C; --brand-hover:#34C18C; --brand-active:#2DAB7B;
    --brand-wash:rgba(63,215,156,.13);
    --ink:#E7ECF3; --ink-2:#9AA7B8; --ink-3:#6B7A8C;
    --line:#26303D; --line-2:#1E2732; --head:#1A222C; --row:#161D26;
    --card:#141B23; --bg:#0D1218; --sider:#111820;
    --bad:#FF6B60; --bad-wash:rgba(255,107,96,.13);
    --shadow:0 1px 2px 0 rgba(0,0,0,.4);
    --shadow-lg:0 1px 2px 0 rgba(0,0,0,.4),0 16px 36px -14px rgba(0,0,0,.7);
  }
}
html,body{margin:0;padding:0}
body{
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  font-feature-settings:'tnum' 1,'calt' 1;
  font-variant-numeric:tabular-nums;
  color:var(--ink); background:var(--bg);
  font-size:15px; line-height:1.5;
  min-height:100vh; padding:24px 16px 36px;
  display:flex; align-items:flex-start; justify-content:center;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}
.wrap{width:100%; max-width:540px}

.org{display:flex; align-items:center; gap:12px; padding:10px 14px; margin:0 0 14px;
  background:var(--card); border:1px solid var(--line); border-radius:var(--r-lg);
  box-shadow:var(--shadow)}
.org img{flex:0 0 auto; width:38px; height:38px; object-fit:contain; display:block}
.org-txt{min-width:0}
.org-name{font-size:13px; font-weight:600; line-height:1.38; letter-spacing:-.008em; color:var(--ink);
  text-wrap:balance}
.org-sub{font-size:10.5px; font-weight:500; color:var(--ink-3); margin-top:2px;
  letter-spacing:.07em; text-transform:uppercase}

.card{background:var(--card); border:1px solid var(--line); border-radius:var(--r-lg);
  box-shadow:var(--shadow-lg); overflow:hidden}
.accent{height:3px; background:linear-gradient(90deg,var(--brand),var(--brand-active))}
.accent.no{background:linear-gradient(90deg,var(--bad),#B42318)}

.hero{padding:26px 24px 22px; text-align:center; border-bottom:1px solid var(--line-2)}

.seal{position:relative; width:74px; height:74px; margin:0 auto 16px}
.seal svg{position:absolute; inset:0; width:100%; height:100%}
.seal .ring{transform-origin:50% 50%; animation:spin 30s linear infinite}
.seal .pop{animation:pop .45s cubic-bezier(.2,1.15,.35,1) both}
.seal .tick{stroke-dasharray:34; stroke-dashoffset:34; animation:draw .45s .25s ease-out forwards}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pop{from{transform:scale(.7);opacity:0} to{transform:scale(1);opacity:1}}
@keyframes draw{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){
  .seal .ring,.seal .pop{animation:none}
  .seal .tick{animation:none; stroke-dashoffset:0}
}

.pill{display:inline-flex; align-items:center; gap:7px; padding:6px 14px 6px 10px;
  border-radius:999px; font-size:13px; font-weight:600; letter-spacing:-.006em;
  background:var(--bad-wash); color:var(--bad)}
.pill .dot{width:6px; height:6px; border-radius:50%; background:currentColor}
.kicker{margin:0; font-size:10.5px; font-weight:500; letter-spacing:.13em;
  text-transform:uppercase; color:var(--ink-3)}
.pill + .kicker{margin-top:14px}
.doc-title{margin:5px 0 0; font-size:21px; font-weight:600; letter-spacing:-.022em; line-height:1.25;
  text-wrap:balance}

.holder{padding:22px 24px 18px; text-align:center}
.holder .lead{font-size:13px; color:var(--ink-2); margin:0 0 8px}
.holder .name{font-size:25px; font-weight:650; letter-spacing:-.03em; line-height:1.22; margin:0;
  overflow-wrap:anywhere; text-wrap:balance}
.holder .after{font-size:12.5px; color:var(--ink-2); margin:11px auto 0; line-height:1.6;
  max-width:46ch; text-wrap:pretty}

.course{margin:0 20px 20px; border:1px solid var(--line); border-radius:var(--r); overflow:hidden}
.course-head{padding:12px 16px; background:var(--head); border-bottom:1px solid var(--line)}
.course-eyebrow{font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3);
  font-weight:600; margin-bottom:4px}
.course-name{font-size:16px; font-weight:600; letter-spacing:-.018em; line-height:1.35;
  overflow-wrap:anywhere; text-wrap:balance}
.course-body{padding:16px}
.grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px 16px}
.grid .full{grid-column:1/-1}
.f-label{display:flex; align-items:center; gap:6px; font-size:10px; letter-spacing:.09em;
  text-transform:uppercase; color:var(--ink-3); font-weight:600}
.f-value{font-size:14.5px; font-weight:550; letter-spacing:-.012em; line-height:1.4;
  margin-top:4px; overflow-wrap:anywhere}
.f-value.mono{font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
  font-weight:600; font-size:14px; letter-spacing:.1em; color:var(--brand-active)}
.rule{height:1px; background:var(--line-2); margin:15px 0}

.foot{padding:14px 24px 20px; background:var(--row); border-top:1px solid var(--line-2);
  display:flex; align-items:center; gap:10px; justify-content:center; text-align:center}
.foot svg{flex:0 0 auto; color:var(--ink-3)}
.foot p{margin:0; font-size:11.5px; color:var(--ink-3); line-height:1.6; letter-spacing:-.002em}
.notfound{padding:2px 24px 24px; text-align:center}
.notfound p{margin:0 auto 15px; font-size:13.5px; color:var(--ink-2); line-height:1.6;
  max-width:38ch; text-wrap:pretty}
.code-chip{display:inline-block; padding:8px 14px; border-radius:var(--r); border:1px solid var(--line);
  background:var(--row); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:14px; letter-spacing:.11em}
.hint{margin:16px auto 0; max-width:44ch; text-align:center; font-size:11px;
  color:var(--ink-3); line-height:1.65}

@media (max-width:400px){
  .holder .name{font-size:21px}
  .hero{padding:22px 18px 18px}
  .holder{padding-left:18px; padding-right:18px}
  .foot{padding-left:18px; padding-right:18px}
  .course{margin-left:14px; margin-right:14px}
}
@media (max-width:340px){ .grid{grid-template-columns:1fr} }
@media print{
  body{background:#fff; padding:0}
  .card{box-shadow:none}
  .seal .ring{animation:none}
}
`;

const SEAL_OK = `<svg viewBox="0 0 74 74" fill="none" aria-hidden="true">
  <circle class="ring" cx="37" cy="37" r="34" stroke="var(--brand)" stroke-width="1.3"
    stroke-dasharray="4 6" opacity=".5"/>
  <g class="pop">
    <circle cx="37" cy="37" r="27" fill="var(--brand-wash)"/>
    <circle cx="37" cy="37" r="27" stroke="var(--brand)" stroke-width="1.5" opacity=".4"/>
    <path class="tick" d="M27.5 37.5 34 44 47 30" stroke="var(--brand-active)" stroke-width="3.6"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const SEAL_NO = `<svg viewBox="0 0 74 74" fill="none" aria-hidden="true">
  <circle class="ring" cx="37" cy="37" r="34" stroke="var(--bad)" stroke-width="1.3"
    stroke-dasharray="4 6" opacity=".45"/>
  <g class="pop">
    <circle cx="37" cy="37" r="27" fill="var(--bad-wash)"/>
    <circle cx="37" cy="37" r="27" stroke="var(--bad)" stroke-width="1.5" opacity=".4"/>
    <path d="M29 29 45 45M45 29 29 45" stroke="var(--bad)" stroke-width="3.6" stroke-linecap="round"/>
  </g>
</svg>`;

const ICON = {
  type: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" stroke-width="1.9"/><path d="M7.5 9.5h9M7.5 14h5.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  hours: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  form: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.9"/><path d="M9 20h6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  period: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5.5" width="17" height="14" rx="2.5" stroke="currentColor" stroke-width="1.9"/><path d="M3.5 10h17M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  code: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6 4.5 12 9 18M15 6l4.5 6L15 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  issued: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 3.5h12v17l-6-3.5-6 3.5v-17Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`,
  lock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="10" width="15" height="10" rx="2.5" stroke="currentColor" stroke-width="1.9"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
};

function field(icon, label, value, opts) {
  const v = escapeHtml(value);
  if (!v) return "";
  const cls = ["f-value", opts && opts.mono ? "mono" : ""].filter(Boolean).join(" ");
  const wrap = opts && opts.full ? ' class="full"' : "";
  return `<div${wrap}>
        <div class="f-label">${icon}${escapeHtml(label)}</div>
        <div class="${cls}">${v}</div>
      </div>`;
}

function shell(bodyHtml) {
  const logo = LOGO_URI
    ? `<img src="${LOGO_URI}" alt="" width="38" height="38" />`
    : "";
  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" content="#34C18C" />
<title>Hujjat tekshiruvi</title>
<style>${STYLE}</style>
</head>
<body>
  <div class="wrap">
    <div class="org">
      ${logo}
      <div class="org-txt">
        <div class="org-name">${escapeHtml(INSTITUTE)}</div>
        <div class="org-sub">Rasmiy tekshiruv xizmati</div>
      </div>
    </div>
    ${bodyHtml}
    <p class="hint">Ushbu sahifa QR kod orqali ochiladi va institutning rasmiy
    reyestridagi yozuvni ko'rsatadi. Ma'lumot faqat o'qish uchun.</p>
  </div>
</body>
</html>`;
}

function docTitle(d) {
  return Number(d && d.kind) === 2 ? "Ma'lumotnoma" : "Sertifikat";
}

function renderValid(d) {
  const details = [
    field(ICON.type, "Kurs turi", d.courseType, { full: true }),
    field(ICON.hours, "Hajmi", fmtHours(d.creditHours)),
    field(ICON.form, "Shakli", fmtForm(d.form)),
    field(ICON.period, "Kurs davri", fmtPeriod(d.startDate, d.endDate), { full: true }),
  ]
    .filter(Boolean)
    .join("\n        ");

  const stamp = [
    field(ICON.code, `${docTitle(d)} kodi`, d.code, { mono: true }),
    field(ICON.issued, "Berilgan sana", fmtDate(d.issuedAt)),
  ]
    .filter(Boolean)
    .join("\n        ");

  const isReference = Number(d.kind) === 2;

  return shell(`<div class="card">
      <div class="accent"></div>
      <div class="hero">
        <div class="seal">${SEAL_OK}</div>
        <p class="kicker">Malaka oshirish</p>
        <h1 class="doc-title">${docTitle(d)}</h1>
      </div>

      <div class="holder">
        <p class="lead">Quyidagi shaxsga berilgan:</p>
        <h2 class="name">${escapeHtml(d.fullName)}</h2>
        <p class="after">${
          isReference
            ? `Ushbu shaxs quyida ko'rsatilgan malaka oshirish kursida tinglovchi
        sifatida tahsil olgan, biroq yakuniy attestatsiyadan o'ta olmagan.`
            : `Ushbu shaxs quyida ko'rsatilgan malaka oshirish kursini
        to'liq o'tab, yakuniy talablarni muvaffaqiyatli bajargan.`
        }</p>
      </div>

      <div class="course">
        <div class="course-head">
          <div class="course-eyebrow">Kurs</div>
          <div class="course-name">${escapeHtml(d.courseName)}</div>
        </div>
        <div class="course-body">
          <div class="grid">
        ${details}
          </div>
          <div class="rule"></div>
          <div class="grid">
        ${stamp}
          </div>
        </div>
      </div>

      <div class="foot">
        ${ICON.lock}
        <p>Ma'lumot institut reyestridan real vaqtda olindi.<br/>
        Hujjat bekor qilinsa, bu sahifa uni haqiqiy deb ko'rsatmaydi.</p>
      </div>
    </div>`);
}

function renderInvalid(rawCode) {
  const code = escapeHtml(String(rawCode || "").trim().toUpperCase().slice(0, 32));
  return shell(`<div class="card">
      <div class="accent no"></div>
      <div class="hero">
        <div class="seal">${SEAL_NO}</div>
        <span class="pill"><span class="dot"></span>Hujjat topilmadi</span>
        <p class="kicker">Malaka oshirish</p>
        <h1 class="doc-title">Tekshiruv natijasi</h1>
      </div>

      <div class="notfound">
        <p>Bu kod bo'yicha reyestrda yozuv yo'q. Kod noto'g'ri kiritilgan bo'lishi
        yoki sertifikat mavjud emasligi mumkin.</p>
        ${code ? `<div class="code-chip">${code}</div>` : ""}
      </div>

      <div class="foot">
        ${ICON.lock}
        <p>QR kodni qaytadan skanerlab ko'ring. Muammo saqlansa,
        institut malaka oshirish bo'limiga murojaat qiling.</p>
      </div>
    </div>`);
}

async function verifyCertificate(req, res) {
  try {
    const result = await verifyCertificateByCode(req.params.code);
    if (!result) {
      return res.status(404).type("html").send(renderInvalid(req.params.code));
    }
    return res.status(200).type("html").send(renderValid(result));
  } catch (err) {
    winston.error(`[qualCertificateVerify] xatolik: ${err.message}`);
    return res.status(404).type("html").send(renderInvalid(req.params.code));
  }
}

module.exports = {
  verifyCertificate,
  renderValid,
  renderInvalid,
  fmtDate,
  fmtPeriod,
  fmtForm,
  fmtHours,
};
