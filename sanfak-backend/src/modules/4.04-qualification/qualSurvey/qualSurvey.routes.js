const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualSurvey.controller");
const Validation = require("./qualSurvey.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/my")
  .get(permit(MODULES.QUAL_SURVEY, [ACTIONS.READ]), Controller.mySurvey);

router
  .route("/my/submit")
  .post(
    permit(MODULES.QUAL_SURVEY_ANSWER, [ACTIONS.CREATE]),
    validator.body(Validation.submitSchema),
    Controller.submit,
  );

router
  .route("/answers/paginate")
  .get(
    permit(MODULES.QUAL_SURVEY_ANSWER, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.answersPaginate,
  );

router
  .route("/answers/summary")
  .get(permit(MODULES.QUAL_SURVEY_ANSWER, [ACTIONS.READ_ALL]), Controller.answersSummary);

router
  .route("/answers/status")
  .get(permit(MODULES.QUAL_SURVEY_ANSWER, [ACTIONS.READ_ALL]), Controller.answersStatus);

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_SURVEY, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginate,
  );

router
  .route("/bulk")
  .post(
    permit(MODULES.QUAL_SURVEY, [ACTIONS.CREATE]),
    validator.body(Validation.bulkSchema),
    Controller.bulkCreate,
  );

router
  .route("/reorder")
  .patch(
    permit(MODULES.QUAL_SURVEY, [ACTIONS.UPDATE]),
    validator.body(Validation.reorderSchema),
    Controller.reorder,
  );

router
  .route("/")
  .get(permit(MODULES.QUAL_SURVEY, [ACTIONS.READ_ALL]), Controller.findAll)
  .post(
    permit(MODULES.QUAL_SURVEY, [ACTIONS.CREATE]),
    validator.body(Validation.createSchema),
    Controller.create,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.QUAL_SURVEY, [ACTIONS.UPDATE]),
    validator.body(Validation.updateSchema),
    Controller.update,
  )
  .delete(permit(MODULES.QUAL_SURVEY, [ACTIONS.DELETE]), Controller.remove);

module.exports = router;
