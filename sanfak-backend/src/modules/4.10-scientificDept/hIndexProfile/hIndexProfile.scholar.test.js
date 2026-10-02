const {
  parseScholarUserId,
  extractScholarMetrics,
  isBlocked,
} = require("./hIndexProfile.scholar");

describe("hIndexProfile.scholar — parseScholarUserId", () => {
  it("to'liq URL", () => {
    expect(
      parseScholarUserId("https://scholar.google.com/citations?user=K5ku1OMAAAAJ&hl=en"),
    ).toBe("K5ku1OMAAAAJ");
  });

  it("hl qiymatsiz bo'lsa ham (real holat)", () => {
    expect(
      parseScholarUserId("https://scholar.google.com/citations?user=K5ku1OMAAAAJ&hl"),
    ).toBe("K5ku1OMAAAAJ");
  });

  it("yalang'och ID", () => {
    expect(parseScholarUserId("K5ku1OMAAAAJ")).toBe("K5ku1OMAAAAJ");
  });

  it("bo'sh/xato qiymatlar null", () => {
    expect(parseScholarUserId("")).toBeNull();
    expect(parseScholarUserId(null)).toBeNull();
    expect(parseScholarUserId("https://www.scopus.com/pages/authors/58675540200")).toBeNull();
  });
});

describe("hIndexProfile.scholar — extractScholarMetrics", () => {
  const html = `
    <table id="gsc_rsb_st">
      <tr><td class="gsc_rsb_sc1">Citations</td><td class="gsc_rsb_std">172</td><td class="gsc_rsb_std">134</td></tr>
      <tr><td class="gsc_rsb_sc1">h-index</td><td class="gsc_rsb_std">7</td><td class="gsc_rsb_std">6</td></tr>
      <tr><td class="gsc_rsb_sc1">i10-index</td><td class="gsc_rsb_std">3</td><td class="gsc_rsb_std">3</td></tr>
    </table>`;

  it("'jami' ustunini oladi (5 yillikni emas)", () => {
    expect(extractScholarMetrics(html)).toEqual({
      citations: 172,
      hIndex: 7,
      i10Index: 3,
    });
  });

  it("jadval bo'lmasa null — jim nol yozilmasin", () => {
    expect(extractScholarMetrics("<html><body>hech narsa</body></html>")).toBeNull();
    expect(
      extractScholarMetrics('<td class="gsc_rsb_std">172</td><td class="gsc_rsb_std">134</td>'),
    ).toBeNull();
  });
});

describe("hIndexProfile.scholar — isBlocked", () => {
  it("CAPTCHA sahifasini taniydi", () => {
    expect(isBlocked("<div>Please solve this CAPTCHA to continue</div>")).toBe(true);
    expect(isBlocked("our systems have detected unusual traffic")).toBe(true);
  });

  it("oddiy profil sahifasi blok emas", () => {
    expect(isBlocked('<div id="gsc_prf_in">Alijon Khusanov</div>')).toBe(false);
  });
});
