"use strict";

const { ErrorHandler } = require("#shared/error");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const {
  MAX_PACKET_DAYS,
  MAX_EMIT_SKEW_MS,
  MAX_EMIT_AGE_DAYS,
  daysInclusive,
  enumerateDays,
  oldestAcceptedDay,
} = require("./samsContract");

const bad = (reason, message, detail = "") =>
  new ErrorHandler(400, message, detail, { reason });

function assertWindow({ from, to }, now) {
  if (from > to) throw bad("window_invalid", "Oyna boshi oxiridan keyin", `${from}..${to}`);
  if (daysInclusive(from, to) > MAX_PACKET_DAYS) {
    throw bad("window_too_long", `Oyna ${MAX_PACKET_DAYS} kundan uzun`, `${from}..${to}`);
  }
  const latest = uzDayKey(new Date(now.getTime() + MAX_EMIT_SKEW_MS));
  if (to > latest) throw bad("window_in_future", "Oyna kelajakdagi kunni o'z ichiga oladi", to);
  const oldest = oldestAcceptedDay(uzDayKey(now));
  if (from < oldest) throw bad("window_too_old", "Oyna juda eski", `${from} < ${oldest}`);
}

function assertEmittedAt(emittedAt, now) {
  const at = emittedAt.getTime();
  const min = now.getTime() - MAX_EMIT_AGE_DAYS * 86_400_000;
  const max = now.getTime() + MAX_EMIT_SKEW_MS;
  if (at < min || at > max) {
    throw bad("emitted_at_out_of_range", "Paket vaqti ruxsat etilgan oraliqdan tashqarida", emittedAt.toISOString());
  }
}

function assertTenantDays(tenants, window) {
  const expected = enumerateDays(window.from, window.to).join(",");
  const broken = tenants.find(
    (t) => t.days.map((d) => d.day).sort().join(",") !== expected,
  );
  if (broken) {
    throw bad("tenant_days_mismatch", "Tenant kunlari oyna kunlariga mos emas", broken.dbname);
  }
}

function assertRecordDates(tenants, { from, to }) {
  const outside = (r) => r.date < from || r.date > to;
  const broken = tenants.find((t) => t.people.some((p) => p.records.some(outside)));
  if (broken) {
    throw bad("record_out_of_window", "Yozuv sanasi oynadan tashqarida", broken.dbname);
  }
}

function assertPacket(packet, now) {
  assertWindow(packet.window, now);
  assertEmittedAt(packet.emittedAt, now);
  assertTenantDays(packet.tenants, packet.window);
  assertRecordDates(packet.tenants, packet.window);
}

module.exports = {
  assertPacket,
  assertWindow,
  assertEmittedAt,
  assertTenantDays,
  assertRecordDates,
};
