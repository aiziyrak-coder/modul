jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));
jest.mock("#shared/publicBaseUrl", () => ({
  resolvePublicBaseUrl: jest.fn(() => "http://test.local"),
  isHostAllowed: jest.fn(() => true),
}));
jest.mock("#shared/fileAccess", () => ({
  appendSignature: jest.fn((url) => `${url}?t=imzo`),
}));

const fs = require("fs");
const Indicator = require("#modules/4.12-qualityAssurance/indicator/indicator.model");
const IndicatorSubmission = require("#modules/4.12-qualityAssurance/indicatorSubmission/indicatorSubmission.model");
const { persistSubmissionFiles } = require("./qualityUpload");

const INDICATOR_ID = "dddddddddddddddddddddddd";

const leanQuery = (doc) => ({ select: () => ({ lean: () => Promise.resolve(doc) }) });

const fakeFile = (fieldname, originalname = "hujjat.pdf") => ({
  fieldname,
  originalname,
  size: 1234,
  buffer: Buffer.from("%PDF-1.4"),
});

const makeReq = (files, body = {}) => ({
  files,
  body: { indicator: INDICATOR_ID, ...body },
  params: {},
  get: () => "test.local",
});

const run = async (req) => {
  const next = jest.fn();
  await persistSubmissionFiles(req, {}, next);
  return next.mock.calls[0]?.[0];
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FILEPATH = "/tmp/test-files/";
  jest.spyOn(Indicator, "findById").mockReturnValue(
    leanQuery({
      dataFields: [
        { fieldName: "otmName", fieldType: "text" },
        { fieldName: "diplomaFile", fieldType: "file" },
        { fieldName: "certificateFile", fieldType: "file" },
      ],
    }),
  );
});

afterEach(() => jest.restoreAllMocks());

describe("persistSubmissionFiles — indikator e'lon qilgan maydonlar darvozasi", () => {
  test("e'lon qilingan fayl maydoni SAQLANADI va `data` ga havola yoziladi", async () => {
    const req = makeReq([fakeFile("diplomaFile", "diplom.pdf")], { data: {} });
    const err = await run(req);

    expect(err).toBeUndefined();
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(req.body.data.diplomaFile).toEqual({
      fileUrl: expect.stringContaining("/files/file/submissions/"),
      fileName: "diplom.pdf",
      fileSize: 1234,
    });
    expect(req.body.data.diplomaFile.fileUrl).toContain("?t=");
  });

  test("E'LON QILINMAGAN maydonga kelgan fayl 400 bilan RAD etiladi (jimgina tashlanmaydi)", async () => {
    const req = makeReq([fakeFile("begonaFayl")], { data: {} });
    const err = await run(req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain("begonaFayl");
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test("bitta begona maydon bo'lsa — TO'G'RI fayllar ham saqlanmaydi (hammasi rad)", async () => {
    const req = makeReq([fakeFile("diplomaFile"), fakeFile("begonaFayl")], { data: {} });
    const err = await run(req);

    expect(err.statusCode).toBe(400);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test("ruxsat etilmagan KENGAYTMA 400 beradi (mime o'tib ketgan holat uchun ikkinchi darvoza)", async () => {
    const req = makeReq([fakeFile("diplomaFile", "zararli.exe")], { data: {} });
    const err = await run(req);

    expect(err.statusCode).toBe(400);
    expect(err.message).toContain("kengaytmasi");
  });

  test("indikator topilmasa fayl SAQLANMAYDI", async () => {
    Indicator.findById.mockReturnValue(leanQuery(null));
    const req = makeReq([fakeFile("diplomaFile")], { data: {} });
    const err = await run(req);

    expect(err.statusCode).toBe(400);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test("fayl umuman bo'lmasa — o'tkazib yuboradi (faylsiz JSON yo'li buzilmaydi)", async () => {
    const req = makeReq([], { data: { otmName: "X" } });
    const err = await run(req);

    expect(err).toBeUndefined();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(req.body.data).toEqual({ otmName: "X" });
  });

  test("PUT /:id — tanada `indicator` bo'lmasa yozuvdan olinadi", async () => {
    jest
      .spyOn(IndicatorSubmission, "findById")
      .mockReturnValue(leanQuery({ indicator: INDICATOR_ID }));

    const req = {
      files: [fakeFile("certificateFile", "sertifikat.pdf")],
      body: { data: {} },
      params: { id: "eeeeeeeeeeeeeeeeeeeeeeee" },
      get: () => "test.local",
    };
    const err = await run(req);

    expect(err).toBeUndefined();
    expect(IndicatorSubmission.findById).toHaveBeenCalledWith("eeeeeeeeeeeeeeeeeeeeeeee");
    expect(req.body.data.certificateFile.fileName).toBe("sertifikat.pdf");
  });

  test("`data` bo'lmasa ham yaratiladi (fayl yo'qolib qolmaydi)", async () => {
    const req = makeReq([fakeFile("diplomaFile")]);
    const err = await run(req);

    expect(err).toBeUndefined();
    expect(req.body.data.diplomaFile).toBeDefined();
  });
});
