const { ErrorHandler } = require("#shared/error");

function zipFileSlots(body, allowedSlots) {
  if (!body.fileSlots) return {};

  let slots;
  try {
    slots = JSON.parse(body.fileSlots);
  } catch {
    throw new ErrorHandler(400, "fileSlots JSON massiv bo'lishi kerak");
  }
  if (!Array.isArray(slots)) {
    throw new ErrorHandler(400, "fileSlots JSON massiv bo'lishi kerak");
  }

  const media = Array.isArray(body.media) ? body.media : [];
  if (slots.length !== media.length) {
    throw new ErrorHandler(
      400,
      `Fayllar soni (${media.length}) fileSlots soni (${slots.length}) bilan mos emas`,
    );
  }

  const out = {};
  slots.forEach((slot, i) => {
    if (!allowedSlots.includes(slot)) {
      throw new ErrorHandler(400, `Noto'g'ri fayl sloti: ${slot}`);
    }
    if (out[slot]) {
      throw new ErrorHandler(400, `Fayl sloti takrorlangan: ${slot}`);
    }
    out[slot] = media[i].image;
  });
  return out;
}

function assertAllSlots(filesMap, requiredSlots, label) {
  const missing = requiredSlots.filter((s) => !filesMap[s]);
  if (missing.length) {
    throw new ErrorHandler(
      400,
      `${label}: quyidagi fayllar yuklanmagan — ${missing.join(", ")}`,
    );
  }
}

module.exports = { zipFileSlots, assertAllSlots };
