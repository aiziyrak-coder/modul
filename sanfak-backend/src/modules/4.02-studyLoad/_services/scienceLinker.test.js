jest.mock("#references/science/science.model", () => ({ find: jest.fn() }));

const ScienceModel = require("#references/science/science.model");
const winston = require("#shared/winston.logger");
const {
  LINK_STATUS,
  isNonScienceRow,
  canonicalizeScienceCode,
  lookupCanonical,
  collectUnlinkedCodes,
  buildCatalog,
  loadCatalogByCodes,
  resolveLink,
  applyLink,
} = require("./scienceLinker");

const SCI_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEP_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

const catalogOf = (rows) => buildCatalog(rows);
const defaultCatalog = () =>
  catalogOf([{ _id: SCI_ID, scienceCode: "FA1200", department: DEP_ID }]);

const mockFind = (docs) => {
  ScienceModel.find.mockReturnValue({
    select: () => ({ lean: async () => docs }),
  });
};

beforeEach(() => {
  ScienceModel.find.mockReset();
});

describe("scienceLinker — isNonScienceRow", () => {
  test.each([
    ["Malakaviy amaliyot"],
    ["Tanishuv amaliyoti"],
    ["Ishlab chiqarish amaliyoti"],
    ["Bitiruv oldi amaliyoti"],
    ["Yakuniy davlat attestatsiyasi"],
  ])("amaliyot/attestatsiya qatori fan emas: %s", (title) => {
    expect(isNonScienceRow({ title })).toBe(true);
  });

  test("haqiqiy fan nomi 'fan emas' deb belgilanmaydi", () => {
    expect(
      isNonScienceRow({ title: "Gigiyena, harbiy gigiyena. Tibbiy ekologiya" }),
    ).toBe(false);
  });
});

describe("scienceLinker — resolveLink", () => {
  test("kod katalogda topilsa science + department qaytariladi", () => {
    const row = { code: "FA1200", title: "Gigiyena", science: null };
    const link = resolveLink(row, defaultCatalog());

    expect(link.status).toBe(LINK_STATUS.FILLED);
    expect(link.science).toBe(SCI_ID);
    expect(link.department).toBe(DEP_ID);
  });

  test("kod katalogda yo'q bo'lsa science null qoladi (fuzzy moslash yo'q)", () => {
    const row = { code: "FA120", title: "Gigiyena", science: null };
    const link = resolveLink(row, defaultCatalog());

    expect(link.status).toBe(LINK_STATUS.NOT_IN_CATALOG);
    expect(link.science).toBeNull();
    expect(link.department).toBeNull();
  });

  test("amaliyot qatori 'xato' emas — alohida status bilan ajratiladi", () => {
    const row = { code: "TM104", title: "Tanishuv amaliyoti", science: null };
    const link = resolveLink(row, defaultCatalog());

    expect(link.status).toBe(LINK_STATUS.NON_SCIENCE);
    expect(link.status).not.toBe(LINK_STATUS.NOT_IN_CATALOG);
    expect(link.science).toBeNull();
  });

  test("kodsiz yig'indi qatori (Jami/HAMMASI) qidirilmaydi", () => {
    expect(resolveLink({ code: "", title: "Jami" }, defaultCatalog()).status).toBe(
      LINK_STATUS.NO_CODE,
    );
  });

  test("MERGE — allaqachon bog'langan qator BUZILMAYDI", () => {
    const row = { code: "FA1200", title: "Gigiyena", science: "eski-id", department: "eski-dep" };
    const link = resolveLink(row, defaultCatalog());

    expect(link.status).toBe(LINK_STATUS.ALREADY);
    expect(link.science).toBe("eski-id");
    expect(link.department).toBe("eski-dep");
  });

  test("resolveLink qatorni MUTATSIYA qilmaydi", () => {
    const row = { code: "FA1200", title: "Gigiyena", science: null };
    resolveLink(row, defaultCatalog());
    expect(row.science).toBeNull();
  });
});

