"use strict";

const {
  REJECT_COMMENT_MAX,
  rejectCommentSchema,
} = require("./rejectBody.schema");

const validate = (body) => rejectCommentSchema.validate(body);

describe("rejectCommentSchema", () => {
  test("to'g'ri izoh — o'tadi va trim qilinadi", () => {
    const { error, value } = validate({ comment: "  Soatlar noto'g'ri  " });
    expect(error).toBeUndefined();
    expect(value.comment).toBe("Soatlar noto'g'ri");
  });

  test(`aynan ${REJECT_COMMENT_MAX} belgi — o'tadi`, () => {
    expect(validate({ comment: "a".repeat(REJECT_COMMENT_MAX) }).error).toBeUndefined();
  });

  test(`${REJECT_COMMENT_MAX + 1} belgi — rad etiladi`, () => {
    const { error } = validate({ comment: "a".repeat(REJECT_COMMENT_MAX + 1) });
    expect(error.details[0].type).toBe("string.max");
  });

  test.each([
    ["bo'sh satr", { comment: "" }],
    ["faqat bo'shliq", { comment: "   " }],
    ["yo'q", {}],
    ["null", { comment: null }],
    ["obyekt", { comment: { $gt: "" } }],
  ])("comment %s — rad etiladi", (_label, body) => {
    expect(validate(body).error).toBeDefined();
  });

  test("ERI maydonlari (soft-mode placeholder) — o'tadi", () => {
    const { error } = validate({
      comment: "Sabab",
      signature: "",
      eriSignature: "TEMP_ERI_PLACEHOLDER",
      eriSerial: null,
    });
    expect(error).toBeUndefined();
  });

  test("noma'lum kalit (status) — rad etiladi", () => {
    expect(validate({ comment: "Sabab", status: "approved" }).error).toBeDefined();
  });
});

describe("5 ta /reject/:id route — validator controller'dan OLDIN ulangan", () => {
  const ROUTERS = {
    workingSchedule: "#modules/4.02-studyLoad/workingSchedule/workingSchedule.routes",
    workload: "#modules/4.02-studyLoad/workload/workload.routes",
    workloadDistribution: "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.routes",
    syllabus: "#modules/4.02-studyLoad/syllabus/syllabus.routes",
    scienceProgram: "#modules/4.02-studyLoad/scienceProgram/scienceProgram.routes",
  };

  const validatorOf = (routerPath) => {
    const router = require(routerPath);
    const layer = router.stack.find((l) => l.route && l.route.path === "/reject/:id");
    const handlers = layer.route.stack.map((s) => s.handle);
    return handlers[handlers.length - 2];
  };

  const run = (mw, body) =>
    new Promise((resolve) => {
      mw({ body, query: {}, params: {} }, {}, (err) => resolve(err));
    });

  test.each(Object.entries(ROUTERS))("%s — 1001 belgi → 400", async (_n, path) => {
    const err = await run(validatorOf(path), { comment: "x".repeat(REJECT_COMMENT_MAX + 1) });
    expect(err?.statusCode).toBe(400);
  });

  test.each(Object.entries(ROUTERS))("%s — bo'sh izoh → 400", async (_n, path) => {
    const err = await run(validatorOf(path), { comment: "" });
    expect(err?.statusCode).toBe(400);
  });

  test.each(Object.entries(ROUTERS))("%s — to'g'ri izoh → o'tadi", async (_n, path) => {
    const err = await run(validatorOf(path), { comment: "Sabab" });
    expect(err).toBeUndefined();
  });
});
