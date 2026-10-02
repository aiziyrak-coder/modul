const mongoose = require("mongoose");
const Grant = require("./taskAssigneeGrant.model");
const service = require("./taskAssigneeGrant.service");

const ASSIGNER = new mongoose.Types.ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa");
const oid = (n) => new mongoose.Types.ObjectId(String(n).padStart(24, "0"));

const GRANTS = [1, 2, 3, 4, 5].map((n) => ({ assigner: ASSIGNER, assignee: oid(n) }));
const LIVE_USERS = [1, 2, 3].map((n) => ({ _id: oid(n) }));

const resolvePath = (doc, path) =>
  path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), doc);

const matches = (doc, cond) =>
  Object.entries(cond).every(([key, expected]) => {
    const value = resolvePath(doc, key);
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if ("$in" in expected) {
        return expected.$in.some((v) => String(v) === String(value));
      }
      if ("$exists" in expected) return (value !== undefined) === expected.$exists;
      throw new Error(`fake-db: noma'lum operator: ${Object.keys(expected)}`);
    }
    return String(value) === String(expected);
  });

const runAggregate = (pipeline, { users }) => {
  let docs = GRANTS.map((g) => ({ ...g }));
  for (const stage of pipeline) {
    if (stage.$match) {
      docs = docs.filter((d) => matches(d, stage.$match));
    } else if (stage.$lookup) {
      const { from, localField, foreignField, as } = stage.$lookup;
      if (from !== "users") throw new Error(`fake-db: kutilmagan kolleksiya: ${from}`);
      docs = docs.map((d) => ({
        ...d,
        [as]: users.filter((u) => String(u[foreignField]) === String(d[localField])),
      }));
    } else if (stage.$group) {
      const { _id: key, ...acc } = stage.$group;
      if (Object.keys(acc).length !== 1 || acc.count?.$sum !== 1) {
        throw new Error("fake-db: faqat `count: {$sum: 1}` qo'llab-quvvatlanadi");
      }
      const buckets = new Map();
      docs.forEach((d) => {
        const k = String(resolvePath(d, key.replace(/^\$/, "")));
        buckets.set(k, (buckets.get(k) || 0) + 1);
      });
      docs = [...buckets].map(([_id, count]) => ({ _id, count }));
    } else {
      throw new Error(`fake-db: qo'llab-quvvatlanmaydigan bosqich: ${Object.keys(stage)[0]}`);
    }
  }
  return docs;
};

const callListAssigners = ({ users }) => {
  jest.spyOn(mongoose, "model").mockReturnValue({
    paginate: jest.fn().mockResolvedValue({
      docs: [{ _id: ASSIGNER, firstName: "Bekzod", lastName: "Rahimov" }],
      totalDocs: 1,
      page: 1,
      limit: 20,
    }),
  });
  jest
    .spyOn(Grant, "aggregate")
    .mockImplementation((pipeline) => Promise.resolve(runAggregate(pipeline, { users })));
  return service.listAssigners({});
};

afterEach(() => jest.restoreAllMocks());

describe("listAssigners — `grantCount` orphan qatorlarni sanamaydi", () => {
  test("5 ta qatordan faqat TIRIK 3 tasi sanaladi", async () => {
    const res = await callListAssigners({ users: LIVE_USERS });
    expect(res.docs[0].grantCount).toBe(3);
  });

  test("sanoq `listGrants` qaytaradigan son bilan mos", async () => {
    const res = await callListAssigners({ users: LIVE_USERS });
    expect(res.docs[0].grantCount).toBe(LIVE_USERS.length);
  });

  test("hamma xodim tirik bo'lsa xulq avvalgidek (5 ta)", async () => {
    const res = await callListAssigners({ users: [1, 2, 3, 4, 5].map((n) => ({ _id: oid(n) })) });
    expect(res.docs[0].grantCount).toBe(5);
  });

  test("HAMMA qator orphan bo'lsa 0 (tamg'a 'umumiy qoida' ko'rsatadi)", async () => {
    const res = await callListAssigners({ users: [] });
    expect(res.docs[0].grantCount).toBe(0);
  });

  test("pipeline'da join `$group` dan OLDIN turadi", async () => {
    const spy = jest.spyOn(Grant, "aggregate").mockResolvedValue([]);
    jest.spyOn(mongoose, "model").mockReturnValue({
      paginate: jest.fn().mockResolvedValue({ docs: [{ _id: ASSIGNER }], totalDocs: 1 }),
    });

    await service.listAssigners({});

    const pipeline = spy.mock.calls[0][0];
    expect(pipeline.findIndex((s) => s.$lookup)).toBeLessThan(
      pipeline.findIndex((s) => s.$group),
    );
  });
});

describe("qidiruv va `select` — sharif (F.I.Sh)", () => {
  test("`USER_SELECT` sharifni oladi", () => {
    expect(service.USER_SELECT).toContain("middleName");
  });

  test("qidiruv sharif bo'yicha ham mos keladi", () => {
    expect(service.userSearchFilter("Akmalovich").$or).toContainEqual({
      middleName: { $regex: "Akmalovich", $options: "i" },
    });
  });

  test("bo'sh qidiruvda filtr qo'shilmaydi", () => {
    expect(service.userSearchFilter("")).toEqual({});
  });
});
