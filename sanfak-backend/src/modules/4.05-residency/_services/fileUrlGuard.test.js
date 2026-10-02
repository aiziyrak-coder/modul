"use strict";

const { guardFileUrl, guardLinkUrl } = require("./fileUrlGuard");

const HOST = "api.institut.uz";

const ORIG_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;
beforeAll(() => {
  process.env.ALLOWED_ORIGINS = `https://${HOST}`;
});
afterAll(() => {
  if (ORIG_ALLOWED_ORIGINS === undefined) delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = ORIG_ALLOWED_ORIGINS;
});

const nest = (path, value) =>
  path
    .split(".")
    .reverse()
    .reduce((acc, key) => ({ [key]: acc }), value);

const run = (value, { field = "fileUrl", host = HOST, body, mw } = {}) => {
  const req = {
    body: body ?? (value === Symbol.for("absent") ? {} : nest(field, value)),
    protocol: "https",
    get: (h) => (h.toLowerCase() === "host" ? host : undefined),
  };
  let err = null;
  (mw ?? guardFileUrl(field))(req, {}, (e) => {
    err = e || null;
  });
  return err;
};

const ABSENT = Symbol.for("absent");

describe("guardFileUrl — o'tkaziladi", () => {
  it.each([
    ["nisbiy yo'l", "/files/file/applications/1712345.pdf"],
    ["imzo bilan", "/files/file/applications/1712345.pdf?t=abc&e=99"],
    ["o'z hostimiz bilan mutlaq", `https://${HOST}/files/images/public/1.jpg`],
    ["rasm kengaytmasi", "/files/images/x/1.png"],
  ])("%s", (_, value) => {
    expect(run(value)).toBeNull();
  });

  it.each([
    ["maydon yo'q", ABSENT],
    ["null", null],
    ["bo'sh satr", ""],
  ])("%s — tegilmaydi (maydon ixtiyoriy)", (_, value) => {
    expect(run(value)).toBeNull();
  });
});

describe("guardFileUrl — RAD etiladi", () => {
  it("javascript: sxemasi (stored XSS vektori)", () => {
    const err = run("javascript:alert(document.domain)");
    expect(err.statusCode).toBe(400);
    expect(err.detail).toBe("FILE_URL_SCHEME_NOT_ALLOWED");
  });

  it("data:text/html", () => {
    expect(run("data:text/html,<script>1</script>").detail).toBe(
      "FILE_URL_SCHEME_NOT_ALLOWED",
    );
  });

  it("file: sxemasi", () => {
    expect(run("file:///etc/passwd").detail).toBe("FILE_URL_SCHEME_NOT_ALLOWED");
  });

  it("begona host (fishing)", () => {
    expect(run("https://evil.example/files/x.pdf").detail).toBe(
      "FILE_URL_FOREIGN_HOST",
    );
  });

  it("🔴 WP-C regressiya: Host sarlavhasi qalbakilashtirilib qiymat bilan bir xil qilinsa ham RAD etiladi", () => {
    const err = run("https://evil.example/files/x.pdf", { host: "evil.example" });
    expect(err.detail).toBe("FILE_URL_FOREIGN_HOST");
  });

  it("o'z hostimiz, lekin `/files/` dan tashqarida", () => {
    expect(run(`https://${HOST}/api/users`).detail).toBe("FILE_URL_NOT_OWN_FILE");
  });

  it("nisbiy, lekin `/files/` dan tashqarida", () => {
    expect(run("/etc/passwd").detail).toBe("FILE_URL_NOT_OWN_FILE");
  });

  it("`/files` prefiksini taqlid qiluvchi yo'l", () => {
    expect(run("/filesevil/x.pdf").detail).toBe("FILE_URL_NOT_OWN_FILE");
  });

  it("path traversal bilan `/files/` dan chiqish", () => {
    expect(run("/files/../etc/passwd").detail).toBe("FILE_URL_NOT_OWN_FILE");
  });

  it("matn bo'lmagan qiymat", () => {
    expect(run({ evil: true }).detail).toBe("FILE_URL_INVALID");
  });
});

describe("guardFileUrl — boshqa maydon nomi bilan", () => {
  it("`planFile` uchun ham ishlaydi", () => {
    expect(run("javascript:1", { field: "planFile" }).detail).toBe(
      "FILE_URL_SCHEME_NOT_ALLOWED",
    );
    expect(run("/files/x/1.pdf", { field: "planFile" })).toBeNull();
  });
});

