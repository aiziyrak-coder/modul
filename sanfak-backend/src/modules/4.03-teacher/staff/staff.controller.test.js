jest.mock("./staff.service");

const service = require("./staff.service");
const Controller = require("./staff.controller");
const { ErrorHandler } = require("#shared/error");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("addStaff", () => {
  test("201 + _id", async () => {
    service.create.mockResolvedValue({ _id: "u1" });
    const res = createRes();

    await Controller.addStaff({ body: {} }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "Xodim yaratildi", _id: "u1" });
  });

  test("service xato tashlasa -> next(err)", async () => {
    service.create.mockRejectedValue(new ErrorHandler(500, "`oqituvchi` roli topilmadi"));
    const next = jest.fn();

    await Controller.addStaff({ body: {} }, createRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });
});

describe("updateStaff / deleteStaff — 403 service xatosi to'g'ridan-to'g'ri o'tadi", () => {
  test("update — service 403 tashlasa, controller uni o'zgartirmasdan uzatadi", async () => {
    service.update.mockRejectedValue(new ErrorHandler(403, "Bu foydalanuvchi oqituvchi rolida emas"));
    const next = jest.fn();

    await Controller.updateStaff({ params: { id: "x" }, body: {} }, createRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("delete — service 403 tashlasa, controller uni o'zgartirmasdan uzatadi", async () => {
    service.remove.mockRejectedValue(new ErrorHandler(403, "Bu foydalanuvchi oqituvchi rolida emas"));
    const next = jest.fn();

    await Controller.deleteStaff({ params: { id: "x" } }, createRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("delete — muvaffaqiyatli soft delete 200 qaytaradi", async () => {
    service.remove.mockResolvedValue({ _id: "u1", active: false });
    const res = createRes();

    await Controller.deleteStaff({ params: { id: "u1" } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Xodim o'chirildi" });
  });
});

describe("restoreStaff — C-1 (2026-07-31)", () => {
  test("topilmasa 404", async () => {
    service.restore.mockResolvedValue(null);
    const res = createRes();

    await Controller.restoreStaff({ params: { id: "x" } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("muvaffaqiyatli tiklansa 200", async () => {
    service.restore.mockResolvedValue({ _id: "u1", active: true });
    const res = createRes();

    await Controller.restoreStaff({ params: { id: "u1" } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Xodim tiklandi" });
  });

  test("service 400 (allaqachon faol) tashlasa, controller o'zgartirmasdan uzatadi", async () => {
    service.restore.mockRejectedValue(new ErrorHandler(400, "Bu xodim allaqachon faol"));
    const next = jest.fn();

    await Controller.restoreStaff({ params: { id: "u1" } }, createRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  test("service 403 (boshqa rol) tashlasa, controller o'zgartirmasdan uzatadi", async () => {
    service.restore.mockRejectedValue(new ErrorHandler(403, "Bu foydalanuvchi oqituvchi rolida emas"));
    const next = jest.fn();

    await Controller.restoreStaff({ params: { id: "u1" } }, createRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe("findOneStaff", () => {
  test("topilmasa 404", async () => {
    service.findOne.mockResolvedValue(null);
    const res = createRes();

    await Controller.findOneStaff({ params: { id: "x" } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("topilsa 200 + doc", async () => {
    service.findOne.mockResolvedValue({ _id: "u1", firstName: "Ali" });
    const res = createRes();

    await Controller.findOneStaff({ params: { id: "u1" } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ _id: "u1", firstName: "Ali" });
  });
});

describe("paginateStaff / findAllStaff", () => {
  test("paginate — `{docs, totalDocs}` shaklini o'zgartirmasdan qaytaradi (FE `usePage` kontrakti)", async () => {
    service.paginate.mockResolvedValue({ docs: [{ _id: "u1" }], totalDocs: 1 });
    const res = createRes();

    await Controller.paginateStaff({ query: {} }, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ docs: [{ _id: "u1" }], totalDocs: 1 });
  });

  test("findAll — ro'yxatni to'g'ridan-to'g'ri qaytaradi", async () => {
    service.findAll.mockResolvedValue([{ _id: "u1" }]);
    const res = createRes();

    await Controller.findAllStaff({ query: {} }, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith([{ _id: "u1" }]);
  });
});
