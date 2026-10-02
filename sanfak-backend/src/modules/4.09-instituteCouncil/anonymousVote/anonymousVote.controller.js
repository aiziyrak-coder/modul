const { ErrorHandler } = require("#shared/error");
const service = require("./anonymousVote.service");

const VOTE_ERROR_STATUS = {
  ALREADY_VOTED: 409,
  SESSION_NOT_FOUND: 404,
  NOT_COUNCIL_MEMBER: 403,
  SESSION_NOT_ACTIVE: 400,
  VOTING_NOT_STARTED: 400,
  VOTING_ENDED: 400,
  CANDIDATE_REQUIRED: 400,
  INVALID_CANDIDATE: 400,
  CANDIDATE_NOT_ALLOWED: 400,
};

module.exports = {
  castVote: async (req, res, next) => {
    try {
      const { session, candidate, choice } = req.body;
      const voter = String(req.user._id);

      const doc = await service.castVote({ session, voter, candidate, choice });
      return res
        .status(201)
        .json({ message: "vote cast successfully", _id: doc._id });
    } catch (err) {
      const status = err && VOTE_ERROR_STATUS[err.code];
      if (status) {
        return next(new ErrorHandler(status, err.message, err.message));
      }
      return next(new ErrorHandler(400, "Failed to cast vote", err.message));
    }
  },

  myVote: async (req, res, next) => {
    try {
      const voter = String(req.user._id);
      const vote = await service.myVote(req.params.sessionId, voter);
      return res.status(200).json({
        hasVoted: Boolean(vote),
        choice: vote?.choice ?? null,
        candidate: vote?.candidate ?? null,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to get my vote", err.message));
    }
  },

  participation: async (req, res, next) => {
    try {
      const rows = await service.participation(req.params.sessionId);
      if (rows === null) {
        return res.status(404).json({ message: "voting session not found" });
      }
      return res.status(200).json(rows);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get participation", err.message),
      );
    }
  },

  tally: async (req, res, next) => {
    try {
      const docs = await service.tally(req.params.sessionId);
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to get votes", err.message));
    }
  },
};
