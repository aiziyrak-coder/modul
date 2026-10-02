const path = require("path");
const fs = require("fs");
const os = require("os");

const { requireAllDocs, FIELDS, PUBLIC_MAX_SIZE } = require("./publicMethodical.upload");

const fileOf = (name) => ({ originalname: name, buffer: Buffer.from("x") });
const allFiles = () =>
  Object.fromEntries(Object.keys(FIELDS).map((f) => [f, [fileOf("a.pdf")]]));

const run = (files) => {
  const req = { files };
  let captured = null;
  requireAllDocs(req, {}, (err) => {
    captured = err || "OK";
  });
  return captured;
};

describe("publicMethodical — hujjat slotlari", () => {
  it("6 ta slot va model slotlari mos", () => {
    const Methodical = require("../methodicalRecommendation/methodicalRecommendation.model");
    const slots = Object.values(FIELDS).map((f) => f.slot);
    expect(slots).toEqual(Methodical.METHODICAL_FILE_SLOTS);
  });

  it("maydon nomlari kontraktdagidek", () => {
    expect(Object.keys(FIELDS)).toEqual([
      "documentMethodical",
      "documentProtocol",
      "documentTitul",
      "documentExternal",
      "documentInternal",
      "documentAntiplagiat",
    ]);
  });

  it("matn va titul DOCX, qolgani PDF kutadi", () => {
    expect(FIELDS.documentMethodical.ext).toBe("DOCX");
    expect(FIELDS.documentTitul.ext).toBe("DOCX");
    ["documentProtocol", "documentExternal", "documentInternal", "documentAntiplagiat"].forEach(
      (f) => expect(FIELDS[f].ext).toBe("PDF"),
    );
  });

  it("hajm chegarasi 10MB", () => {
    expect(PUBLIC_MAX_SIZE).toBe(10 * 1024 * 1024);
  });
});

describe("publicMethodical — requireAllDocs", () => {
  it("hammasi bo'lsa o'tkazadi", () => {
    expect(run(allFiles())).toBe("OK");
  });

  it("bittasi yetishmasa 400 va yorliq bilan xato", () => {
    const files = allFiles();
    delete files.documentTitul;
    const err = run(files);
    expect(err.status || err.statusCode).toBe(400);
    expect(err.message).toContain("Titul");
  });

  it("bir nechtasi yetishmasa hammasi sanab o'tiladi", () => {
    const files = allFiles();
    delete files.documentExternal;
    delete files.documentInternal;
    const err = run(files);
    expect(err.message).toContain("Tashqi taqriz");
    expect(err.message).toContain("Ichki taqriz");
  });

  it("fayl umuman bo'lmasa ham yiqilmaydi", () => {
    const err = run(undefined);
    expect(err.status || err.statusCode).toBe(400);
  });

  it("bo'sh massiv fayl deb hisoblanmaydi", () => {
    const files = allFiles();
    files.documentProtocol = [];
    const err = run(files);
    expect(err.message).toContain("Kafedra bayonnomasi");
  });
});

describe("publicMethodical — persistMethodicalDocs Host allowlist", () => {
  const TMP_ROOT = path.join(os.tmpdir(), `wpc-p1-4.10-methodical-${Date.now()}`);
  const ORIG_ENV = { ...process.env };

  const fileOf2 = (name) => ({ originalname: name, buffer: Buffer.from("x"), size: 1 });
  const mockReq = (host, files) => ({
    protocol: "https",
    get: (h) => (h.toLowerCase() === "host" ? host : undefined),
    files,
    body: {},
  });

  beforeEach(() => {
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    process.env.FILEPATH = `${TMP_ROOT.replace(/\\/g, "/")}/`;
    delete process.env.PUBLIC_BASE_URL;
    process.env.ALLOWED_ORIGINS = "https://api.institut.uz";
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env = { ...ORIG_ENV };
    jest.resetModules();
  });

  afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  it("allowlist'dagi Host — URL to'g'ri quriladi", () => {
    jest.resetModules();
    const { persistMethodicalDocs } = require("./publicMethodical.upload");
    const req = mockReq("api.institut.uz", {
      documentProtocol: [fileOf2("bayonnoma.pdf")],
    });
    let nextErr;
    persistMethodicalDocs(req, {}, (err) => {
      nextErr = err;
    });
    expect(nextErr).toBeUndefined();
    expect(req.body.files.protocol).toMatch(
      /^https:\/\/api\.institut\.uz\/files\/images\/public\//,
    );
  });

  it("begona Host — 400 'Host ruxsat etilmagan', `files` to'ldirilmaydi", () => {
    jest.resetModules();
    const { persistMethodicalDocs } = require("./publicMethodical.upload");
    const req = mockReq("evil.example", {
      documentProtocol: [fileOf2("bayonnoma.pdf")],
    });
    let nextErr;
    persistMethodicalDocs(req, {}, (err) => {
      nextErr = err;
    });
    expect(nextErr).toBeDefined();
    expect(nextErr.statusCode).toBe(400);
    expect(nextErr.message).toBe("Host ruxsat etilmagan");
    expect(req.body.files).toBeUndefined();
  });
});
