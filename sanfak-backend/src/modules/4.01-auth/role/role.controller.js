const { ErrorHandler } = require("#shared/error");
const RoleMode = require("./role.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const PermissionModel = require("#modules/4.01-auth/permission/permission.model");
const PermissionGroupModel = require("#modules/4.01-auth/permissionGroup/permissionGroup.model");
const { MODULES, ACTIONS } = require("#config/constants");
const { SECTION_ALIASES } = require("./role.validation");
const {
  assertTitleAllowed,
  assertCanGrant,
  assertCanSetScope,
  assertRoleEditable,
} = require("#modules/4.01-auth/_shared/escalationGuard");
const { logGrantChange } = require("#modules/4.01-auth/_shared/grantAudit");

module.exports = {
  addRole: async (req, res, next) => {
    try {
      assertTitleAllowed(req.user, req.body?.title);
      assertCanGrant(req.user, req.body?.permissions);
      assertCanSetScope(req.user, req.body?.scopeLevel);

      const doc = new RoleMode(req.body);
      await doc.save();

      await logGrantChange({
        req,
        roleId: doc._id,
        before: null,
        after: doc.toObject(),
        action: "role:created",
      });

      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(new ErrorHandler(400, "Failed to add new role", err.message));
    }
  },

  findAllRoles: async (req, res, next) => {
    try {
      const { search } = req.query;
      let data = {};
      if (search) data["title"] = { $regex: new RegExp(search, "i") };

      const docs = await RoleMode.find(data, {
        createdAt: 0,
        updatedAt: 0,
      })

        .exec();

      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find roles", err.message));
    }
  },

  paginateRoles: async (req, res, next) => {
    try {
      const { search, page, limit } = req.query;
      let data = {};
      if (search) data["title"] = { $regex: new RegExp(search, "i") };

      const options = {
        limit: parseInt(limit),
        page: parseInt(page),
        select: ["-createdAt", "-updatedAt"],
      };
      const doc = await RoleMode.paginate(data, options);

      if (!doc) return res.status(404).json({ message: "not found" });

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate roles", err.message),
      );
    }
  },

  findOneRole: async (req, res, next) => {
    try {
      const doc = await RoleMode.findById(req.params.id, {
        createdAt: 0,
        updatedAt: 0,
      })

        .exec();

      if (!doc) {
        return next(new ErrorHandler(404, "Role not found"));
      }

      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find role", err.message));
    }
  },

  updateRole: async (req, res, next) => {
    try {
      await assertRoleEditable(req.user, req.params.id);
      assertTitleAllowed(req.user, req.body?.title);
      assertCanGrant(req.user, req.body?.permissions);
      assertCanSetScope(req.user, req.body?.scopeLevel);

      const before = await RoleMode.findById(req.params.id).lean();

      const doc = await RoleMode.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });

      if (!doc) {
        return next(new ErrorHandler(404, "Role not found"));
      }

      await logGrantChange({
        req,
        roleId: doc._id,
        before,
        after: doc.toObject(),
        action: "role:grantsChanged",
      });

      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(new ErrorHandler(400, "Failed to update role", err.message));
    }
  },

  deleteRole: async (req, res, next) => {
    try {
      await assertRoleEditable(req.user, req.params.id);

      const usersWithRole = await UserModel.countDocuments({
        role: req.params.id,
      });

      if (usersWithRole > 0) {
        return next(
          new ErrorHandler(
            400,
            `Bu rolda ${usersWithRole} ta foydalanuvchi mavjud`,
          ),
        );
      }

      const doc = await RoleMode.findByIdAndDelete(req.params.id);

      if (!doc) {
        return next(new ErrorHandler(404, "Role not found"));
      }

      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(new ErrorHandler(400, "Failed to delete role", err.message));
    }
  },

  getSectionsMetadata: async (req, res, next) => {
    try {
      const permissions = await PermissionModel.find({ active: true })
        .select("section title actionKeys")
        .lean();

      const sections = permissions.map((p) => ({
        section: p.section,
        title: p.title || p.section,
        actionKeys: p.actionKeys || [],
      }));

      return res.status(200).json({
        sections,
        actions: Object.values(ACTIONS),
        aliases: SECTION_ALIASES,
        total: sections.length,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Sections olishda xatolik", err.message),
      );
    }
  },

  getSectionsGrouped: async (req, res, next) => {
    try {
      const groups = await PermissionGroupModel.find(
        { active: true },
        { code: 1, title: 1, desc: 1 },
      ).lean();

      groups.sort((a, b) => {
        const am = String(a.code).match(/^(\d+)\.(\d+)$/);
        const bm = String(b.code).match(/^(\d+)\.(\d+)$/);
        if (am && bm) {
          const [, aMaj, aMin] = am.map(Number);
          const [, bMaj, bMin] = bm.map(Number);
          if (aMaj !== bMaj) return aMaj - bMaj;
          return aMin - bMin;
        }
        if (am && !bm) return -1;
        if (!am && bm) return 1;
        return String(a.code).localeCompare(String(b.code));
      });

      const permissions = await PermissionModel.find(
        { active: true },
        { section: 1, title: 1, actionKeys: 1, groups: 1 },
      ).lean();

      const byGroupId = new Map();
      const ungrouped = [];
      for (const perm of permissions) {
        const item = {
          section: perm.section,
          title: perm.title || perm.section,
          actionKeys: perm.actionKeys || [],
        };
        const groups = perm.groups || [];
        if (groups.length === 0) {
          ungrouped.push(item);
        } else {
          for (const gid of groups) {
            const key = String(gid);
            if (!byGroupId.has(key)) byGroupId.set(key, []);
            byGroupId.get(key).push(item);
          }
        }
      }

      const groupTree = groups.map((g) => ({
        _id: g._id,
        code: g.code,
        title: g.title,
        desc: g.desc,
        permissions: (byGroupId.get(String(g._id)) || []).sort((a, b) =>
          a.section.localeCompare(b.section),
        ),
      }));

      ungrouped.sort((a, b) => a.section.localeCompare(b.section));

      return res.status(200).json({
        groups: groupTree,
        ungrouped,
        actions: Object.values(ACTIONS),
        aliases: SECTION_ALIASES,
        totalGroups: groupTree.length,
        totalPermissions: permissions.length,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Grouped sections olishda xatolik", err.message),
      );
    }
  },

  getUserPermissions: async (req, res, next) => {
    try {
      const user = await UserModel.findById(req.params.id).populate("role");
      if (!user)
        return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (!user.role)
        return res.status(404).json({ message: "Rol biriktirilmagan" });
      return res.status(200).json(user.role.permissions);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ruxsatlarni olishda xatolik", err.message),
      );
    }
  },
};
