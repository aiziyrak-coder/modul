jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {},
}));

const mockFind = jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) }));
jest.mock("./documentType.model", () => ({ find: (...a) => mockFind(...a) }));

const Controller = require("./documentType.controller");

const res = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const filterFor = async (query) => {
  mockFind.mockClear();
  await Controller.findAllDocumentTypes({ query }, res(), jest.fn());
  return mockFind.mock.calls[0][0];
};

describe("findAllDocumentTypes — `?search=`", () => {
  test("qism-satr bo'yicha, registrga sezgir emas (anchor YO'Q)", async () => {
    const f = await filterFor({ search: "diplom" });
    expect(f.title).toEqual({ $regex: "diplom", $options: "i" });
  });

  test("metakarakterlar escape qilinadi", async () => {
    const f = await filterFor({ search: "Sertifikat (IELTS)" });
    expect(f.title.$regex).toBe("Sertifikat \\(IELTS\\)");
    expect(() => new RegExp(f.title.$regex)).not.toThrow();
  });

  test("bo'shliqlar kesiladi va siqiladi", async () => {
    const f = await filterFor({ search: "  ilmiy   maqola  " });
    expect(f.title.$regex).toBe("ilmiy maqola");
  });

  test("faqat bo'shliqli so'rov FILTR QO'YMAYDI", async () => {
    const f = await filterFor({ search: "   " });
    expect(f.title).toBeUndefined();
  });

  test("kirill matni ham `i` bilan topiladi", async () => {
    const f = await filterFor({ search: "диплом" });
    expect(new RegExp(f.title.$regex, f.title.$options).test("ДИПЛОМ nusxasi")).toBe(true);
  });
});
