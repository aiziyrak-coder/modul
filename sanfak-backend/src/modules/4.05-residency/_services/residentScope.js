const { ROLES } = require("#config/constants");
const Resident = require("#modules/4.05-residency/resident/resident.model");

async function liveResidentIds(query) {
  const rows = await Resident.find(query).select("_id").lean();
  return rows.map((r) => r._id);
}

async function deletedResidentIds() {
  const rows = await Resident.findDeleted().select("_id").lean();
  return rows.map((r) => r._id);
}

async function allowedResidentIds(user) {
  return residentIdsFor(user);
}

async function buildResidentScope(user, wantedResident) {
  const allowed = await allowedResidentIds(user);

  if (allowed === null) {
    const dead = await deletedResidentIds();
    if (wantedResident) {
      const gone = dead.some((id) => id.equals(wantedResident));
      return { filter: { resident: wantedResident }, denied: gone };
    }
    return {
      filter: dead.length ? { resident: { $nin: dead } } : {},
      denied: false,
    };
  }

  if (wantedResident) {
    const ok = allowed.some((id) => id.equals(wantedResident));
    return { filter: { resident: wantedResident }, denied: !ok };
  }

  return { filter: { resident: { $in: allowed } }, denied: false };
}

function canAccessResident(user, doc, mode = "read") {
  if (!user || !doc) return false;

  const role = user.role || {};
  const title = role.title;
  const scopeLevel = role.scopeLevel || "self";
  const eq = (a, b) => Boolean(a) && Boolean(b) && String(a._id || a) === String(b._id || b);

  if (scopeLevel === "global" || title === ROLES.MAGISTRATURA_BOLIM) return true;

  if (title === ROLES.KAFEDRA_MUDIRI) return eq(doc.department, user.department);

  if (title === ROLES.KLINIK_USTOZ || title === ROLES.ILMIY_RAHBAR)
    return eq(doc.supervisor, user._id);

  if (mode !== "read") return false;
  return eq(doc.user, user._id);
}

function guardResident(req, res, doc, mode = "read") {
  if (canAccessResident(req.user, doc, mode)) return true;
  res.status(404).json({ message: "not found" });
  return false;
}


function canActForResident(user, doc) {
  return canAccessResident(user, doc, "read");
}

async function denyActForResident(req, res, residentId) {
  const doc = await Resident.findById(residentId).select("user supervisor department");
  if (!doc || !canActForResident(req.user, doc)) {
    res.status(404).json({ message: "not found" });
    return true;
  }
  return false;
}

async function residentIdsFor(user) {
  const role = user?.role || {};
  const title = role.title;
  const scopeLevel = role.scopeLevel || "self";

  if (scopeLevel === "global" || title === ROLES.MAGISTRATURA_BOLIM) return null;

  if (title === ROLES.KAFEDRA_MUDIRI) {
    if (!user.department) return [];
    return liveResidentIds({ department: user.department });
  }

  if (title === ROLES.KLINIK_USTOZ || title === ROLES.ILMIY_RAHBAR) {
    return liveResidentIds({ supervisor: user._id });
  }

  return liveResidentIds({ user: user._id });
}

function canCreateResident(user, payload = {}) {
  return canAccessResident(user, { department: payload.department ?? null }, "write");
}

const CREATE_SCOPE_DENIED =
  "Talabani faqat o'z kafedrangizga kirita olasiz — «Kafedra» maydonini tekshiring";

function guardCreateResident(req, res, payload) {
  if (canCreateResident(req.user, payload)) return true;
  res.status(403).json({ message: CREATE_SCOPE_DENIED });
  return false;
}

function supervisorScopeFor(user) {
  const role = user?.role || {};
  const restricted =
    role.title === ROLES.KAFEDRA_MUDIRI && (role.scopeLevel || "self") !== "global";
  return { restricted, department: restricted ? (user.department ?? null) : null };
}

module.exports = {
  allowedResidentIds,
  liveResidentIds,
  deletedResidentIds,
  canActForResident,
  denyActForResident,
  residentIdsFor,
  buildResidentScope,
  canAccessResident,
  guardResident,
  canCreateResident,
  guardCreateResident,
  CREATE_SCOPE_DENIED,
  supervisorScopeFor,
};
