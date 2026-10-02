jest.mock("./anonymousVote.model");
jest.mock("#modules/4.09-instituteCouncil/votingSession/votingSession.model");
jest.mock("#modules/4.09-instituteCouncil/councilMember/councilMember.model");

const AnonymousVote = require("./anonymousVote.model");
const VotingSession = require("#modules/4.09-instituteCouncil/votingSession/votingSession.model");
const CouncilMember = require("#modules/4.09-instituteCouncil/councilMember/councilMember.model");
const service = require("./anonymousVote.service");

const DAY = 86400000;
const activeSession = (over = {}) => ({
  _id: "s1",
  status: "active",
  active: true,
  mode: "single",
  candidates: [],
  startDate: new Date(Date.now() - DAY),
  endDate: new Date(Date.now() + DAY),
  ...over,
});

const mockSession = (doc) => {
  VotingSession.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
};

const vote = (over = {}) =>
  service.castVote({ session: "s1", voter: "u1", choice: "for", ...over });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("castVote — faqat ovoz huquqiga ega faol kengash a'zosi (TZ 4.9.4)", () => {
  test("a'zo bo'lmagan foydalanuvchi → NOT_COUNCIL_MEMBER, ovoz saqlanmaydi", async () => {
    mockSession(activeSession());
    CouncilMember.exists.mockResolvedValue(null);

    await expect(vote()).rejects.toMatchObject({ code: "NOT_COUNCIL_MEMBER" });
    expect(AnonymousVote).not.toHaveBeenCalled();
  });

  test("tekshiruv aynan {user, canVote:true, active:true} bo'yicha", async () => {
    mockSession(activeSession());
    CouncilMember.exists.mockResolvedValue(null);

    await vote({ voter: "u-42" }).catch(() => {});
    expect(CouncilMember.exists).toHaveBeenCalledWith({
      user: "u-42",
      canVote: true,
      active: true,
    });
  });

  test("faol a'zo (canVote) → ovoz saqlanadi", async () => {
    mockSession(activeSession());
    CouncilMember.exists.mockResolvedValue({ _id: "m1" });

    await expect(vote()).resolves.toBeUndefined();
    expect(AnonymousVote).toHaveBeenCalledWith({
      session: "s1",
      voter: "u1",
      candidate: undefined,
      choice: "for",
    });
    expect(AnonymousVote.prototype.save).toHaveBeenCalledTimes(1);
  });

  test("sessiya faol bo'lmasa — a'zolik umuman tekshirilmaydi (tartib)", async () => {
    mockSession(activeSession({ status: "approved" }));

    await expect(vote()).rejects.toMatchObject({ code: "SESSION_NOT_ACTIVE" });
    expect(CouncilMember.exists).not.toHaveBeenCalled();
  });

  test("takroriy ovoz (unique {session, voter}) → ALREADY_VOTED", async () => {
    mockSession(activeSession());
    CouncilMember.exists.mockResolvedValue({ _id: "m1" });
    AnonymousVote.prototype.save.mockRejectedValueOnce({ code: 11000 });

    await expect(vote()).rejects.toMatchObject({ code: "ALREADY_VOTED" });
  });
});
