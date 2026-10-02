const { ErrorHandler } = require("#shared/error");
const PermissionGroup = require("./permissionGroup.model");
const Permission = require("#modules/4.01-auth/permission/permission.model");

function sortByCode(a, b) {
  const aMatch = String(a.code).match(/^(\d+)\.(\d+)$/);
  const bMatch = String(b.code).match(/^(\d+)\.(\d+)$/);

  if (aMatch && bMatch) {
    const [, aMaj, aMin] = aMatch.map(Number);
    const [, bMaj, bMin] = bMatch.map(Number);
    if (aMaj !== bMaj) return aMaj - bMaj;
    return aMin - bMin;
  }

  if (aMatch && !bMatch) return -1;
  if (!aMatch && bMatch) return 1;

  return String(a.code).localeCompare(String(b.code));
}

module.exports = {
  addGroup: async (req, res, next) => {
    try {
      const doc = await new PermissionGroup(req.body).save();
      return res.status(201).json({
        message: "Permission group yaratildi",
        _id: doc._id,
        code: doc.code,
      });
    } catch (err) {
      if (err.code === 11000) {
        return next(
          new ErrorHandler(400, `code "${req.body.code}" allaqachon mavjud`),
        );
      }
      return next(new ErrorHandler(400, "Yaratishda xatolik", err.message));
    }
  },

  findAllGroups: async (req, res, next) => {
    try {
      const { active, search } = req.query;
      const filter = {};
      if (active !== undefined) filter.active = active === "true";
      if (search) {
        filter.$or = [
          { title: { $regex: new RegExp(search, "i") } },
          { code: { $regex: new RegExp(search, "i") } },
        ];
      }

      const docs = await PermissionGroup.find(filter, {
        createdAt: 0,
        updatedAt: 0,
      }).lean();

      docs.sort(sortByCode);

      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Olishda xatolik", err.message));
    }
  },

  paginateGroups: async (req, res, next) => {
    try {
      const { active, search, page = 1, limit = 50 } = req.query;
      const filter = {};
      if (active !== undefined) filter.active = active === "true";
      if (search) {
        filter.$or = [
          { title: { $regex: new RegExp(search, "i") } },
          { code: { $regex: new RegExp(search, "i") } },
        ];
      }

      const result = await PermissionGroup.paginate(filter, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { code: 1 },
        select: "-createdAt -updatedAt",
      });

      if (result?.docs) result.docs.sort(sortByCode);

      return res.status(200).json(result);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalashda xatolik", err.message));
    }
  },

  findOneGroup: async (req, res, next) => {
    try {
      const doc = await PermissionGroup.findById(req.params.id, {
        createdAt: 0,
        updatedAt: 0,
      }).lean();
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Olishda xatolik", err.message));
    }
  },

  getGroupPermissions: async (req, res, next) => {
    try {
      const docs = await Permission.find(
        { groups: req.params.id, active: true },
        { section: 1, title: 1, actionKeys: 1 },
      )
        .sort({ section: 1 })
        .exec();

      if (!docs)
        return res.status(404).json({ message: "Permission topilmadi" });

      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Olishda xatolik", err.message));
    }
  },

  getGroupedTree: async (req, res, next) => {
    try {
      const groups = await PermissionGroup.find(
        { active: true },
        { code: 1, title: 1, desc: 1 },
      ).lean();

      groups.sort(sortByCode);

      const allPermissions = await Permission.find(
        { active: true },
        { section: 1, title: 1, actionKeys: 1, groups: 1 },
      ).lean();

      const byGroupId = new Map();
      const ungrouped = [];
      for (const perm of allPermissions) {
        const item = {
          section: perm.section,
          title: perm.title,
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

      return res.status(200).json(groupTree);
    } catch (err) {
      return next(new ErrorHandler(400, "Tree olishda xatolik", err.message));
    }
  },

  updateGroup: async (req, res, next) => {
    try {
      const doc = await PermissionGroup.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "Yangilandi" });
    } catch (err) {
      if (err.code === 11000) {
        return next(
          new ErrorHandler(400, `code "${req.body.code}" allaqachon mavjud`),
        );
      }
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  deleteGroup: async (req, res, next) => {
    try {
      const doc = await PermissionGroup.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      const linkedCount = await Permission.countDocuments({ group: doc._id });
      if (linkedCount > 0) {
        await Permission.updateMany(
          { group: doc._id },
          { $set: { group: null } },
        );
      }

      await PermissionGroup.findByIdAndDelete(req.params.id);
      return res.status(200).json({
        message: `O'chirildi. ${linkedCount} ta permission ungrouped'ga o'tkazildi`,
        _id: doc._id,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xatolik", err.message));
    }
  },
};