describe("scienceLinker — applyLink (backfill yo'li)", () => {
  test("topilgan qator joyida to'ldiriladi", () => {
    const row = { code: "FA1200", title: "Gigiyena", science: null };
    expect(applyLink(row, defaultCatalog())).toBe(LINK_STATUS.FILLED);
    expect(row.science).toBe(SCI_ID);
    expect(row.department).toBe(DEP_ID);
  });

  test("MERGE — mavjud bog'lanish qayta yozilmaydi", () => {
    const row = { code: "FA1200", title: "Gigiyena", science: "eski-id", department: "eski-dep" };
    expect(applyLink(row, defaultCatalog())).toBe(LINK_STATUS.ALREADY);
    expect(row.science).toBe("eski-id");
    expect(row.department).toBe("eski-dep");
  });

  test("topilmagan qator o'zgarmaydi", () => {
    const row = { code: "FA120", title: "Gigiyena", science: null, department: null };
    expect(applyLink(row, defaultCatalog())).toBe(LINK_STATUS.NOT_IN_CATALOG);
    expect(row.science).toBeNull();
  });
});

describe("scienceLinker — collectUnlinkedCodes", () => {
  const blocks = [
    {
      sciences: [
        { code: "FA1200", science: null },
        { code: "FA1200", science: null },
        { code: "FA1001", science: "bor-id" },
        { code: "", science: null },
        { code: "TM104", science: null },
      ],
    },
    { sciences: [{ code: "BOM504", science: null }] },
  ];

  test("faqat bog'lanmagan, kodli qatorlar — takrorsiz", () => {
    expect(collectUnlinkedCodes(blocks).sort()).toEqual(
      ["BOM504", "FA1200", "TM104"].sort(),
    );
  });

  test("bo'sh/aniqlanmagan bloklar xatoga olib kelmaydi", () => {
    expect(collectUnlinkedCodes(undefined)).toEqual([]);
    expect(collectUnlinkedCodes([{}])).toEqual([]);
  });
});

describe("scienceLinker — loadCatalogByCodes (N+1 qopqoni)", () => {
  test("nechta kod bo'lsa ham BITTA $in so'rovi yuboriladi", async () => {
    mockFind([
      { _id: SCI_ID, scienceCode: "FA1200", department: DEP_ID },
      { _id: "cccccccccccccccccccccccc", scienceCode: "FA1001", department: null },
    ]);

    const catalog = await loadCatalogByCodes(["FA1200", "FA1001", "TM104"]);

    expect(ScienceModel.find).toHaveBeenCalledTimes(1);
    expect(ScienceModel.find).toHaveBeenCalledWith({
      scienceCode: { $in: ["FA1200", "FA1001", "TM104"] },
    });
    expect(catalog.size).toBe(2);
    expect(catalog.get("FA1200")).toEqual({ _id: SCI_ID, department: DEP_ID });
  });

  test("kod bo'lmasa umuman so'rov yuborilmaydi", async () => {
    mockFind([]);
    const catalog = await loadCatalogByCodes([]);

    expect(ScienceModel.find).not.toHaveBeenCalled();
    expect(catalog.size).toBe(0);
  });
});

describe("scienceLinker — canonicalizeScienceCode", () => {
  test.each([
    ["GS12308", "GS12-308"],
    ["BK13408", "BK13-408"],
    ["FZ13408", "FZ13-408"],
    ["MB13408", "MB13-408"],
  ])("tire olib tashlanadi: %s ≡ %s", (a, b) => {
    expect(canonicalizeScienceCode(a)).toBe(canonicalizeScienceCode(b));
  });

  test("apostrof variantlari (ASCII, U+2018, U+2019, U+02BB, U+02BC, backtick) birlashadi", () => {
    const variants = ["O'YT1104", "O‘YT1104", "O’YT1104", "OʻYT1104", "OʼYT1104", "O`YT1104"];
    const canonical = canonicalizeScienceCode(variants[0]);
    for (const v of variants) {
      expect(canonicalizeScienceCode(v)).toBe(canonical);
    }
  });

  test("registr farqi bartaraf qilinadi", () => {
    expect(canonicalizeScienceCode("fa1200")).toBe(canonicalizeScienceCode("FA1200"));
  });

  test("bo'sh/yo'q kod uchun bo'sh satr qaytaradi", () => {
    expect(canonicalizeScienceCode(null)).toBe("");
    expect(canonicalizeScienceCode(undefined)).toBe("");
    expect(canonicalizeScienceCode("")).toBe("");
  });

  test("kod boshqa bo'lsa kanonik shakl ham BOSHQA qoladi (fuzzy moslash yo'q)", () => {
    expect(canonicalizeScienceCode("FA120")).not.toBe(canonicalizeScienceCode("FA1200"));
  });
});

