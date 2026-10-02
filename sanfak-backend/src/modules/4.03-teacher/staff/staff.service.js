"use strict";

const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const Department = require("#references/department/department.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const winston = require("#shared/winston.logger");

const SELECT = "-refreshToken -oneIdPin -eriCertificate";

const POPULATE = [
  {
    path: "department",
    select: "title faculty",
    populate: { path: "faculty", select: "title" },
    strictPopulate: false,
  },
  { path: "position", select: "title", strictPopulate: false },
  { path: "academicTitle", select: "title", strictPopulate: false },
];

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getOqituvchiRoleId = async () => {
  const role = await Role.findOne({ title: ROLES.OQITUVCHI })
    .select("_id")
    .lean();
  if (!role) {
    throw new ErrorHandler(
      500,
      "`oqituvchi` roli DBda topilmadi — seed:permissions ishga tushirilganmi?",
    );
  }
  return role._id;
};

const facultyDepartmentIds = async (facultyId) => {
  const depts = await Department.find({ faculty: facultyId })
    .select("_id")
    .lean();
  return depts.map((d) => d._id);
};

const buildFilter = async (query = {}) => {
  const { search, faculty, department, position, active } = query;
  const filter = {
    role: await getOqituvchiRoleId(),
    active: active !== undefined ? active : true,
  };

  if (department) {
    filter.department = department;
  } else if (faculty) {
    filter.department = { $in: await facultyDepartmentIds(faculty) };
  }

  if (position) filter.position = position;

  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { firstName: re },
      { lastName: re },
      { middleName: re },
    ];
  }

  return filter;
};

const PROFILE_FIELD_MAP = {
  department: "department",
  position: "position",
  jshshir: "jshshir",
  birthDate: "birthDate",
  address: "address",
  employmentType: "employmentType",
  passportSeria: "passportSeries",
  passportNumber: "passportNumber",
  googleScholar: "googleScholarUrl",
  scopus: "scopusUrl",
  teachingSpecialtyName: "teachingSpecialtyName",
  teachingSpecialtyCode: "teachingSpecialtyCode",
  teachingSpecialtyBasis: "teachingSpecialtyBasis",
  teachingSpecialtyNote: "teachingSpecialtyNote",
};

const PROFILE_ONLY_FIELDS = [
  "jshshir",
  "birthDate",
  "address",
  "employmentType",
  "faculty",
  "teachingSpecialtyName",
  "teachingSpecialtyCode",
  "teachingSpecialtyBasis",
  "teachingSpecialtyNote",
];

const pickProfileFields = (body = {}) => {
  const out = {};
  for (const [bodyKey, profileKey] of Object.entries(PROFILE_FIELD_MAP)) {
    if (body[bodyKey] !== undefined) out[profileKey] = body[bodyKey];
  }
  return out;
};

const pickUserFields = (body = {}) => {
  const out = { ...body };
  PROFILE_ONLY_FIELDS.forEach((f) => delete out[f]);
  return out;
};

const assertOqituvchi = async (id) => {
  const roleId = await getOqituvchiRoleId();
  const user = await User.findById(id).select("role");
  if (!user) throw new ErrorHandler(404, "Xodim topilmadi");
  if (String(user.role) !== String(roleId)) {
    throw new ErrorHandler(
      403,
      "Bu foydalanuvchi `oqituvchi` rolida emas — kadrlar bo'limi faqat o'qituvchilarni boshqaradi",
    );
  }
};

