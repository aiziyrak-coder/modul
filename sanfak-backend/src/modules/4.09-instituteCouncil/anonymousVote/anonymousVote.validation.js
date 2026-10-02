const Joi = require("joi");
const { optionalObjectId } = require("#validators/common");

const voteSchema = Joi.object({
  session: Joi.string().required(),
  candidate: optionalObjectId(),
  choice: Joi.string().valid("for", "against", "abstain").required(),
});

const myVoteParamsSchema = Joi.object({
  sessionId: Joi.string().hex().length(24).required(),
});

module.exports = { voteSchema, myVoteParamsSchema };
