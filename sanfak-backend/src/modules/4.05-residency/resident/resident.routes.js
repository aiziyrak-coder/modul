const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const scopeFilter = require("#shared/scopeFilter");
const Controller = require("./resident.controller");
const V = require("./resident.validation");
const { guardFileUrl } = require("#modules/4.05-residency/_services/fileUrlGuard");
const { receiveRoster, inspectRoster } = require("./resident.import");

router.use(authenticate);

const scope = scopeFilter("department", {
  bypassRoles: [ROLES.MAGISTRATURA_BOLIM],
});

const permitCreate = permit(MODULES.RESIDENT, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.RESIDENT, [ACTIONS.READ_ALL]);
const permitRead = permit(MODULES.RESIDENT, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.RESIDENT, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.RESIDENT, [ACTIONS.DELETE]);
const permitChangeStatus = permit(MODULES.RESIDENT, [ACTIONS.CHANGE_STATUS]);

router
  .route("/")
  .post(
    permitCreate,
    guardFileUrl("diplomaFileUrl"),
    validator.body(V.createResidentSchema),
    Controller.addResident,
  )
  .get(permitReadAll, scope, validator.query(V.listQuery), Controller.findAllResidents);

router
  .route("/paginate")
  .get(permitReadAll, scope, validator.query(V.paginateQuery), Controller.paginateResidents);

router
  .route("/import")
  .post(
    permitCreate,
    receiveRoster,
    inspectRoster,
    validator.query(V.importQuery),
    Controller.importResidents,
  );

router
  .route("/import-template")
  .get(permitCreate, validator.query(V.templateQuery), Controller.importTemplate);

router
  .route("/supervisors/:id")
  .get(permitReadAll, validator.params(V.idSchema), Controller.getSupervisorCard);

router.route("/my").get(permitRead, Controller.getMyResident);

router
  .route("/my-residents")
  .get(permitReadAll, validator.query(V.listQuery), Controller.getMyResidents);

router
  .route("/:id/assign")
  .put(
    permitUpdate,
    validator.params(V.idSchema),
    validator.body(V.assignSupervisorSchema),
    Controller.assignSupervisor,
  );

router
  .route("/:id/status")
  .patch(
    permitChangeStatus,
    validator.params(V.idSchema),
    validator.body(V.changeStatusSchema),
    Controller.changeResidentStatus,
  );

router
  .route("/:id")
  .get(permitRead, validator.params(V.idSchema), Controller.findOneResident)
  .put(
    permitUpdate,
    validator.params(V.idSchema),
    guardFileUrl("diplomaFileUrl"),
    validator.body(V.updateResidentSchema),
    Controller.updateResident,
  )
  .delete(permitDelete, validator.params(V.idSchema), Controller.deleteResident);

module.exports = router;
