jest.mock("./votingSession.model");
jest.mock("#modules/4.09-instituteCouncil/anonymousVote/anonymousVote.model");
jest.mock("#modules/4.09-instituteCouncil/councilMember/councilMember.model");
jest.mock("#modules/4.09-instituteCouncil/docSetting/docSetting.service");

const VotingSession = require("./votingSession.model");
const service = require("./votingSession.service");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildReportFilter — hisobotlar bazaviy cheklovi (approved|rejected, active)", () => {
  test("filtrsiz — bazaviy cheklov ($in: [approved, rejected])", () => {
    const f = service.buildReportFilter();
    expect(f).toEqual({ status: { $in: ["approved", "rejected"] }, active: true });
  });

  test("status='approved' — bitta qiymatga toraytiriladi", () => {
    const f = service.buildReportFilter({ status: "approved" });
    expect(f.status).toBe("approved");
    expect(f.active).toBe(true);
  });

  test("status='rejected' — bitta qiymatga toraytiriladi", () => {
    const f = service.buildReportFilter({ status: "rejected" });
    expect(f.status).toBe("rejected");
  });

  test("ruxsat etilmagan status (masalan 'draft') — bazaviy $in saqlanadi", () => {
    const f = service.buildReportFilter({ status: "draft" });
    expect(f.status).toEqual({ $in: ["approved", "rejected"] });
  });

  test("rankType va department qo'shiladi", () => {
    const f = service.buildReportFilter({ rankType: "Dotsent", department: "dep1" });
    expect(f.rankType).toBe("Dotsent");
    expect(f.department).toBe("dep1");
  });
});

describe("paginateReport — D-073 backend paginatsiya, D-057 tiebreaker", () => {
  test("VotingSession.paginate to'g'ri sort (tiebreaker bilan) + normalizatsiya qilingan page/limit bilan chaqiriladi", async () => {
    VotingSession.paginate.mockResolvedValue({ docs: [], totalDocs: 0 });
    const filter = { status: "approved", active: true };
    await service.paginateReport(filter, { page: "2", limit: "10" });

    expect(VotingSession.paginate).toHaveBeenCalledWith(filter, {
      limit: 10,
      page: 2,
      select: "-updatedAt",
      populate: ["candidates.user", "department", "createdBy", "results.winner"],
      sort: { createdAt: -1, _id: -1 },
    });
  });

  test("page/limit berilmasa — default qiymatlarga normallashadi (D-058d)", async () => {
    VotingSession.paginate.mockResolvedValue({ docs: [], totalDocs: 0 });
    await service.paginateReport({}, {});

    const callArgs = VotingSession.paginate.mock.calls[0][1];
    expect(callArgs.page).toBeGreaterThan(0);
    expect(callArgs.limit).toBeGreaterThan(0);
    expect(callArgs.sort).toEqual({ createdAt: -1, _id: -1 });
  });
});
