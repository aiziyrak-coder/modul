const createMockReq = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  user: { _id: "507f1f77bcf86cd799439011", role: { title: "kafedra_mudiri" } },
  originalUrl: "/api/workloads/approve/507f1f77bcf86cd799439012",
  ...overrides,
});

const createMockNext = () => jest.fn();

const loadEriGuard = (eriRequiredEnv) => {
  jest.resetModules();
  const prev = process.env.ERI_REQUIRED;
  if (eriRequiredEnv === undefined) {
    delete process.env.ERI_REQUIRED;
  } else {
    process.env.ERI_REQUIRED = eriRequiredEnv;
  }
  const eriGuard = require("./eriGuard");
  process.env.ERI_REQUIRED = prev;
  return eriGuard;
};

const run = (middleware, req) =>
  new Promise((resolve) => {
    const next = createMockNext();
    Promise.resolve(middleware(req, {}, next)).then(() => {
      resolve(next);
    });
  });

describe("eriGuard() — soft-mode (default, ERI_REQUIRED yo'q/false)", () => {
  test("imzosiz so'rov → next() xatosiz chaqiriladi (mavjud oqim buzilmaydi)", async () => {
    const eriGuard = loadEriGuard(undefined);
    const req = createMockReq({ body: {} });
    const next = await run(eriGuard(), req);

    expect(next).toHaveBeenCalledWith();
    expect(req.eri).toBeUndefined();
  });

  test("TEMP_ERI_PLACEHOLDER → o'tkaziladi (400 EMAS — regressiya himoyasi)", async () => {
    const eriGuard = loadEriGuard(undefined);
    const req = createMockReq({
      body: { eriSignature: "TEMP_ERI_PLACEHOLDER" },
    });
    const next = await run(eriGuard(), req);

    expect(next).toHaveBeenCalledWith();
    const err = next.mock.calls[0][0];
    expect(err).toBeUndefined();
  });

  test("ERI_REQUIRED='false' aniq berilganda ham xulq bir xil (soft-mode)", async () => {
    const eriGuard = loadEriGuard("false");
    const req = createMockReq({ body: {} });
    const next = await run(eriGuard(), req);

    expect(next).toHaveBeenCalledWith();
  });
});

describe("eriGuard() — qattiq rejim (ERI_REQUIRED='true')", () => {
  test("imzosiz so'rov → xato (kelajakdagi xulq qulflansin)", async () => {
    const eriGuard = loadEriGuard("true");
    const req = createMockReq({ body: {} });
    const next = await run(eriGuard(), req);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  test("TEMP_ERI_PLACEHOLDER → bypass ISHLAMAYDI (haqiqiy PKCS#7 emas → xato)", async () => {
    const eriGuard = loadEriGuard("true");
    const req = createMockReq({
      body: { eriSignature: "TEMP_ERI_PLACEHOLDER" },
    });
    const next = await run(eriGuard(), req);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBeGreaterThanOrEqual(400);
  }, 15000);
});
