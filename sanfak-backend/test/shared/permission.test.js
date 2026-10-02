const permit = require("#shared/permission");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const { createMockReq, createMockNext } = require("../helpers/mockResponse");

const run = async (middleware, req) => {
  const next = createMockNext();
  await middleware(req, {}, next);
  return next.mock.calls[0]?.[0];
};

describe("permit() — RBAC middleware", () => {
  test("SUPER_ADMIN hamma narsani bypass qiladi", async () => {
    const req = createMockReq({
      user: { role: { title: ROLES.SUPER_ADMIN, permissions: [] } },
    });
    const err = await run(permit(MODULES.TASK, [ACTIONS.READ_ALL]), req);
    expect(err).toBeUndefined();
  });

  test("ruxsat yo'q -> 403", async () => {
    const req = createMockReq({
      user: { role: { title: "oqituvchi", permissions: [] } },
    });
    const err = await run(permit(MODULES.TASK, [ACTIONS.READ_ALL]), req);
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("to'g'ri actionKey bilan -> o'tadi", async () => {
    const req = createMockReq({
      user: {
        role: {
          title: "oqituvchi",
          permissions: [{ section: MODULES.TASK, actionKeys: [ACTIONS.READ_ALL] }],
        },
      },
    });
    const err = await run(permit(MODULES.TASK, [ACTIONS.READ_ALL]), req);
    expect(err).toBeUndefined();
  });

  test("req.user yo'q -> 500 (authenticate avval chaqirilmagan)", async () => {
    const req = createMockReq({ user: undefined });
    const err = await run(permit(MODULES.TASK, [ACTIONS.READ_ALL]), req);
    expect(err?.statusCode).toBe(500);
  });
});
