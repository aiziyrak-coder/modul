// HEMIS lavozimi -> tizim roli. Faqat lavozimga ISHONCHLI mos keladigan mavjud rollar.
// rank: bir odamda bir necha lavozim bo'lsa eng yuqorisi tanlanadi.
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const RULES = [
  { re: /^prorektor$|prorektor$/, role: "prorektor", rank: 9 },
  { re: /^kafedra mudiri$/, role: "kafedra_mudiri", rank: 5 },
  { re: /^(bosh hisobchi|hisobchi|iqtisodchi|bosh buhgalter orinbosari|bosh buxgalter orinbosari|bosh buhgalter|bosh buxgalter)$/, role: "reja_moliya", rank: 3 },
  { re: /^uslubchi$/, role: "kafedra_uslubiy_masul", rank: 2 },
  {
    re: /^(professor|dotsent|katta oqituvchi|oqituvchi|assistent|stajer.?oqituvchi|stajer oqituvchi|tyutor)$/,
    role: "oqituvchi",
    rank: 1,
  },
];

// Mos tayyor rol topilmagan lavozimlar (xizmat xodimlari, rahbar o'rinbosarlari va h.k.) —
// minimal huquqli "hodim" roli: faqat e'lon va o'z bildirishnomalari.
const FALLBACK = { role: "hodim", rank: 0 };

const roleForPosition = (name) => {
  const n = norm(name);
  if (!n) return null;
  const hit = RULES.find((r) => r.re.test(n));
  return hit ? { role: hit.role, rank: hit.rank } : FALLBACK;
};

module.exports = { norm, roleForPosition };
