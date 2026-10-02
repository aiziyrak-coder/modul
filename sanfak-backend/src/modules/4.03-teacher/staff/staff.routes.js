"use strict";

const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const Controller = require("./staff.controller");
const {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  idSchema,
} = require("./staff.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.STAFF, [ACTIONS.CREATE]);
const permitRead = permit(MODULES.STAFF, [ACTIONS.READ_ALL]);
const permitOne = permit(MODULES.STAFF, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.STAFF, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.STAFF, [ACTIONS.DELETE]);
const permitExport = permit(MODULES.STAFF, [ACTIONS.EXPORT]);

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createSchema),
    Controller.addStaff,
  )
  .get(permitRead, validator.query(findAll), Controller.findAllStaff);

router
  .route("/paginate")
  .get(permitRead, validator.query(paginate), Controller.paginateStaff);

router
  .route("/export")
  .get(permitExport, validator.query(findAll), Controller.exportStaff);

router
  .route("/:id")
  .get(permitOne, validator.params(idSchema), Controller.findOneStaff)
  .put(
    permitUpdate,
    uploadImages,
    resizeImages,
    validator.params(idSchema),
    validator.body(updateSchema),
    Controller.updateStaff,
  )
  .delete(permitDelete, validator.params(idSchema), Controller.deleteStaff);

router
  .route("/:id/restore")
  .patch(permitUpdate, validator.params(idSchema), Controller.restoreStaff);

module.exports = router;
