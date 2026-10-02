const { ErrorHandler } = require("#shared/error");
const { ROLES, MODULES, ACTIONS } = require("#config/constants");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const UserModel = require("#modules/4.01-auth/user/user.model");

const RESERVED_TITLES = new Set([ROLES.SUPER_ADMIN, ROLES.ADMIN]);

const GRANT_ANY_KEY = `${MODULES.ROLE}:${ACTIONS.GRANT_ANY}`;

const SCOPE_RANK = { self: 0, department: 1, faculty: 2, global: 3 };

const isSuperAdmin = (actor) => actor?.role?.title === ROLES.SUPER_ADMIN;

const toGrantSet = (permissions = []) => {
  const set = new Set();
  permissions.forEach((p) => {
    if (!p || !p.section) return;
    (p.actionKeys || []).forEach((a) => set.add(`${p.section}:${a}`));
  });
  return set;
};

const hasGrantAny = (actor) =>
  toGrantSet(actor?.role?.permissions).has(GRANT_ANY_KEY);

const scopeRank = (level) => SCOPE_RANK[level] ?? 0;

const listExcess = (excess) =>
  excess.slice(0, 8).join(", ") + (excess.length > 8 ? ` (+${excess.length - 8} ta)` : "");

const roleExceedsActor = (actor, role) => {
  const actorRole = (actor && actor.role) || {};
  const mine = toGrantSet(actorRole.permissions);
  const excess = [...toGrantSet(role.permissions)].filter((k) => !mine.has(k));
  if (excess.length) return "Bu rol sizda yo'q huquqlarni beradi: " + listExcess(excess);
  if (scopeRank(role.scopeLevel) > scopeRank(actorRole.scopeLevel)) {
    return `Bu rolning doirasi ("${role.scopeLevel}") sizning doirangizdan keng`;
  }
  return null;
};

const isRoleUnchanged = async (actor, roleId, targetUserId) => {
  if (!targetUserId) return false;
  if (String(targetUserId) === String(actor && actor._id)) {
    const own = actor.role && actor.role._id ? actor.role._id : actor.role;
    if (String(roleId) !== String(own)) {
      throw new ErrorHandler(403, "O'z hisobingizga boshqa rol biriktira olmaysiz");
    }
  }
  const current = await UserModel.findById(targetUserId).select("role").lean();
  return Boolean(current) && String(current.role) === String(roleId);
};

const assertCanAssignRole = async (actor, roleId, opts = {}) => {
  if (!roleId || isSuperAdmin(actor)) return;

  const target = await RoleModel.findById(roleId)
    .select("title permissions scopeLevel")
    .lean();
  if (!target) return;

  if (RESERVED_TITLES.has(target.title)) {
    throw new ErrorHandler(
      403,
      `"${target.title}" rolini biriktirish uchun super_admin huquqi kerak`,
    );
  }

  if (await isRoleUnchanged(actor, roleId, opts.targetUserId)) return;

  if (toGrantSet(target.permissions).has(GRANT_ANY_KEY)) {
    throw new ErrorHandler(
      403,
      `"${target.title}" roli vakolat berish kapabilitysiga ega — uni faqat super_admin biriktiradi`,
    );
  }

  if (hasGrantAny(actor)) return;

  const reason = roleExceedsActor(actor, target);
  if (reason) throw new ErrorHandler(403, reason);
};

const assertTitleAllowed = (actor, title) => {
  if (!title || isSuperAdmin(actor)) return;
  if (RESERVED_TITLES.has(title)) {
    throw new ErrorHandler(
      403,
      `"${title}" — imtiyozli rol nomi, uni faqat super_admin belgilay oladi`,
    );
  }
};

const assertCanGrant = (actor, permissions) => {
  if (!Array.isArray(permissions) || isSuperAdmin(actor)) return;

  const requested = toGrantSet(permissions);

  if (requested.has(GRANT_ANY_KEY)) {
    throw new ErrorHandler(
      403,
      `"${GRANT_ANY_KEY}" — vakolat berish kapabilitysi, uni faqat super_admin bera oladi`,
    );
  }

  if (hasGrantAny(actor)) return;

  const mine = toGrantSet(actor?.role?.permissions);
  const excess = [...requested].filter((k) => !mine.has(k));

  if (excess.length) {
    throw new ErrorHandler(
      403,
      "O'zingizda bo'lmagan huquqni bera olmaysiz: " +
        excess.slice(0, 8).join(", ") +
        (excess.length > 8 ? ` (+${excess.length - 8} ta)` : ""),
    );
  }
};

const assertCanSetScope = (actor, scopeLevel) => {
  if (!scopeLevel || isSuperAdmin(actor) || hasGrantAny(actor)) return;

  const mine = SCOPE_RANK[actor?.role?.scopeLevel] ?? 0;
  const requested = SCOPE_RANK[scopeLevel];
  if (requested === undefined) return;

  if (requested > mine) {
    throw new ErrorHandler(
      403,
      `"${scopeLevel}" doirasi sizning doirangizdan ("${actor?.role?.scopeLevel || "self"}") keng — bera olmaysiz`,
    );
  }
};

const assertRoleEditable = async (actor, roleId) => {
  if (!roleId || isSuperAdmin(actor)) return;

  const currentRoleId = actor?.role?._id || actor?.role;
  if (currentRoleId && String(roleId) === String(currentRoleId)) {
    throw new ErrorHandler(
      403,
      "O'z rolingizni o'zgartira olmaysiz — buni super_admin bajaradi",
    );
  }

  const target = await RoleModel.findById(roleId).select("title").lean();
  if (!target) return;

  if (RESERVED_TITLES.has(target.title)) {
    throw new ErrorHandler(
      403,
      `"${target.title}" rolini o'zgartirish uchun super_admin huquqi kerak`,
    );
  }
};

const assertUserEditable = async (actor, targetUserId) => {
  if (!targetUserId || isSuperAdmin(actor)) return;

  const target = await UserModel.findById(targetUserId)
    .select("role")
    .populate("role", ["title", "permissions", "scopeLevel"])
    .lean();
  if (!target || !target.role) return;

  if (RESERVED_TITLES.has(target.role.title)) {
    throw new ErrorHandler(
      403,
      `"${target.role.title}" rolidagi foydalanuvchini o'zgartirish uchun super_admin huquqi kerak`,
    );
  }

  if (hasGrantAny(actor)) return;
  const grantAdmin = toGrantSet(target.role.permissions).has(GRANT_ANY_KEY);
  if (grantAdmin || roleExceedsActor(actor, target.role)) {
    throw new ErrorHandler(
      403,
      `"${target.role.title}" rolidagi foydalanuvchi vakolati sizdan keng — uni o'zgartira olmaysiz`,
    );
  }
};

const assertCanChangePin = async (actor, targetUserId, pin) => {
  if (pin === undefined || !targetUserId || isSuperAdmin(actor)) return;

  const current = await UserModel.findById(targetUserId).select("+oneIdPin").lean();
  const norm = (v) => (v === null || v === undefined ? "" : String(v).trim());
  if (current && norm(pin) === norm(current.oneIdPin)) return;

  throw new ErrorHandler(
    403,
    "Foydalanuvchining kirish PIN'ini faqat super_admin o'zgartira oladi",
  );
};

module.exports = {
  isSuperAdmin,
  hasGrantAny,
  assertCanAssignRole,
  assertTitleAllowed,
  assertCanGrant,
  assertCanSetScope,
  assertRoleEditable,
  assertUserEditable,
  assertCanChangePin,
};
