const router = require("./workingSchedule.routes");

describe("workingSchedule.routes — /status/:id mount qilinmagan (E-3 fix)", () => {
  test("router qatlamlarida path='/status/:id' + method=patch YO'Q", () => {
    const statusPatchLayer = router.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/status/:id" &&
        layer.route.methods &&
        layer.route.methods.patch,
    );
    expect(statusPatchLayer).toBeUndefined();
  });

  test("PATCH /approve/:id va /reject/:id hali mavjud (approval oqimi buzilmagan)", () => {
    const approveLayer = router.stack.find(
      (layer) => layer.route && layer.route.path === "/approve/:id",
    );
    const rejectLayer = router.stack.find(
      (layer) => layer.route && layer.route.path === "/reject/:id",
    );
    expect(approveLayer).toBeDefined();
    expect(rejectLayer).toBeDefined();
  });
});
