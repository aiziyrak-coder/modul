const mockFind = jest.fn();
const mockFindOneAndUpdate = jest.fn();

jest.mock("#references/educationActivityType/educationActivityType.model", () => ({
  find: (...a) => mockFind(...a),
  findOneAndUpdate: (...a) => mockFindOneAndUpdate(...a),
}));

const chain = (docs) => ({ select: () => ({ lean: () => Promise.resolve(docs) }) });

describe("educationActivityResolver — apostrof dublikat qulfi", () => {
  let resolver;

  beforeEach(() => {
    jest.resetModules();
    mockFind.mockReset();
    mockFindOneAndUpdate.mockReset();
    resolver = require("./educationActivityResolver");
  });

  test("U+2019 apostrofli title MAVJUD U+0027 yozuvni topadi (yangi yaratmaydi)", async () => {
    mockFind.mockReturnValue(chain([{ _id: "canon-1", title: "Ma'ruza" }]));

    const id = await resolver.resolveOrCreate("Ma’ruza");

    expect(id).toBe("canon-1");
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test("ʻ (U+02BB) va ` (backtick) ham bir xil yozuvga tushadi", async () => {
    mockFind.mockReturnValue(chain([{ _id: "canon-1", title: "Ma'ruza" }]));

    expect(await resolver.resolveOrCreate("Maʻruza")).toBe("canon-1");
    expect(await resolver.resolveOrCreate("Ma`ruza")).toBe("canon-1");
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test("ortiqcha bo'shliq va REGISTR farqi ham dublikat yaratmaydi", async () => {
    mockFind.mockReturnValue(chain([{ _id: "canon-2", title: "Mustaqil ta'lim" }]));

    expect(await resolver.resolveOrCreate("  MUSTAQIL   ta’lim ")).toBe("canon-2");
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test("HAQIQATAN yangi tushuncha yaratiladi — va ASL matn saqlanadi", async () => {
    mockFind.mockReturnValue(chain([{ _id: "canon-1", title: "Ma'ruza" }]));
    mockFindOneAndUpdate.mockResolvedValue({ _id: "new-1", title: "Amaliy mashg’ulot" });

    const id = await resolver.resolveOrCreate("Amaliy mashg’ulot");

    expect(id).toBe("new-1");
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = mockFindOneAndUpdate.mock.calls[0];
    expect(filter.title).toBe("Amaliy mashg’ulot");
    expect(update.$setOnInsert.title).toBe("Amaliy mashg’ulot");
  });

  test("bo'sh/null title — null qaytadi, DB ga tegilmaydi", async () => {
    mockFind.mockReturnValue(chain([]));

    expect(await resolver.resolveOrCreate(null)).toBeNull();
    expect(await resolver.resolveOrCreate("   ")).toBeNull();
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test("bazada dublikat QOLGAN bo'lsa — har doim BIRINCHISI qaytadi (ko'paymasin)", async () => {
    mockFind.mockReturnValue(
      chain([
        { _id: "eski", title: "Ma'ruza" },
        { _id: "dublikat", title: "Ma’ruza" },
      ]),
    );

    expect(await resolver.resolveOrCreate("Ma’ruza")).toBe("eski");
    expect(await resolver.resolveOrCreate("Ma'ruza")).toBe("eski");
  });
});
