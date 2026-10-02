const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencyAttestation.controller");
const V = require("./residencyAttestation.validation");

router.use(authenticate);

const M = MODULES.RESIDENCY_ATTESTATION;

router
  .route("/")
  .post(permit(M, [ACTIONS.CREATE]), validator.body(V.createSchema), C.addAttestation)
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.findAllAttestations);

router
  .route("/preview")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.previewQuery), C.preview);

router
  .route("/paginate")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.paginateAttestations);

router
  .route("/:id/results")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.params(V.idSchema), C.listResults);

router
  .route("/:id/results/:resultId")
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.resultParam),
    validator.body(V.resultUpdateSchema),
    C.updateResult,
  )
  .delete(permit(M, [ACTIONS.DELETE]), validator.params(V.resultParam), C.deleteResult);

router
  .route("/:id")
  .get(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.findOneAttestation)
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateAttestation,
  )
  .delete(permit(M, [ACTIONS.DELETE]), validator.params(V.idSchema), C.deleteAttestation);

module.exports = router;
