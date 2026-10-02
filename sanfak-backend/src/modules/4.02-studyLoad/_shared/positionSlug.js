"use strict";

const RULES = [
  { slug: "professor", rx: /professor/i },
  { slug: "docent", rx: /dotsent|docent|доцент/i },
  { slug: "senior_teacher", rx: /katta\s+o.?\s?qituvchi|senior\s*teacher|старший\s+преподаватель/i },
  { slug: "trainee", rx: /stajy[oe]r|stajer|amaliyotchi|стаж[её]р/i },
  { slug: "assistant", rx: /assistent|assistant|ассистент/i },
];

function resolvePositionSlug(title) {
  if (!title) return null;
  const t = String(title).trim();
  if (!t) return null;
  const hit = RULES.find((r) => r.rx.test(t));
  return hit ? hit.slug : null;
}

const KNOWN_SLUGS = Object.freeze(RULES.map((r) => r.slug));

module.exports = { resolvePositionSlug, KNOWN_SLUGS };
