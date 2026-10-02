const jwt = require("jsonwebtoken");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const { ROLE_PERMISSIONS } = require("#modules/4.02-studyLoad/studyLoad.permissions");

const toPermissionsArray = (sections) =>
  Object.entries(sections || {}).map(([section, actionKeys]) => ({
    section,
    actionKeys,
  }));

const createAuthedUser = async (roleTitle, userOverrides = {}) => {
  const roleDef = ROLE_PERMISSIONS[roleTitle];
  if (!roleDef) {
    throw new Error(
      `createAuthedUser(): "${roleTitle}" uchun studyLoad.permissions.js ROLE_PERMISSIONS'da ta'rif topilmadi`,
    );
  }

  const role = await RoleModel.create({
    title: roleTitle,
    desc: roleDef.desc,
    permissions: toPermissionsArray(roleDef.sections),
    scopeLevel: roleDef.scopeLevel,
    isSystem: roleDef.isSystem,
    active: roleDef.active,
  });

  const user = await UserModel.create({
    firstName: "Test",
    lastName: roleTitle,
    role: role._id,
    active: true,
    ...userOverrides,
  });

  const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  return { user, role, token };
};

module.exports = { createAuthedUser, toPermissionsArray };
