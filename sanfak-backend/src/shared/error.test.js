"use strict";

const { ErrorHandler, handleError } = require("./error");

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("handleError — production'da 5xx `detail` yashiriladi", () => {
  const ORIG_ENV = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = ORIG_ENV;
  });

  it("dev + 5xx — detail ko'rinadi (o'zgarishsiz)", () => {
    process.env.NODE_ENV = "dev";
    const res = mockRes();
    handleError(new ErrorHandler(500, "Server xatosi", "stack trace ...ichki tafsilot"), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].detail).toBe("stack trace ...ichki tafsilot");
  });

  it("production + 5xx — detail bo'shatiladi", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    handleError(new ErrorHandler(500, "Server xatosi", "stack trace ...ichki tafsilot"), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].detail).toBe("");
  });

  it("production + 4xx — detail SAQLANADI (frontend tayanadi)", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    handleError(new ErrorHandler(400, "Validatsiya xatosi", "\"name\" majburiy"), res);
    expect(res.json.mock.calls[0][0].detail).toBe("\"name\" majburiy");
  });

  it("dev + 4xx — detail SAQLANADI", () => {
    process.env.NODE_ENV = "dev";
    const res = mockRes();
    handleError(new ErrorHandler(400, "Validatsiya xatosi", "\"name\" majburiy"), res);
    expect(res.json.mock.calls[0][0].detail).toBe("\"name\" majburiy");
  });

  it("production + 5xx — `meta` baribir saqlanadi (frontend gating)", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    handleError(
      new ErrorHandler(500, "Server xatosi", "ichki", { reason: "scope" }),
      res,
    );
    expect(res.json.mock.calls[0][0].reason).toBe("scope");
  });
});

describe("handleError — fail-CLOSED NODE_ENV", () => {
  const ORIG_ENV = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = ORIG_ENV;
  });

  it.each(["prod", "Production", "", undefined])(
    "NODE_ENV=%p ham 'production' kabi ishlaydi — detail bo'shatiladi",
    (value) => {
      if (value === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = value;
      const res = mockRes();
      handleError(new ErrorHandler(500, "Server xatosi", "ichki tafsilot"), res);
      expect(res.json.mock.calls[0][0].detail).toBe("");
    },
  );

  it.each(["development", "test"])(
    "NODE_ENV=%p — dev hisoblanadi, detail ko'rinadi",
    (value) => {
      process.env.NODE_ENV = value;
      const res = mockRes();
      handleError(new ErrorHandler(500, "Server xatosi", "ichki tafsilot"), res);
      expect(res.json.mock.calls[0][0].detail).toBe("ichki tafsilot");
    },
  );
});

describe("handleError — xom 5xx `message` maskalanadi", () => {
  const ORIG_ENV = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = ORIG_ENV;
  });

  it("production + XOM (ErrorHandler EMAS) 5xx — message umumiy matnga almashtiriladi", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    const rawErr = new Error("ENOENT: /etc/secret/db-config.json topilmadi");
    rawErr.statusCode = 500;
    handleError(rawErr, res);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe("Ichki server xatosi");
    expect(body.message).not.toMatch(/secret|ENOENT/);
  });

  it("production + ATAYLAB tashlangan ErrorHandler 5xx — message SAQLANADI", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    handleError(
      new ErrorHandler(500, "Fan dasturi PDF yaratishda xatolik", "ichki stack"),
      res,
    );
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe("Fan dasturi PDF yaratishda xatolik");
    expect(body.detail).toBe("");
  });

  it("dev + xom 5xx — message maskalanmaydi", () => {
    process.env.NODE_ENV = "dev";
    const res = mockRes();
    const rawErr = new Error("CastError: yaroqsiz ObjectId");
    rawErr.statusCode = 500;
    handleError(rawErr, res);
    expect(res.json.mock.calls[0][0].message).toBe("CastError: yaroqsiz ObjectId");
  });

  it("production + xom 4xx — message maskalanmaydi (faqat 5xx maskalanadi)", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    const rawErr = new Error("\"name\" majburiy");
    rawErr.statusCode = 400;
    handleError(rawErr, res);
    expect(res.json.mock.calls[0][0].message).toBe("\"name\" majburiy");
  });
});
