#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const [, , moduleFolder, entity, urlPrefixArg, rbacKey] = process.argv;

if (!moduleFolder || !entity || !urlPrefixArg || !rbacKey) {
  console.error(
    "❌ Ishlatish: node scripts/new-module.js <moduleFolder> <entity> <urlPrefix> <RBAC_KEY>\n" +
      "   Misol:   node scripts/new-module.js 4.14-library book /books BOOK",
  );
  process.exit(1);
}

const cleanSeg = urlPrefixArg.split(/[\\/]/).filter(Boolean).pop();
const urlPrefix = `/${cleanSeg}`;
const Entity = entity.charAt(0).toUpperCase() + entity.slice(1);
const rbacValue = rbacKey
  .toLowerCase()
  .replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const baseDir = path.join(__dirname, "..", "src", "modules", moduleFolder);
const entityDir = path.join(baseDir, entity);

if (fs.existsSync(entityDir)) {
  console.error(`❌ Allaqachon mavjud: ${path.relative(process.cwd(), entityDir)}`);
  process.exit(1);
}
fs.mkdirSync(entityDir, { recursive: true });

const T = {
  model: `const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const ${Entity}Schema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

${Entity}Schema.plugin(mongoosePaginate);

module.exports = mongoose.model("${entity}", ${Entity}Schema);
`,

  validation: `const Joi = require("joi");
const {
  multiLangSchema,
  multiLangOptional,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");

const createSchema = Joi.object({
  title: multiLangSchema,
  desc: multiLangOptional,
  active: Joi.boolean().optional(),
});

const updateSchema = Joi.object({
  title: multiLangOptional,
  desc: multiLangOptional,
  active: Joi.boolean().optional(),
});

module.exports = { createSchema, updateSchema, findAll, paginate, readSchema, deleteSchema };
`,

  service: `const ${Entity} = require("./${entity}.model");
const { buildPlainSearch, applyFilters } = require("#shared/searchFilter");
const { PAGINATION } = require("#config/constants");

const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const FILTER_FIELDS = ["active"];

const filterFrom = (query) => ({
  ...buildPlainSearch("title", query.search),
  ...applyFilters(query, FILTER_FIELDS),
});

module.exports = {
  create: (body) => new ${Entity}(body).save(),
  findAll: (query) => ${Entity}.find(filterFrom(query), EXCLUDE).exec(),
  paginate: (query) =>
    ${Entity}.paginate(filterFrom(query), {
      page: Math.max(parseInt(query.page) || PAGINATION.DEFAULT_PAGE, 1),
      limit: Math.min(parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT),
      select: EXCLUDE,
      lean: true,
    }),
  findOne: (id) => ${Entity}.findById(id, EXCLUDE).exec(),
  update: (id, body) => ${Entity}.findByIdAndUpdate(id, body, { new: true }),
  remove: (id) => ${Entity}.findByIdAndDelete(id),
};
`,

  controller: `const { ErrorHandler } = require("#shared/error");
const service = require("./${entity}.service");

module.exports = {
  create: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      return res.status(201).json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to create ${entity}", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const docs = await service.findAll(req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find ${entity}", err.message));
    }
  },

  paginate: async (req, res, next) => {
    try {
      const result = await service.paginate(req.query);
      return res.status(200).json(result);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to paginate ${entity}", err.message));
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "${entity} not found"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find ${entity}", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return next(new ErrorHandler(404, "${entity} not found"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to update ${entity}", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "${entity} not found"));
      return res.status(200).json({ message: \`successfully deleted \${doc._id}\` });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to delete ${entity}", err.message));
    }
  },
};
`,

  routes: `const router = require("express").Router();
const validator = require("express-joi-validation").createValidator({});
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./${entity}.controller");
const {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./${entity}.validation");

router.use(authenticate);

const M = MODULES.${rbacKey};

router.post("/", permit(M, [ACTIONS.CREATE]), validator.body(createSchema), Controller.create);
router.get("/", permit(M, [ACTIONS.READ_ALL]), validator.query(findAll), Controller.findAll);
router.get("/paginate", permit(M, [ACTIONS.READ_ALL]), validator.query(paginate), Controller.paginate);
router.get("/:id", permit(M, [ACTIONS.READ]), validator.params(readSchema), Controller.findOne);
router.put("/:id", permit(M, [ACTIONS.UPDATE]), validator.params(readSchema), validator.body(updateSchema), Controller.update);
router.delete("/:id", permit(M, [ACTIONS.DELETE]), validator.params(deleteSchema), Controller.delete);

module.exports = router;
`,
};

for (const [kind, content] of Object.entries(T)) {
  const ext = kind === "model" || kind === "service" ? kind : kind;
  const name = `${entity}.${kind}.js`;
  fs.writeFileSync(path.join(entityDir, name), content);
}

const indexPath = path.join(baseDir, "index.js");
const mountLine = `router.use("${urlPrefix}", require("./${entity}/${entity}.routes"));`;
if (fs.existsSync(indexPath)) {
  let idx = fs.readFileSync(indexPath, "utf8");
  if (!idx.includes(mountLine)) {
    idx = idx.replace(
      /module\.exports = router;/,
      `${mountLine}\n\nmodule.exports = router;`,
    );
    fs.writeFileSync(indexPath, idx);
  }
} else {
  fs.writeFileSync(
    indexPath,
    `const router = require("express").Router();\n\n${mountLine}\n\nmodule.exports = router;\n`,
  );
}

const rel = (p) => path.relative(process.cwd(), p);
console.log(`✅ Yaratildi: src/modules/${moduleFolder}/${entity}/ (5 fayl) + index.js`);
console.log(`   URL: /api${urlPrefix}  (auto-discovery o'zi ulaydi — router.js tegmaydi)\n`);
console.log("📋 QOLGAN 2 QADAM (RBAC — qo'lda):");
console.log(`   1) src/config/constants.js -> MODULES ga qo'shing:`);
console.log(`        ${rbacKey}: "${rbacValue}",`);
console.log(`   2) Permission seed + role'ga biriktiring:`);
console.log(`        npm run seed:permissions   (yoki tegishli seed)`);
console.log(`\n   Keyin: npm run dev  -> /api${urlPrefix} ishlaydi.`);
