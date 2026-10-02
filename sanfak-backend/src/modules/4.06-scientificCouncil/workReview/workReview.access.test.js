jest.mock("./workReview.model");

const WorkReview = require("./workReview.model");
const {
  requireReviewWriteAccess,
  canWriteReview,
  requireDocAssignment,
  isAssignedToDoc,
} = require("./workReview.access");

const AUTHOR_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_MEMBER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SECRETARY_ID = "cccccccccccccccccccccccc";
const REVIEW_ID = "dddddddddddddddddddddddd";

const createMockReq = (overrides = {}) => ({
  params: { id: REVIEW_ID },
  user: { _id: OTHER_MEMBER_ID, role: { scopeLevel: "self" } },
  ...overrides,
});

const mockFindById = (doc) => {
  WorkReview.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(doc),
  });
};

const baseReview = (overrides = {}) => ({
  _id: REVIEW_ID,
  member: AUTHOR_ID,
  type: "positive",
  ...overrides,
});

const userWith = (id, scopeLevel = "self") => ({
  _id: id,
  role: { scopeLevel },
});

const run = async (req) => {
  const next = jest.fn();
  await requireReviewWriteAccess(req, {}, next);
  return next.mock.calls[0]?.[0];
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("workReview.access — canWriteReview matritsasi", () => {
  test("xulosa egasi (member) — true", () => {
    expect(canWriteReview(baseReview(), userWith(AUTHOR_ID))).toBe(true);
  });

  test("global scope (kotib) — true", () => {
    expect(
      canWriteReview(baseReview(), userWith(SECRETARY_ID, "global")),
    ).toBe(true);
  });

  test("boshqa kengash a'zosi — false (asosiy fix)", () => {
    expect(canWriteReview(baseReview(), userWith(OTHER_MEMBER_ID))).toBe(false);
  });

  test("populate qilingan member (obyekt, _id bilan) — true", () => {
    const review = baseReview({
      member: { _id: AUTHOR_ID, firstName: "Ali" },
    });
    expect(canWriteReview(review, userWith(AUTHOR_ID))).toBe(true);
  });
});

describe("workReview.access — requireReviewWriteAccess", () => {
  test("xulosa egasi — o'tadi", async () => {
    mockFindById(baseReview());
    const req = createMockReq({ user: userWith(AUTHOR_ID) });

    const err = await run(req);

    expect(err).toBeUndefined();
  });

  test("global scope (kotib) — o'tadi", async () => {
    mockFindById(baseReview());
    const req = createMockReq({ user: userWith(SECRETARY_ID, "global") });

    const err = await run(req);

    expect(err).toBeUndefined();
  });

  test("IDOR: boshqa a'zoning xulosasi — 403 (asosiy fix)", async () => {
    mockFindById(baseReview());
    const req = createMockReq({ user: userWith(OTHER_MEMBER_ID) });

    const err = await run(req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("xulosa topilmasa — 404", async () => {
    mockFindById(null);

    const err = await run(createMockReq());

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(404);
  });

  test("guard o'tganda `req.review` keyingi middleware uchun o'rnatiladi", async () => {
    const review = baseReview();
    mockFindById(review);
    const req = createMockReq({ user: userWith(AUTHOR_ID) });

    await run(req);

    expect(req.review).toBe(review);
  });
});

describe("workReview.access — middleware tartibi buzilishi", () => {
  test("req.user yo'q -> 500 (authenticate avval chaqirilmagan)", async () => {
    const req = { params: { id: REVIEW_ID }, user: undefined };

    const err = await run(req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(500);
  });
});

describe("workReview.access — isAssignedToDoc (D-027a)", () => {
  test("Map docAssignments — biriktirilgan a'zo uchun true", () => {
    const work = {
      docAssignments: new Map([["titul", [AUTHOR_ID]]]),
    };
    expect(isAssignedToDoc(work, "titul", AUTHOR_ID)).toBe(true);
  });

  test("Map docAssignments — biriktirilmagan a'zo uchun false (asosiy fix)", () => {
    const work = {
      docAssignments: new Map([["titul", [AUTHOR_ID]]]),
    };
    expect(isAssignedToDoc(work, "titul", OTHER_MEMBER_ID)).toBe(false);
  });

  test("plain obyekt docAssignments (test mock) — ham ishlaydi", () => {
    const work = { docAssignments: { titul: [AUTHOR_ID] } };
    expect(isAssignedToDoc(work, "titul", AUTHOR_ID)).toBe(true);
    expect(isAssignedToDoc(work, "titul", OTHER_MEMBER_ID)).toBe(false);
  });

  test("docKey biriktirilmagan (hech kimga) — false", () => {
    const work = { docAssignments: { titul: [AUTHOR_ID] } };
    expect(isAssignedToDoc(work, "referat", AUTHOR_ID)).toBe(false);
  });

  test("docKey yo'q — false", () => {
    const work = { docAssignments: { titul: [AUTHOR_ID] } };
    expect(isAssignedToDoc(work, undefined, AUTHOR_ID)).toBe(false);
  });

  test("docAssignments umuman yo'q — false", () => {
    expect(isAssignedToDoc({}, "titul", AUTHOR_ID)).toBe(false);
  });
});

describe("workReview.access — requireDocAssignment (D-027a)", () => {
  const runGuard = async (req) => {
    const next = jest.fn();
    await requireDocAssignment(req, {}, next);
    return next.mock.calls[0]?.[0];
  };

  test("biriktirilgan a'zo — o'tadi", async () => {
    const req = {
      user: userWith(AUTHOR_ID),
      work: { docAssignments: { titul: [AUTHOR_ID] } },
      body: { docKey: "titul" },
    };

    const err = await runGuard(req);

    expect(err).toBeUndefined();
  });

  test("biriktirilmagan a'zo — 403 (asosiy fix)", async () => {
    const req = {
      user: userWith(OTHER_MEMBER_ID),
      work: { docAssignments: { titul: [AUTHOR_ID] } },
      body: { docKey: "titul" },
    };

    const err = await runGuard(req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("global scope (kotib) — biriktirilmagan bo'lsa ham o'tadi (bypass)", async () => {
    const req = {
      user: userWith(SECRETARY_ID, "global"),
      work: { docAssignments: { titul: [AUTHOR_ID] } },
      body: { docKey: "titul" },
    };

    const err = await runGuard(req);

    expect(err).toBeUndefined();
  });

  test("req.user yo'q -> 500", async () => {
    const req = { user: undefined, work: {}, body: {} };

    const err = await runGuard(req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(500);
  });

  test("req.work yo'q (middleware tartibi buzilgan) -> 500", async () => {
    const req = { user: userWith(OTHER_MEMBER_ID), body: { docKey: "titul" } };

    const err = await runGuard(req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(500);
  });
});
