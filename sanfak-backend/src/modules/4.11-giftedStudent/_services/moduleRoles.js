const { MODULES, ACTIONS } = require("#config/constants");
const { roleMatches } = require("./roleEligibility");

const REGISTRY_OWNER = { required: [[MODULES.GIFTED_STUDENT, ACTIONS.CREATE]] };

const JUDGE = {
  required: [[MODULES.SCHOLARSHIP_APPLICATION, ACTIONS.SCORE]],
  excluding: [[MODULES.SCHOLARSHIP, ACTIONS.CREATE]],
};

const ADVISOR = {
  required: [
    [MODULES.GIFTED_STUDENT, ACTIONS.READ_ALL],
    [MODULES.CHAT, ACTIONS.CREATE],
  ],
  excluding: [[MODULES.GIFTED_STUDENT, ACTIONS.CREATE]],
};

const STUDENT = {
  required: [[MODULES.STUDENT_ACHIEVEMENT, ACTIONS.CREATE]],
  excluding: [[MODULES.GIFTED_STUDENT, ACTIONS.CREATE]],
};

const OBSERVER = {
  required: [[MODULES.GIFTED_STUDENT, ACTIONS.READ_ALL]],
  excluding: [
    [MODULES.GIFTED_STUDENT, ACTIONS.CREATE],
    [MODULES.CHAT, ACTIONS.CREATE],
  ],
};

const ACHIEVEMENT_REVIEWER = {
  required: [[MODULES.STUDENT_ACHIEVEMENT, ACTIONS.APPROVE]],
};

const APPLICATION_REVIEWER = {
  required: [[MODULES.SCHOLARSHIP_APPLICATION, ACTIONS.UPDATE]],
};

const is = (profile) => (role) => roleMatches(role, profile.required, profile);

const isRegistryOwner = is(REGISTRY_OWNER);
const isJudge = is(JUDGE);
const isAdvisor = is(ADVISOR);
const isStudent = is(STUDENT);
const isObserver = is(OBSERVER);
const isAchievementReviewer = is(ACHIEVEMENT_REVIEWER);
const isApplicationReviewer = is(APPLICATION_REVIEWER);

module.exports = {
  REGISTRY_OWNER,
  JUDGE,
  ADVISOR,
  STUDENT,
  OBSERVER,
  ACHIEVEMENT_REVIEWER,
  APPLICATION_REVIEWER,
  isRegistryOwner,
  isJudge,
  isAdvisor,
  isStudent,
  isObserver,
  isAchievementReviewer,
  isApplicationReviewer,
};