describe("scienceLinker — resolveLink (kanonik taqqoslash bilan)", () => {
  test("tire farqi — reja kodi GS12308, katalog GS12-308 — bog'lanadi", () => {
    const catalog = catalogOf([
      { _id: SCI_ID, scienceCode: "GS12-308", department: DEP_ID },
    ]);
    const link = resolveLink({ code: "GS12308", title: "Fan", science: null }, catalog);

    expect(link.status).toBe(LINK_STATUS.FILLED);
    expect(link.science).toBe(SCI_ID);
  });

  test("apostrof farqi (ASCII vs U+2018) — bog'lanadi", () => {
    const catalog = catalogOf([
      { _id: SCI_ID, scienceCode: "O‘YT1104", department: DEP_ID },
    ]);
    const link = resolveLink({ code: "O'YT1104", title: "Fan", science: null }, catalog);

    expect(link.status).toBe(LINK_STATUS.FILLED);
  });

  test("registr farqi — bog'lanadi", () => {
    const catalog = catalogOf([
      { _id: SCI_ID, scienceCode: "fa1200", department: DEP_ID },
    ]);
    const link = resolveLink({ code: "FA1200", title: "Fan", science: null }, catalog);

    expect(link.status).toBe(LINK_STATUS.FILLED);
  });

  test("NOM o'xshash, lekin kod boshqa — bog'lanMAYDI (fuzzy moslash yo'q)", () => {
    const catalog = catalogOf([
      { _id: SCI_ID, scienceCode: "FA1200", department: DEP_ID, title: "Gigiyena" },
    ]);
    const link = resolveLink(
      { code: "FA9999", title: "Gigiena", science: null },
      catalog,
    );

    expect(link.status).toBe(LINK_STATUS.NOT_IN_CATALOG);
    expect(link.science).toBeNull();
  });
});

describe("scienceLinker — buildCatalog noaniqlik qo'riqchisi", () => {
  test("ikkita katalog yozuvi bitta kanonik shaklga tushsa — bog'lanMAYDI", () => {
    const warnSpy = jest.spyOn(winston, "warn").mockImplementation(() => {});

    const catalog = buildCatalog([
      { _id: "s1", scienceCode: "GS12-308", department: "d1" },
      { _id: "s2", scienceCode: "GS12308", department: "d2" },
    ]);

    expect(catalog.has("GS12308")).toBe(false);
    expect(catalog.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/Noaniq kod/);

    warnSpy.mockRestore();
  });

  test("noaniq guruh bog'lanmagan holatda ham boshqa kodlar normal bog'lanadi", () => {
    jest.spyOn(winston, "warn").mockImplementation(() => {});

    const catalog = buildCatalog([
      { _id: "s1", scienceCode: "GS12-308", department: "d1" },
      { _id: "s2", scienceCode: "GS12308", department: "d2" },
      { _id: "s3", scienceCode: "FA1001", department: "d3" },
    ]);

    expect(catalog.has("GS12308")).toBe(false);
    expect(catalog.get("FA1001")).toEqual({ _id: "s3", department: "d3" });

    winston.warn.mockRestore();
  });
});

describe("scienceLinker — lookupCanonical", () => {
  test("katalogdan kanonik kod bo'yicha topadi", () => {
    const catalog = catalogOf([
      { _id: SCI_ID, scienceCode: "GS12-308", department: DEP_ID },
    ]);
    expect(lookupCanonical(catalog, "GS12308")).toEqual({ _id: SCI_ID, department: DEP_ID });
  });

  test("bo'sh kod uchun null qaytaradi (so'rov yuborilmaydi)", () => {
    const catalog = catalogOf([{ _id: SCI_ID, scienceCode: "FA1200", department: DEP_ID }]);
    expect(lookupCanonical(catalog, "")).toBeNull();
    expect(lookupCanonical(catalog, null)).toBeNull();
  });
});
