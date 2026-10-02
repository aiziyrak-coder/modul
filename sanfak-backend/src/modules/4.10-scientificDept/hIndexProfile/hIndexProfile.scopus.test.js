const {
  parseScopusAuthorId,
  computeHIndex,
  extractPreviewMetrics,
} = require("./hIndexProfile.scopus");

describe("hIndexProfile.scopus — parseScopusAuthorId", () => {
  it("yangi format (/pages/authors/ID)", () => {
    expect(
      parseScopusAuthorId("https://www.scopus.com/pages/authors/58675540200"),
    ).toBe("58675540200");
  });

  it("eski format (?authorId=ID)", () => {
    expect(
      parseScopusAuthorId(
        "https://www.scopus.com/authid/detail.uri?authorId=58675540200&origin=x",
      ),
    ).toBe("58675540200");
  });

  it("yalang'och ID", () => {
    expect(parseScopusAuthorId("58675540200")).toBe("58675540200");
  });

  it("qidiruv sintaksisi AU-ID(...)", () => {
    expect(parseScopusAuthorId("AU-ID(58675540200)")).toBe("58675540200");
  });

  it("bo'sh/xato qiymatlar null", () => {
    expect(parseScopusAuthorId("")).toBeNull();
    expect(parseScopusAuthorId(null)).toBeNull();
    expect(parseScopusAuthorId("https://scholar.google.com/citations?user=abc")).toBeNull();
    expect(parseScopusAuthorId("12345")).toBeNull();
  });
});

describe("hIndexProfile.scopus — extractPreviewMetrics", () => {
  it("real GraphQL javobini o'qiydi", () => {
    const raw = JSON.stringify({
      data: {
        author: { metrics: { citationCount: 40, citedByCount: 34, documentCount: 11, hindex: 4 } },
      },
      extensions: {},
    });
    expect(extractPreviewMetrics(raw)).toEqual({ hIndex: 4, citations: 40, documents: 11 });
  });

  it("blok/HTML/bo'sh javob — null (jim nol yozilmasin)", () => {
    expect(extractPreviewMetrics('{"message":"Forbidden"}')).toBeNull();
    expect(extractPreviewMetrics("<!DOCTYPE html><html></html>")).toBeNull();
    expect(extractPreviewMetrics("")).toBeNull();
    expect(extractPreviewMetrics('{"data":{"author":null}}')).toBeNull();
  });
});

describe("hIndexProfile.scopus — computeHIndex", () => {
  it("real ma'lumot bilan Scopus raqamiga mos", () => {
    expect(computeHIndex([19, 10, 4, 4, 3, 0, 0, 0, 0, 0, 0])).toBe(4);
  });

  it("tartibsiz ro'yxatni o'zi saralaydi", () => {
    expect(computeHIndex([0, 3, 19, 0, 4, 10, 4])).toBe(4);
  });

  it("iqtibossiz muallif — 0", () => {
    expect(computeHIndex([0, 0, 0])).toBe(0);
    expect(computeHIndex([])).toBe(0);
  });

  it("hammasi ko'p iqtiboslangan — hujjat soniga teng", () => {
    expect(computeHIndex([10, 9, 8])).toBe(3);
  });
});
