const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");
const FacultyModel = require("#references/faculty/faculty.model");
const DepartmentModel = require("#references/department/department.model");

module.exports = {
  faculties: async (req, res, next) => {
    try {
      const docs = await FacultyModel.find({}, { title: 1 }).sort({ title: 1 }).lean();
      return res.status(200).json(docs.map((d) => ({ _id: d._id, name: d.title })));
    } catch (err) {
      return next(err);
    }
  },

  departments: async (req, res, next) => {
    try {
      const docs = await DepartmentModel.find({}, { title: 1, faculty: 1 })
        .sort({ title: 1 })
        .lean();
      return res.status(200).json(
        docs.map((d) => ({
          _id: d._id,
          name: d.title,
          faculty: d.faculty ? String(d.faculty) : null,
        })),
      );
    } catch (err) {
      return next(err);
    }
  },

  teachers: async (req, res, next) => {
    try {
      const role = await mongoose
        .model("role")
        .findOne({ title: ROLES.OQITUVCHI })
        .select("_id")
        .lean();
      const docs = role
        ? await mongoose
            .model("user")
            .find({ role: role._id }, { firstName: 1, lastName: 1 })
            .sort({ lastName: 1 })
            .lean()
        : [];
      return res.status(200).json(
        docs.map((d) => ({
          _id: d._id,
          name: [d.lastName, d.firstName].filter(Boolean).join(" "),
        })),
      );
    } catch (err) {
      return next(err);
    }
  },

  signers: async (req, res, next) => {
    try {
      const BY_KEY = {
        kotib: ROLES.ILMIY_KENGASH_KOTIBI,
        rektor: ROLES.REKTOR,
        prorektor: ROLES.PROREKTOR,
      };
      const titles = Object.values(BY_KEY);
      const roles = await mongoose
        .model("role")
        .find({ title: { $in: titles } }, { title: 1 })
        .lean();
      const users = roles.length
        ? await mongoose
            .model("user")
            .find(
              { role: { $in: roles.map((r) => r._id) }, active: true },
              { firstName: 1, lastName: 1, role: 1 },
            )
            .sort({ lastName: 1 })
            .lean()
        : [];

      const idByTitle = new Map(roles.map((r) => [r.title, String(r._id)]));
      const out = {};
      Object.entries(BY_KEY).forEach(([key, title]) => {
        const roleId = idByTitle.get(title);
        out[key] = roleId
          ? users
              .filter((u) => String(u.role) === roleId)
              .map((u) => ({
                _id: u._id,
                name: [u.lastName, u.firstName].filter(Boolean).join(" "),
              }))
          : [];
      });
      return res.status(200).json(out);
    } catch (err) {
      return next(err);
    }
  },
};
