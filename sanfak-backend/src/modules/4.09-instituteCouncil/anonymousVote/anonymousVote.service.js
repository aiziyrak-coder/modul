const AnonymousVote = require("./anonymousVote.model");
const VotingSession = require("#modules/4.09-instituteCouncil/votingSession/votingSession.model");
const CouncilMember = require("#modules/4.09-instituteCouncil/councilMember/councilMember.model");

const EXCLUDE = { createdAt: 0, updatedAt: 0, voter: 0 };

const DUPLICATE_CODE = 11000;

const voteError = (code, message) => {
  const err = new Error(message);
  err.code = code;
  return err;
};

module.exports = {
  castVote: async ({ session, voter, candidate, choice }) => {
    const votingSession = await VotingSession.findById(session).exec();
    if (!votingSession) {
      throw voteError("SESSION_NOT_FOUND", "voting session not found");
    }
    if (votingSession.status !== "active" || votingSession.active === false) {
      throw voteError("SESSION_NOT_ACTIVE", "voting session is not active");
    }
    const now = Date.now();
    if (
      votingSession.startDate &&
      now < new Date(votingSession.startDate).getTime()
    ) {
      throw voteError("VOTING_NOT_STARTED", "voting has not started yet");
    }
    if (
      votingSession.endDate &&
      now > new Date(votingSession.endDate).getTime()
    ) {
      throw voteError("VOTING_ENDED", "voting period has ended");
    }

    const isMember = await CouncilMember.exists({
      user: voter,
      canVote: true,
      active: true,
    });
    if (!isMember) {
      throw voteError(
        "NOT_COUNCIL_MEMBER",
        "voter is not an active council member with voting rights",
      );
    }

    if (votingSession.mode === "choice") {
      if (!candidate) {
        throw voteError(
          "CANDIDATE_REQUIRED",
          "candidate is required in choice mode",
        );
      }
      const allowed = (votingSession.candidates || []).some(
        (item) => item.user && String(item.user) === String(candidate),
      );
      if (!allowed) {
        throw voteError(
          "INVALID_CANDIDATE",
          "candidate does not belong to this voting session",
        );
      }
    } else if (candidate) {
      throw voteError(
        "CANDIDATE_NOT_ALLOWED",
        "candidate is not allowed in single mode",
      );
    }

    try {
      return await new AnonymousVote({
        session,
        voter,
        candidate,
        choice,
      }).save();
    } catch (err) {
      if (err && err.code === DUPLICATE_CODE) {
        throw voteError("ALREADY_VOTED", "already voted");
      }
      throw err;
    }
  },

  hasVoted: async (session, voter) => {
    const doc = await AnonymousVote.exists({ session, voter });
    return Boolean(doc);
  },

  myVote: (session, voter) =>
    AnonymousVote.findOne({ session, voter }, EXCLUDE).exec(),

  tally: (session) => AnonymousVote.find({ session }, EXCLUDE).exec(),

  participation: async (session) => {
    const exists = await VotingSession.exists({ _id: session });
    if (!exists) return null;
    const [members, votes] = await Promise.all([
      CouncilMember.find({ active: true, canVote: true })
        .populate("user", "firstName lastName middleName")
        .select("user department")
        .populate("department", "title")
        .lean(),
      AnonymousVote.find({ session, active: true }).select("voter").lean(),
    ]);
    const voted = new Set(votes.map((v) => String(v.voter)));
    return members
      .filter((m) => m.user)
      .map((m) => ({
        user: m.user,
        department: m.department || null,
        voted: voted.has(String(m.user._id)),
      }));
  },
};
