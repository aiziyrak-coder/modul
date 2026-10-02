const { ErrorHandler } = require("#shared/error");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseActive = (raw) => (raw === undefined ? true : raw === "true" || raw === true);

function createCrudService({
  model,
  notFound,
  searchFields = [],
  filterFields = [],
  populate = [],
  sort = { createdAt: -1 },
}) {
  function buildQuery(query = {}) {
    const q = { active: parseActive(query.active) };

    if (query.search && searchFields.length) {
      const rx = new RegExp(escapeRegex(query.search), "i");
      q.$or = searchFields.map((f) => ({ [f]: { $regex: rx } }));
    }

    for (const field of filterFields) {
      const value = query[field];
      if (value !== undefined && value !== null && value !== "") q[field] = value;
    }

    return q;
  }

  async function list(query) {
    return model.find(buildQuery(query)).sort(sort).populate(populate).lean();
  }

  async function paginate(query) {
    return model.paginate(buildQuery(query), {
      page: Number(query.page),
      limit: Number(query.limit),
      sort,
      populate,
      lean: true,
    });
  }

  async function getDoc(id) {
    const doc = await model.findById(id);
    if (!doc || !doc.active) throw new ErrorHandler(404, notFound);
    return doc;
  }

  async function findById(id) {
    const doc = await model.findById(id).populate(populate).lean();
    if (!doc || !doc.active) throw new ErrorHandler(404, notFound);
    return doc;
  }

  async function create(payload) {
    return model.create(payload);
  }

  async function update(id, payload) {
    const doc = await getDoc(id);
    Object.assign(doc, payload);
    await doc.save();
    return doc;
  }

  async function softDelete(id) {
    const doc = await getDoc(id);
    doc.active = false;
    await doc.save();
    return doc;
  }

  return { buildQuery, list, paginate, findById, getDoc, create, update, softDelete };
}

module.exports = { createCrudService, escapeRegex, parseActive };