module.exports = {
  buildFilter,
  getOqituvchiRoleId,
  assertOqituvchi,
  pickProfileFields,
  pickUserFields,

  findAll: async (query) => {
    const filter = await buildFilter(query);
    return User.find(filter, SELECT)
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .lean();
  },

  paginate: async (query) => {
    const filter = await buildFilter(query);
    const options = {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
      select: SELECT,
      populate: POPULATE,
      sort: { createdAt: -1 },
      lean: true,
    };
    return User.paginate(filter, options);
  },

  findOne: async (id) => {
    const roleId = await getOqituvchiRoleId();
    const user = await User.findOne({ _id: id, role: roleId }, SELECT)
      .populate(POPULATE)
      .lean();
    if (!user) return null;

    const profile = await TeacherProfile.findOne(
      { user: id },
      "jshshir birthDate address employmentType teachingSpecialtyName teachingSpecialtyCode teachingSpecialtyBasis teachingSpecialtyNote",
    ).lean();

    return {
      ...user,
      jshshir: profile?.jshshir ?? null,
      birthDate: profile?.birthDate ?? null,
      address: profile?.address ?? null,
      employmentType: profile?.employmentType ?? null,
      teachingSpecialtyName: profile?.teachingSpecialtyName ?? null,
      teachingSpecialtyCode: profile?.teachingSpecialtyCode ?? null,
      teachingSpecialtyBasis: profile?.teachingSpecialtyBasis ?? null,
      teachingSpecialtyNote: profile?.teachingSpecialtyNote ?? null,
    };
  },

  create: async (body) => {
    const { role: _role, oneIdPin: _pin, ...rest } = body;
    const userFields = pickUserFields(rest);
    const roleId = await getOqituvchiRoleId();
    const doc = new User({
      ...userFields,
      role: roleId,
      active: userFields.active !== undefined ? userFields.active : true,
    });
    await doc.save();

    try {
      await new TeacherProfile({
        user: doc._id,
        ...pickProfileFields(body),
        hrApprovalStatus: "pending",
      }).save();
    } catch (err) {
      winston.error(
        `[staff] teacherProfile yaratilmadi, user (${doc._id}) kompensatsiya bilan o'chirilmoqda: ${err.message}`,
      );
      await User.findByIdAndDelete(doc._id);

      if (err.code === 11000) {
        throw new ErrorHandler(
          409,
          "Bu foydalanuvchi uchun profil allaqachon mavjud",
          err.message,
        );
      }
      throw new ErrorHandler(
        400,
        "Xodim profili yaratishda xatolik — xodim yaratilmadi",
        err.message,
      );
    }

    return doc;
  },

  update: async (id, body) => {
    await assertOqituvchi(id);
    const roleId = await getOqituvchiRoleId();
    const { role: _role, oneIdPin: _pin, degrees, ...rest } = body;
    const otherFields = pickUserFields(rest);

    const updateQuery = { $set: otherFields };
    if (degrees) {
      Object.keys(degrees).forEach((degreeType) => {
        if (degrees[degreeType]?.length > 0) {
          updateQuery.$push = {
            ...updateQuery.$push,
            [`degrees.${degreeType}`]: { $each: degrees[degreeType] },
          };
        }
      });
    }

    const doc = await User.findOneAndUpdate(
      { _id: id, role: roleId },
      updateQuery,
      { new: true },
    );

    if (doc) {
      const profileFields = pickProfileFields(body);
      if (Object.keys(profileFields).length > 0) {
        await TeacherProfile.findOneAndUpdate(
          { user: id },
          { $set: profileFields },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
      }
    }

    return doc;
  },

  remove: async (id) => {
    await assertOqituvchi(id);
    const roleId = await getOqituvchiRoleId();
    const doc = await User.findOneAndUpdate(
      { _id: id, role: roleId },
      { active: false },
      { new: true },
    );

    if (doc) {
      await TeacherProfile.findOneAndUpdate(
        { user: id },
        { active: false },
      );
    }

    return doc;
  },

  restore: async (id) => {
    await assertOqituvchi(id);
    const roleId = await getOqituvchiRoleId();

    const user = await User.findOne({ _id: id, role: roleId }).select("active");
    if (!user) return null;
    if (user.active) {
      throw new ErrorHandler(400, "Bu xodim allaqachon faol");
    }

    const doc = await User.findOneAndUpdate(
      { _id: id, role: roleId },
      { active: true },
      { new: true },
    );

    await TeacherProfile.findOneAndUpdate({ user: id }, { active: true });

    return doc;
  },

  exportRows: async (query) => {
    const filter = await buildFilter(query);
    const docs = await User.find(filter, SELECT)
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .lean();

    return docs.map((u) => ({
      fullName: [u.lastName, u.firstName, u.middleName]
        .filter(Boolean)
        .join(" "),
      email: u.email || "",
      position: u.position?.title || "",
      department: u.department?.title || "",
      faculty: u.department?.faculty?.title || "",
      phone: u.phone || "",
      date: u.createdAt
        ? new Date(u.createdAt).toLocaleDateString("uz-UZ")
        : "",
    }));
  },
};
