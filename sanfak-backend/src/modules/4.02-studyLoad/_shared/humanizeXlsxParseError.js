"use strict";

function humanizeXlsxParseError(err, fieldLabel) {
  const msg = err && err.message ? err.message : String(err);

  if (
    /InvalidFileException/.test(msg) ||
    /does not support .* file format/i.test(msg)
  ) {
    return `«${fieldLabel}» o'qib bo'lmadi — bu haqiqiy .xlsx fayl emas yoki buzilgan. Faylni Excel'da ochib qayta saqlang va qaytadan yuklang.`;
  }

  const parseErrorMatch = msg.match(/ParseError:\s*([^\r\n]+)/);
  if (parseErrorMatch) {
    return `«${fieldLabel}»da xatolik: ${parseErrorMatch[1].trim()}`;
  }

  if (/Python skript xatolik bilan tugatdi/.test(msg)) {
    return `«${fieldLabel}»ni o'qishda kutilmagan xatolik yuz berdi. Faylni tekshirib qayta urinib ko'ring.`;
  }

  return msg;
}

module.exports = humanizeXlsxParseError;
