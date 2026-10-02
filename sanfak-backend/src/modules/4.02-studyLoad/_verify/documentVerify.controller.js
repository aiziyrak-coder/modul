"use strict";

const winston = require("#shared/winston.logger");
const { lookup } = require("./documentVerify.service");

const INSTITUTE = "Farg'ona jamoat salomatligi tibbiyot instituti";

const KIND_LABELS = {
  workload: "O'quv yuklamasi",
  workloadDistribution: "Yuklama taqsimoti",
  syllabus: "Sillabus",
  scienceProgram: "Fan dasturi",
  workingSchedule: "Ishchi o'quv reja",
  workloadSummary: "Kafedralar soatlar hisobi",
  contingentReport: "Talabalar kontingenti hisoboti",
  teacherLeave: "O'qituvchi arizasi bayonnomasi",
};

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

const STYLE = `
*,*::before,*::after{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  margin:0;padding:24px 16px 36px;background:#F5F7FB;color:#121926;
  display:flex;align-items:flex-start;justify-content:center;font-size:15px;line-height:1.5}
.wrap{width:100%;max-width:520px}
.org{font-size:12px;font-weight:600;color:#697586;text-align:center;margin:0 0 14px}
.card{background:#fff;border:1px solid #E3E8EF;border-radius:12px;overflow:hidden;
  box-shadow:0 1px 2px rgba(0,0,0,.05)}
.accent{height:3px;background:linear-gradient(90deg,#34C18C,#259468)}
.accent.no{background:linear-gradient(90deg,#F04438,#B42318)}
.hero{padding:22px 22px 16px;text-align:center;border-bottom:1px solid #EEF2F6}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;
  font-weight:600;background:rgba(52,193,140,.12);color:#259468;margin-bottom:10px}
.badge.no{background:rgba(240,68,56,.10);color:#F04438}
.accent.wip{background:linear-gradient(90deg,#FDB022,#DC6803)}
.badge.wip{background:rgba(253,176,34,.16);color:#B54708}
.kicker{margin:0;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#98A2B3}
.title{margin:6px 0 0;font-size:19px;font-weight:650;letter-spacing:-.01em}
.warn{margin:10px 20px 0;padding:8px 12px;border-radius:8px;background:rgba(240,68,56,.08);
  color:#B42318;font-size:12.5px;text-align:center}
.body{padding:16px 20px 20px}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #EEF2F6}
th{color:#98A2B3;font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}
.foot{padding:12px 20px 18px;background:#F9FAFB;border-top:1px solid #EEF2F6;
  font-size:11px;color:#98A2B3;text-align:center}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em}
.notfound{padding:4px 22px 22px;text-align:center;font-size:13px;color:#697586}
`;

function shell(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Hujjat tekshiruvi</title>
<style>${STYLE}</style>
</head>
<body>
  <div class="wrap">
    <p class="org">${escapeHtml(INSTITUTE)}</p>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function renderValid(d, token) {
  const kindLabel = escapeHtml(KIND_LABELS[d.kind] || "Hujjat");
  const rows = (d.snapshot || [])
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.label || "")}</td><td>${escapeHtml(
          s.shortName || "",
        )}</td><td>${escapeHtml(fmtDate(s.date))}</td></tr>`,
    )
    .join("");

  const editedNotice = d.editedAfterApproval
    ? `<p class="warn">Tasdiqdan keyin tahrirlangan</p>`
    : "";

  return shell(`<div class="card">
      <div class="accent"></div>
      <div class="hero">
        <span class="badge">Tasdiqlangan</span>
        <p class="kicker">${kindLabel}</p>
        <h1 class="title">${escapeHtml(d.title)}</h1>
      </div>
      ${editedNotice}
      <div class="body">
        <p style="margin:0 0 10px;font-size:12.5px;color:#697586">
          Tizim yozuvi bo'yicha tasdiqlangan${
            d.approvedAt ? ` — ${escapeHtml(fmtDate(d.approvedAt))}` : ""
          } (elektron raqamli imzo hali ulanmagan).
        </p>
        <table>
          <thead><tr><th>Lavozim</th><th>F.I.O</th><th>Sana</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="foot">
        Tekshiruv raqami: <span class="code">${escapeHtml(token)}</span>
      </div>
    </div>`);
}

function renderInProgress(d, token) {
  const kindLabel = escapeHtml(KIND_LABELS[d.kind] || "Hujjat");
  const signedRows = (d.snapshot || [])
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.label || "")}</td><td>${escapeHtml(
          s.shortName || "",
        )}</td><td>${escapeHtml(fmtDate(s.date))}</td></tr>`,
    )
    .join("");
  const pendingRows = (d.pending || [])
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.label || p.step || "")}</td><td>—</td><td>kutilmoqda</td></tr>`,
    )
    .join("");
  const asOf = d.approvedAt ? ` ${escapeHtml(fmtDate(d.approvedAt))} bo'yicha` : "";

  return shell(`<div class="card">
      <div class="accent wip"></div>
      <div class="hero">
        <span class="badge wip">Jarayonda</span>
        <p class="kicker">${kindLabel}</p>
        <h1 class="title">${escapeHtml(d.title)}</h1>
      </div>
      <div class="body">
        <p style="margin:0 0 10px;font-size:12.5px;color:#697586">
          Imzolash jarayoni yakunlanmagan — joriy holat,${asOf}
          (tizim yozuvi; elektron raqamli imzo hali ulanmagan).
        </p>
        <table>
          <thead><tr><th>Lavozim</th><th>F.I.O</th><th>Sana</th></tr></thead>
          <tbody>${signedRows}${pendingRows}</tbody>
        </table>
      </div>
      <div class="foot">
        Tekshiruv raqami: <span class="code">${escapeHtml(token)}</span>
      </div>
    </div>`);
}

