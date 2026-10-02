jest.mock("./auditLog.model");

const AuditLogModel = require("./auditLog.model");
const service = require("./auditLog.service");

const makeChain = () => {
  const chain = {};
  for (const m of ["select", "populate", "sort", "limit", "lean"]) {
    chain[m] = jest.fn(() => chain);
  }
  chain.exec = jest.fn().mockResolvedValue([]);
  return chain;
};

const SECRET = /oneIdPin|refreshToken|password|eriCertificate|passport/i;

beforeEach(() => jest.clearAllMocks());

describe("auditLog.service — maxfiy maydon user-populate'da chiqmaydi", () => {
  test("paginate — populate.select faqat ism (oneIdPin YO'Q)", async () => {
    AuditLogModel.paginate = jest.fn().mockResolvedValue({ docs: [] });

    await service.paginate({});

    const opts = AuditLogModel.paginate.mock.calls[0][1];
    expect(opts.populate.select).toBe("firstName lastName");
    expect(opts.populate.select).not.toMatch(SECRET);
  });

  test("findById — populate select oneIdPin'siz", async () => {
    const chain = makeChain();
    AuditLogModel.findById = jest.fn(() => chain);

    await service.findById("64b0000000000000000000ab");

    expect(chain.populate).toHaveBeenCalledWith("user", "firstName lastName");
    const [, select] = chain.populate.mock.calls[0];
    expect(select).not.toMatch(SECRET);
  });

  test("listForExport (XLSX/PDF) — populate select oneIdPin'siz", async () => {
    const chain = makeChain();
    AuditLogModel.find = jest.fn(() => chain);

    await service.listForExport({});

    expect(chain.populate).toHaveBeenCalledWith("user", "firstName lastName");
    const [, select] = chain.populate.mock.calls[0];
    expect(select).not.toMatch(SECRET);
  });
});
