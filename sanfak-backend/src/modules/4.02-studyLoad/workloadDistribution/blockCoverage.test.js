const { coverageOf, coverageClash } = require("./blockCoverage");

const A = "eeeeeeeeeeeeeeeeeeeeeeee";
const B = "ffffffffffffffffffffffff";
const C = "dddddddddddddddddddddddd";

describe("coverageOf", () => {
  it("guruhlar va oqim guruhlari birlashadi, takror yo'q", () => {
    expect(
      coverageOf([A], [{ number: 1, groups: [A, B] }, { number: 2, groups: [C] }]).sort(),
    ).toEqual([A, B, C].sort());
  });

  it("populate qilingan guruh ({_id}) ham id'ga aylanadi", () => {
    expect(coverageOf([{ _id: A }], [])).toEqual([A]);
  });

  it("yo'q/noto'g'ri kirish — bo'sh qamrov", () => {
    expect(coverageOf(undefined, undefined)).toEqual([]);
    expect(coverageOf(null, [{ groups: null }])).toEqual([]);
  });
});

describe("coverageClash", () => {
  it("ikkalasi ham butun blok — to'qnashuv", () => {
    expect(coverageClash([], [])).toEqual({ clash: true, kind: "both-whole", overlap: 0 });
  });

  it("D-1: yangisi butun blok, mavjudi guruhli — to'qnashuv", () => {
    expect(coverageClash([], [A])).toEqual({ clash: true, kind: "whole", overlap: 0 });
  });

  it("D-1: mavjudi butun blok, yangisi guruhli — to'qnashuv", () => {
    expect(coverageClash([B], [])).toEqual({ clash: true, kind: "whole", overlap: 0 });
  });

  it("qisman kesishuv — nechta guruh kesishgani bilan", () => {
    expect(coverageClash([A, B], [B, C])).toEqual({ clash: true, kind: "overlap", overlap: 1 });
  });

  it("kesishmaydigan guruhlar — to'qnashuv yo'q (blok guruhlar bo'yicha bo'linadi)", () => {
    expect(coverageClash([A, B], [C])).toEqual({ clash: false, kind: null, overlap: 0 });
  });
});
