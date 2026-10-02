const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./oakJournal.controller");
const {
  createJournalSchema,
  updateJournalSchema,
  journalQuerySchema,
  journalPaginateSchema,
} = require("./oakJournal.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.OAK_JOURNAL, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.OAK_JOURNAL, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.OAK_JOURNAL, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.OAK_JOURNAL, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.OAK_JOURNAL, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(createJournalSchema), Controller.addJournal)
  .get(
    permitReadAll,
    validator.query(journalQuerySchema),
    Controller.findAllJournals,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    validator.query(journalPaginateSchema),
    Controller.paginateJournals,
  );

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneJournal)
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateJournalSchema),
    Controller.updateJournal,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteJournal,
  );

module.exports = router;