function renderSuperseded(d, token) {
  const kindLabel = escapeHtml(KIND_LABELS[d.kind] || "Hujjat");
  const rows = (d.snapshot || [])
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.label || "")}</td><td>${escapeHtml(
          s.shortName || "",
        )}</td><td>${escapeHtml(fmtDate(s.date))}</td></tr>`,
    )
    .join("");
  const since = d.supersededAt ? ` ${escapeHtml(fmtDate(d.supersededAt))} dan boshlab` : "";

  return shell(`<div class="card">
      <div class="accent no"></div>
      <div class="hero">
        <span class="badge no">O'z kuchini yo'qotgan</span>
        <p class="kicker">${kindLabel}</p>
        <h1 class="title">${escapeHtml(d.title)}</h1>
      </div>
      <p class="warn">Bu hujjat yangi versiya bilan almashtirilgan va${since} o'z kuchini yo'qotgan.</p>
      <div class="body">
        <p style="margin:0 0 10px;font-size:12.5px;color:#697586">
          Tarixiy yozuv — imzolaganlar (tizim yozuvi; elektron raqamli imzo hali ulanmagan):
        </p>
        <table>
          <thead><tr><th>Lavozim</th><th>F.I.O</th><th>Sana</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="foot">
        Tekshiruv raqami: <span class="code">${escapeHtml(token)}</span>
      </div>
    </div>`);
}

const RENDERERS = { in_progress: renderInProgress, superseded: renderSuperseded };

function renderInvalid() {
  return shell(`<div class="card">
      <div class="accent no"></div>
      <div class="hero">
        <span class="badge no">Topilmadi</span>
        <p class="kicker">Hujjat tekshiruvi</p>
        <h1 class="title">Tekshiruv natijasi</h1>
      </div>
      <div class="notfound">
        <p>Bu havola bo'yicha reyestrda tasdiqlangan yozuv yo'q. QR kodni
        qaytadan skanerlab ko'ring.</p>
      </div>
    </div>`);
}

function setSecurityHeaders(res) {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Robots-Tag", "noindex, noarchive");
  res.set("X-Content-Type-Options", "nosniff");
}

async function verifyDocument(req, res) {
  setSecurityHeaders(res);
  try {
    const result = await lookup(req.params.token);
    if (!result) return res.status(404).type("html").send(renderInvalid());
    const render = RENDERERS[result.state] || renderValid;
    return res
      .status(200)
      .type("html")
      .send(render(result, req.params.token));
  } catch (err) {
    winston.error(`[documentVerify] controller xatolik: ${err.message}`);
    return res.status(404).type("html").send(renderInvalid());
  }
}

module.exports = {
  verifyDocument,
  renderValid,
  renderInProgress,
  renderSuperseded,
  renderInvalid,
  escapeHtml,
  fmtDate,
  setSecurityHeaders,
};