describe("guardFileUrl — ichma-ich (nuqtali) maydon yo'li", () => {
  const F = "processFile.url";

  it("ichkaridagi yaroqli qiymatni o'tkazadi", () => {
    expect(run("/files/file/plans/1.pdf", { field: F })).toBeNull();
  });

  it("ichkaridagi `javascript:` ni RAD etadi", () => {
    expect(run("javascript:alert(1)", { field: F }).detail).toBe(
      "FILE_URL_SCHEME_NOT_ALLOWED",
    );
  });

  it("ota-maydon yo'q bo'lsa yiqilmaydi", () => {
    expect(run(null, { field: F, body: {} })).toBeNull();
  });

  it("ota-maydon `null` bo'lsa yiqilmaydi", () => {
    expect(run(null, { field: F, body: { processFile: null } })).toBeNull();
  });

  it("ota-maydon obyekt, lekin `url` yo'q — tegilmaydi", () => {
    expect(run(null, { field: F, body: { processFile: { name: "x" } } })).toBeNull();
  });

  it("bir zanjirda ikki alohida yo'l mustaqil tekshiriladi", () => {
    const body = {
      processFile: { url: "/files/a.pdf" },
      planFile: { url: "javascript:alert(1)" },
    };
    expect(run(null, { field: "processFile.url", body })).toBeNull();
    expect(run(null, { field: "planFile.url", body }).detail).toBe(
      "FILE_URL_SCHEME_NOT_ALLOWED",
    );
  });
});

describe("guardLinkUrl — `scheme` rejimi (tashqi havolaga RUXSAT)", () => {
  const mw = guardLinkUrl("url");
  const link = (value) => run(value, { field: "url", mw });

  it.each([
    ["tashqi https havola", "https://pubmed.ncbi.nlm.nih.gov/12345678/"],
    ["tashqi http havola", "http://conference.example/abstract?id=7"],
    ["o'z faylimiz ham mumkin", "/files/file/proofs/1.pdf"],
    ["/files/ dan tashqaridagi o'z yo'limiz", "/api/something"],
  ])("%s — o'tadi", (_, value) => {
    expect(link(value)).toBeNull();
  });

  it.each([
    ["javascript:", "javascript:alert(document.domain)"],
    ["data:text/html", "data:text/html,<script>1</script>"],
    ["file:", "file:///etc/passwd"],
  ])("%s — RAD etiladi (stored XSS vektori)", (_, value) => {
    expect(link(value).detail).toBe("FILE_URL_SCHEME_NOT_ALLOWED");
  });

  it("matn bo'lmagan qiymat baribir rad etiladi", () => {
    expect(link({ evil: true }).detail).toBe("FILE_URL_INVALID");
  });

  it("bo'sh/yo'q qiymatga tegilmaydi", () => {
    expect(link("")).toBeNull();
    expect(link(null)).toBeNull();
  });

  it("`own-file` rejimi o'zgarmagan — tashqi host hamon RAD", () => {
    expect(run("https://evil.example/files/x.pdf").detail).toBe(
      "FILE_URL_FOREIGN_HOST",
    );
  });
});

describe("guard metama'lumoti (zanjir testi shunga tayanadi)", () => {
  it("maydon va rejimni o'zida olib yuradi", () => {
    const a = guardFileUrl("processFile.url");
    expect(a.name).toBe("fileUrlGuardMw");
    expect(a.guardedField).toBe("processFile.url");
    expect(a.guardedMode).toBe("own-file");

    const b = guardLinkUrl("url");
    expect(b.guardedField).toBe("url");
    expect(b.guardedMode).toBe("scheme");
  });
});

describe("FAIL-CLOSED — ota-maydon noto'g'ri shaklda", () => {
  const F = "processFile.url";
  const shape = (parent) => run(null, { field: F, body: { processFile: parent } });

  it("obyekt o'rniga SATR kelsa RAD etiladi (jim o'tib ketmaydi)", () => {
    expect(shape("javascript:alert(1)").detail).toBe("FILE_URL_INVALID");
  });

  it("massiv kelsa ham RAD etiladi", () => {
    expect(shape([{ url: "javascript:alert(1)" }]).detail).toBe("FILE_URL_INVALID");
  });

  it("son kelsa ham RAD etiladi", () => {
    expect(shape(42).detail).toBe("FILE_URL_INVALID");
  });

  it("`null`/yo'q — tegilmaydi (maydon ixtiyoriy)", () => {
    expect(shape(null)).toBeNull();
    expect(run(null, { field: F, body: {} })).toBeNull();
  });
});

describe("guardLinkUrl — sxema OSHKORA bo'lishi shart", () => {
  const link = (value) => run(value, { field: "url", mw: guardLinkUrl("url") });

  it.each([
    ["sxemasiz domen", "www.example.com"],
    ["sxemasiz yo'l bilan", "evil.example/steal"],
  ])("%s — RAD etiladi", (_, value) => {
    expect(link(value).detail).toBe("FILE_URL_SCHEME_NOT_ALLOWED");
  });

  it("protokolsiz `//host/x` ham RAD etiladi", () => {
    expect(link("//evil.example/x").detail).toBe("FILE_URL_SCHEME_NOT_ALLOWED");
  });

  it("oshkora sxema va o'z nisbiy yo'limiz o'tadi", () => {
    expect(link("https://pubmed.ncbi.nlm.nih.gov/12345678/")).toBeNull();
    expect(link("http://conference.example/abstract")).toBeNull();
    expect(link("/files/file/proofs/1.pdf")).toBeNull();
  });
});
