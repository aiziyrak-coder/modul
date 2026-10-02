jest.mock("#modules/4.05-residency/attendance/attendance.model");
jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#modules/4.05-residency/residentApplication/residentApplication.model");
jest.mock("#modules/4.05-residency/_services/expulsionOrderLifecycle", () => ({
  cancelDraftBelowThreshold: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.05-residency/_services/expulsionOfficeNotices", () => ({
  basisLostEffects: jest.fn().mockResolvedValue([]),
  deliverDecisionInBackground: jest.fn(),
}));
jest.mock("#modules/4.05-residency/_services/expulsionCheck", () => ({
  countUnexcusedHours: jest.fn(),
}));

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const {
  basisLostEffects,
  deliverDecisionInBackground,
} = require("#modules/4.05-residency/_services/expulsionOfficeNotices");
const { countUnexcusedHours } = require("#modules/4.05-residency/_services/expulsionCheck");
const { _recountUnexcused } = require("./residentApplication.controller");

const arm = (hours, resident) => {
  Attendance.find = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([{ hours }]) });
  Resident.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(resident) });
};

beforeEach(() => {
  jest.clearAllMocks();
  Resident.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
});

test("chetlatilgan + soat 72 dan past — da'vo (jonli hisob bilan), xabar fonda", async () => {
  arm(20, { _id: "r1", status: "chetlatilgan", user: "u1" });
  const order = { _id: "o1" };
  basisLostEffects.mockResolvedValueOnce([{ kind: "basisLostNotice", order }]);
  await _recountUnexcused("r1");
  expect(basisLostEffects).toHaveBeenCalledWith({
    residentId: "r1",
    source: "application",
    countHours: countUnexcusedHours,
  });
  expect(deliverDecisionInBackground).toHaveBeenCalledWith(order, "basisLost");
  expect(Resident.findByIdAndUpdate).toHaveBeenCalledWith("r1", { totalUnexcusedHours: 20 });
});

test("da'vo yutqazildi (allaqachon xabar berilgan) — xabar YO'Q", async () => {
  arm(20, { _id: "r1", status: "chetlatilgan" });
  await _recountUnexcused("r1");
  expect(deliverDecisionInBackground).not.toHaveBeenCalled();
});

test.each([
  ["o'qishda", { _id: "r1", status: "oquvda" }, 20],
  ["chetlatilgan, soat hamon 72+", { _id: "r1", status: "chetlatilgan" }, 80],
])("%s — da'vo qilinmaydi", async (_label, resident, hours) => {
  arm(hours, resident);
  await _recountUnexcused("r1");
  expect(basisLostEffects).not.toHaveBeenCalled();
});
