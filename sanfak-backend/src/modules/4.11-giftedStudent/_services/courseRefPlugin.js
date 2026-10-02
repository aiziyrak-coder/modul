const winston = require("#shared/winston.logger");
const CourseModel = require("#references/course/course.model");

const TTL_MS = 60 * 1000;
const cache = { byNumber: null, byId: null, loadedAt: 0 };

const HEX24 = /^[0-9a-fA-F]{24}$/;

const numberFromTitle = (title) => {
  const m = String(title ?? "").match(/^(\d+)-kurs$/);
  return m ? parseInt(m[1], 10) : null;
};

const loadIndex = async () => {
  const now = Date.now();
  if (cache.byNumber && now - cache.loadedAt < TTL_MS) return cache;

  const rows = await CourseModel.find({}).select("title").lean();
  const byNumber = new Map();
  const byId = new Map();
  for (const r of rows) {
    const n = numberFromTitle(r.title);
    if (n === null) continue;
    byId.set(String(r._id), n);
    if (byNumber.has(n)) {
      winston.warn(`[4.11 courseId] ma'lumotnomada takroriy kurs raqami: ${n}`);
      continue;
    }
    byNumber.set(n, r._id);
  }
  cache.byNumber = byNumber;
  cache.byId = byId;
  cache.loadedAt = now;
  return cache;
};

const clearCache = () => {
  cache.byNumber = null;
  cache.byId = null;
  cache.loadedAt = 0;
};

const normalizeInput = async (value) => {
  if (value === null || value === undefined || value === "") {
    return { number: null, ref: null };
  }
  const raw = String(value);
  const idx = await loadIndex();

  if (HEX24.test(raw)) {
    const n = idx.byId.get(raw);
    if (n === undefined) return null;
    return { number: n, ref: idx.byNumber.get(n) ?? null };
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) return { number: null, ref: null };
  return { number: n, ref: idx.byNumber.get(n) ?? null };
};

const writableContainers = (update, key) => {
  const out = [];
  if (Object.hasOwn(update, key)) out.push(update);
  for (const c of ["$set", "$setOnInsert"]) {
    if (update[c] && Object.hasOwn(update[c], key)) out.push(update[c]);
  }
  return out;
};

const blindOperatorTouching = (update, key, ops) => {
  for (const op of ops) {
    if (update[op] && Object.hasOwn(update[op], key)) return op;
  }
  return null;
};

const SCALAR_BLIND_OPS = ["$inc", "$mul", "$min", "$max", "$rename", "$unset"];

const ARRAY_BLIND_OPS = [
  "$push",
  "$addToSet",
  "$pull",
  "$pullAll",
  "$pop",
  "$rename",
  "$unset",
];

const blindWriteError = (op, key, refKey) =>
  new Error(
    `[4.11 courseRef] "${key}" maydoniga "${op}" bilan yozib bo'lmaydi — ` +
      `qiymat ko'rinmagani uchun "${refKey}" yangilanmay ESKIRIB qoladi. ` +
      `"$set" ishlating (yillik ko'tarishda kurs bo'yicha, yuqoridan pastga: ` +
      `updateMany({course: N}, {$set: {course: N + 1}})).`,
  );

const unresolvedError = (value) =>
  new Error(
    `[4.11 courseId] "course" qiymati ma'lumotnomada topilmadi: ` +
      `${JSON.stringify(value)} — kurs raqami yoki mavjud kurs _id si yuboring.`,
  );

const courseRefPlugin = (schema) => {
  schema.pre("save", async function preSaveCourseId(next) {
    if (!this.isModified("course")) return next();
    try {
      const norm = await normalizeInput(this.course);
      if (!norm) {
        return next(unresolvedError(this.course));
      }
      this.course = norm.number;
      this.courseId = norm.ref;
    } catch (err) {
      winston.warn(`[4.11 courseId] pre-save: ${err.message}`);
    }
    return next();
  });

  schema.pre(
    ["findOneAndUpdate", "updateOne", "updateMany"],
    async function preUpdateCourseId(next) {
      const update = this.getUpdate();
      if (!update) return next();

      const blind = blindOperatorTouching(update, "course", SCALAR_BLIND_OPS);
      if (blind) return next(blindWriteError(blind, "course", "courseId"));

      const targets = writableContainers(update, "course");
      if (!targets.length) return next();

      try {
        for (const target of targets) {
          const norm = await normalizeInput(target.course);
          if (!norm) return next(unresolvedError(target.course));
          target.course = norm.number;
          target.courseId = norm.ref;
        }
        this.setUpdate(update);
      } catch (err) {
        winston.warn(`[4.11 courseId] pre-update: ${err.message}`);
      }
      return next();
    },
  );
};

const normalizeList = async (values) => {
  const list = [];
  const refs = [];
  for (const v of values ?? []) {
    const norm = await normalizeInput(v);
    if (!norm) {
      list.push(String(v));
      continue;
    }
    list.push(norm.number === null ? String(v) : String(norm.number));
    if (norm.ref) refs.push(norm.ref);
  }
  return { list, refs };
};

const allowedCoursesRefPlugin = (schema) => {
  schema.pre("save", async function preSaveAllowedCourses(next) {
    if (!this.isModified("allowedCourses")) return next();
    try {
      const { list, refs } = await normalizeList(this.allowedCourses);
      this.allowedCourses = list;
      this.allowedCourseIds = refs;
    } catch (err) {
      winston.warn(`[4.11 allowedCourseIds] pre-save: ${err.message}`);
    }
    return next();
  });

  schema.pre(
    ["findOneAndUpdate", "updateOne", "updateMany"],
    async function preUpdateAllowedCourses(next) {
      const update = this.getUpdate();
      if (!update) return next();

      const blind = blindOperatorTouching(
        update,
        "allowedCourses",
        ARRAY_BLIND_OPS,
      );
      if (blind) {
        return next(blindWriteError(blind, "allowedCourses", "allowedCourseIds"));
      }

      const targets = writableContainers(update, "allowedCourses");
      if (!targets.length) return next();

      try {
        for (const target of targets) {
          const { list, refs } = await normalizeList(target.allowedCourses);
          target.allowedCourses = list;
          target.allowedCourseIds = refs;
        }
        this.setUpdate(update);
      } catch (err) {
        winston.warn(`[4.11 allowedCourseIds] pre-update: ${err.message}`);
      }
      return next();
    },
  );
};

module.exports = courseRefPlugin;
module.exports.allowedCoursesRefPlugin = allowedCoursesRefPlugin;
module.exports.normalizeInput = normalizeInput;
module.exports.normalizeList = normalizeList;
module.exports.numberFromTitle = numberFromTitle;
module.exports.clearCache = clearCache;
module.exports.HEX24 = HEX24;
