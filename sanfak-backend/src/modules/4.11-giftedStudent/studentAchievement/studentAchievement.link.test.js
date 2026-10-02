"use strict";

const { achievementSchema } = require("./studentAchievement.validation");

const base = (over = {}) => ({
  documentType: "6a7efdac5916905f06cebeac",
  title: "TEST maqola",
  ...over,
});

const ok = (body) => !achievementSchema.validate(body, { abortEarly: false }).error;
const msg = (body) =>
  achievementSchema.validate(body, { abortEarly: false }).error?.message ?? "";

describe("D-56 — ruxsat etilgan sxemalar", () => {
  it.each([
    "https://example.com/a",
    "http://fjsti.uz/maqola?id=1",
    "https://doi.org/10.1000/182#bo'lim",
  ])("%s qabul qilinadi", (link) => {
    expect(ok(base({ link }))).toBe(true);
  });

  it("bo'sh satr o'tadi — maydon ixtiyoriy", () => {
    expect(ok(base({ link: "" }))).toBe(true);
  });

  it("havola umuman berilmasa o'tadi", () => {
    expect(ok(base())).toBe(true);
  });
});

describe("D-56 — rad etiladigan sxemalar", () => {
  it("🔴 `javascript:` RAD etiladi (jonli o'lchangan holat)", () => {
    expect(ok(base({ link: "javascript:alert(1)" }))).toBe(false);
  });

  it("🔴 `data:` RAD etiladi", () => {
    expect(ok(base({ link: "data:text/html,<script>1</script>" }))).toBe(false);
  });

  it("sxemasiz matn rad etiladi", () => {
    expect(ok(base({ link: "abc" }))).toBe(false);
  });

  it("`mailto:` / `tel:` ATAYLAB rad etiladi — maydon manba havolasi uchun", () => {
    expect(ok(base({ link: "mailto:a@b.uz" }))).toBe(false);
    expect(ok(base({ link: "tel:+998901234567" }))).toBe(false);
  });

  it("xabar o'zbekcha va nima kutilayotganini aytadi", () => {
    expect(msg(base({ link: "javascript:alert(1)" }))).toMatch(
      /http:\/\/ yoki https:\/\/ bilan boshlanishi/,
    );
  });
});

describe("D-56 — uzunlik", () => {
  it("2000 belgi qabul qilinadi", () => {
    const link = `https://e.uz/${"a".repeat(2000 - "https://e.uz/".length)}`;
    expect(link.length).toBe(2000);
    expect(ok(base({ link }))).toBe(true);
  });

  it("2001 belgi rad etiladi", () => {
    const link = `https://e.uz/${"a".repeat(2001 - "https://e.uz/".length)}`;
    expect(ok(base({ link }))).toBe(false);
  });
});
