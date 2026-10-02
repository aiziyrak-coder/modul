const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./scholarship.controller");
const {
  scholarshipSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./scholarship.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.SCHOLARSHIP, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.SCHOLARSHIP, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.SCHOLARSHIP, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.SCHOLARSHIP, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.SCHOLARSHIP, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(scholarshipSchema), Controller.addScholarship)
  .get(permitReadAll, validator.query(findAll), Controller.findAllScholarships);

router
  .route("/paginate")
  .get(permitReadAll, validator.query(paginate), Controller.paginateScholarships);

router.route("/judge-candidates").get(permitAdd, Controller.judgeCandidates);

router
  .route("/:id/applicants")
  .get(permitFindOne, validator.params(readSchema), Controller.findApplicants);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneScholarship)
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateSchema),
    Controller.updateScholarship,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteScholarship);

module.exports = router;
