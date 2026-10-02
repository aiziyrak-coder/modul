"use strict";

const EDITABLE_STATUSES = ["draft", "new"];

function isEditable(status) {
  return EDITABLE_STATUSES.includes(status);
}

function notEditableMessage(entityLabel, status) {
  return (
    `Faqat 'draft' holatdagi ${entityLabel}ni tahrirlash mumkin. ` +
    `Joriy holat: ${status}. ` +
    `Rad etilgan hujjatni tuzatish uchun avval qayta ochish kerak ` +
    `(tasdiqlash amalini bosing — hujjat 'draft'ga qaytadi).`
  );
}

const LOCKED_STATUSES = ["in_review", "approved", "superseded"];

function isLocked(status) {
  return LOCKED_STATUSES.includes(status);
}

function lockedMessage(entityLabel, status) {
  return `${entityLabel} "${status}" holatida — tahrirlab bo'lmaydi`;
}

module.exports = {
  EDITABLE_STATUSES,
  isEditable,
  notEditableMessage,
  LOCKED_STATUSES,
  isLocked,
  lockedMessage,
};
