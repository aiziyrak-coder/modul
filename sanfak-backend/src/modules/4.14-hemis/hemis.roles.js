// HEMIS lavozimi/bo'limi -> tizim roli. Faqat ISHONCHLI mos keladigan mavjud rollar.
// rank: bir odamda bir necha lavozim bo'lsa eng yuqorisi tanlanadi.
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Lavozim bo'yicha
const RULES = [
  { re: /^rektor$/, role: "rektor", rank: 10 },
  { re: /prorektor$/, role: "prorektor", rank: 9 },
  { re: /^dekan$/, role: "dekan", rank: 8 },
  { re: /^kafedra mudiri$/, role: "kafedra_mudiri", rank: 5 },
  { re: /^(bosh hisobchi|hisobchi|1-toifali hisobchi|iqtisodchi|bosh buhgalter orinbosari|bosh buxgalter orinbosari|bosh buhgalter|bosh buxgalter)$/, role: "reja_moliya", rank: 3 },
  { re: /^uslubchi$/, role: "kafedra_uslubiy_masul", rank: 2 },
  {
    re: /^(professor|dotsent|katta oqituvchi|oqituvchi|assistent|stajer.?oqituvchi|stajer oqituvchi|tyutor)$/,
    role: "oqituvchi",
    rank: 1,
  },
];

// Mos tayyor rol topilmagan lavozimlar — minimal huquqli "hodim"
const FALLBACK = { role: "hodim", rank: 0 };

const roleForPosition = (name) => {
  const n = norm(name);
  if (!n) return null;
  const hit = RULES.find((r) => r.re.test(n));
  return hit ? { role: hit.role, rank: hit.rank } : FALLBACK;
};

// Bo'lim bo'yicha (HEMIS bo'lim id si). Faqat mutaxassis/boshliq turidagi lavozimlarga —
// xizmat xodimlari (Farrosh, Qorovul va h.k.) bo'lim rolini OLMAYDI.
const DEPT_ROLES = {
  27: "magistratura_bolim", // Magistratura bo'limi
  62: "magistratura_bolim", // Magistratura bo'limi (fakultet turida)
  46: "amaliyot_bolimi", // Talabalar amaliyoti bo'limi
  82: "ilmiy_bolim", // Ilmiy tadqiqotlar, innovatsiyalar va ilmiy-pedagogik kadrlar tayyorlash
  37: "iqtidorli_bolim", // Iqtidorli talabalar ilmiy-tadqiqot faoliyati sektori
  76: "talim_sifati_nazorati", // Ta'lim sifatini ta'minlash
  23: "oquv_uslubiy_boshqarma", // O'quv-uslubiy boshqarma
  96: "oquv_uslubiy_boshqarma", // O'quv metodik ta'minot bo'limi
  35: "ichki_nazorat", // Monitoring va ichki nazorat sektori
  85: "kadrlar", // Xodimlar bo'limi
};
const DEPT_RANK = 4;
const OFFICE_POSITION = /boshlig|mudir|mutaxassis|uslubchi|inspektor|menejer|ish yurit|kotib|hisobchi|muhandis/;

// Bitta HEMIS xodim qatori uchun eng yuqori rol
const roleForRow = (row) => {
  let best = roleForPosition(row?.staffPosition?.name);
  const pos = norm(row?.staffPosition?.name);
  const deptRole = DEPT_ROLES[row?.department?.id];
  if (deptRole && OFFICE_POSITION.test(pos) && (!best || best.rank < DEPT_RANK)) {
    best = { role: deptRole, rank: DEPT_RANK };
  }
  return best;
};

module.exports = { norm, roleForPosition, roleForRow };
