"use strict";

const PIN_LENGTH = 14;

const MODULE_PIN_PREFIX = Object.freeze({
  "4.5": "45",
  "4.7": "47",
  "4.11": "411",
});

const LOGIN_SLOTS = 99;

const DEMO_SLOT_START = 101;

function modulePin(prefix, slot) {
  if (typeof prefix !== "string" || !/^[0-9]+$/.test(prefix)) {
    throw new Error(`modulePin: prefiks faqat raqamlardan iborat bo'lishi kerak — "${prefix}"`);
  }
  if (!Number.isInteger(slot) || slot < 1) {
    throw new Error(`modulePin: slot 1 dan katta butun son bo'lishi kerak — ${slot}`);
  }
  const width = PIN_LENGTH - prefix.length;
  const tail = String(slot);
  if (tail.length > width) {
    throw new Error(
      `modulePin: slot ${slot} "${prefix}" prefiksi bilan ${PIN_LENGTH} xonaga sig'maydi ` +
        `(maksimum ${"9".repeat(width)})`,
    );
  }
  const pin = prefix + tail.padStart(width, "0");
  if (!/^\d+$/.test(pin) || pin.length !== PIN_LENGTH) {
    throw new Error(`modulePin: yaroqsiz natija "${pin}" (prefiks "${prefix}", slot ${slot})`);
  }
  return pin;
}

function modulePins(prefix, count, start = 1) {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`modulePins: count manfiy bo'lmagan butun son bo'lishi kerak — ${count}`);
  }
  return Array.from({ length: count }, (_, i) => modulePin(prefix, start + i));
}

module.exports = {
  PIN_LENGTH,
  MODULE_PIN_PREFIX,
  LOGIN_SLOTS,
  DEMO_SLOT_START,
  modulePin,
  modulePins,
};
