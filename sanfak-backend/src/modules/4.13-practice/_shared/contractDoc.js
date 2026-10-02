const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("uz-UZ") : "____.____.____";

const fillTemplate = (body, c) => {
  const org = c.organization || {};
  const studentsList = (c.students || [])
    .map((s, i) => `${i + 1}. ${s.fish || ""} (${s.group || ""}-guruh)`)
    .join("\n");

  const map = {
    raqam: c.number || "",
    sana: fmtDate(new Date()),
    oquv_yili: c.academicYear?.title || "",
    baza: org.title || "",
    yonalish: c.direction?.title || "",
    kurs: c.course != null ? String(c.course) : "",
    guruh: c.group || "",
    viloyat: org.region?.title || "",
    tuman: org.district?.title || "",
    muddat_boshlanish: fmtDate(c.startDate),
    muddat_tugash: fmtDate(c.endDate),
    talabalar_soni: String(c.studentsCount ?? (c.students?.length || 0)),
    talabalar_royxati: studentsList,
  };

  return String(body).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) =>
    key in map ? map[key] : m,
  );
};

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildDocHtml = (text) => {
  const safe = escapeHtml(text).replace(/\n/g, "<br/>");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Shartnoma</title></head><body style="font-family:'Times New Roman',serif;font-size:14px;line-height:1.5;">${safe}</body></html>`;
};

module.exports = { fillTemplate, buildDocHtml };
