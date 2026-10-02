const endOfDay = (d) => {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
};

function isRegistrationOpen(spec, now = new Date()) {
  if (!spec) return false;
  if (spec.status !== "open" || spec.active === false) return false;
  if (spec.regStart && new Date(spec.regStart) > now) return false;
  if (spec.regEnd && endOfDay(spec.regEnd) < now) return false;
  return true;
}

function effectiveStatus(spec, now = new Date()) {
  if (!spec || spec.active === false) return "closed";
  if (spec.status !== "open") return "closed";
  if (spec.regStart && new Date(spec.regStart) > now) return "upcoming";
  if (spec.regEnd && endOfDay(spec.regEnd) < now) return "expired";
  return "open";
}

const EFFECTIVE_STATUSES = ["open", "closed", "upcoming", "expired"];

module.exports = { endOfDay, isRegistrationOpen, effectiveStatus, EFFECTIVE_STATUSES };
