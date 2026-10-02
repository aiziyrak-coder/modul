"use strict";

const KAFEDRA_SIGNATORIES = [
  { step: "kafedraMudiri", label: "Kafedra mudiri" },
  {
    step: "kafedraUslubiy",
    label: "Kafedraning o'quv va o'quv-uslubiy ishlar bo'yicha mas'ul xodimi",
  },
  {
    step: "kafedraIlmiy",
    label: "Kafedraning ilmiy-tadqiqot ishlariga mas'ul xodimi",
  },
  {
    step: "kafedraUstozShogird",
    label: 'Kafedraning "Ustoz-shogird" ishlari bo\'yicha mas\'ul xodimi',
  },
  { step: "teacher", label: "Kafedra assistenti" },
];

const INSTITUTE_SIGNATORIES = [
  { step: "oquvUslubiy", label: "O'quv-uslubiy boshqarma boshlig'i" },
  { step: "dekan", label: "Fakultet dekani" },
  {
    step: "ichkiNazorat",
    label: "Ichki nazorat va monitoring bo'limi mas'ul xodimi",
  },
];

const SIGNATORIES = [...KAFEDRA_SIGNATORIES, ...INSTITUTE_SIGNATORIES];

function signatoryLabel(step) {
  const found = SIGNATORIES.find((s) => s.step === step);
  return found ? found.label : String(step || "");
}

module.exports = {
  KAFEDRA_SIGNATORIES,
  INSTITUTE_SIGNATORIES,
  SIGNATORIES,
  signatoryLabel,
};
