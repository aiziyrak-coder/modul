function staffTableMissing(staffPositions) {
  const sp = staffPositions || {};
  if (!(Number(sp.totalPositions) > 0)) return false;
  const items = Array.isArray(sp.items) ? sp.items : [];
  return !items.some((it) => Number(it && it.positions) > 0);
}

function carryOverStaffItems(items) {
  return (Array.isArray(items) ? items : []).map((it) => {
    const { _id, ...rest } = it || {};
    return rest;
  });
}

const STAFF_TABLE_MISSING_MSG =
  "Jadval 2 (lavozimlar bo'yicha ish o'rinlari) to'ldirilmagan — yuborishdan oldin " +
  "ish o'rinlarini lavozimlar bo'yicha taqsimlang";

module.exports = { staffTableMissing, carryOverStaffItems, STAFF_TABLE_MISSING_MSG };
