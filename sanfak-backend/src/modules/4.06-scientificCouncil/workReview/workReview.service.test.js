jest.mock("./workReview.model");
jest.mock("#modules/4.06-scientificCouncil/scientificWork/scientificWork.model");

const WorkReview = require("./workReview.model");
const ScientificWork = require("#modules/4.06-scientificCouncil/scientificWork/scientificWork.model");
const service = require("./workReview.service");

const WORK_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const MEMBER_ID = "cccccccccccccccccccccccc";

describe("workReview.service — findByWork (D-026)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    WorkReview.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
  });

  test("ownMemberId berilmasa (global scope) — filtr faqat `work` bo'yicha", async () => {
    await service.findByWork(WORK_ID);

    expect(WorkReview.find).toHaveBeenCalledWith(
      { work: WORK_ID },
      expect.anything(),
    );
  });

  test("ownMemberId berilsa (self scope a'zo) — filtr `work` VA `member`ga cheklanadi", async () => {
    await service.findByWork(WORK_ID, MEMBER_ID);

    expect(WorkReview.find).toHaveBeenCalledWith(
      { work: WORK_ID, member: MEMBER_ID },
      expect.anything(),
    );
  });
});

describe("workReview.service — create (D-027b, dublikat cheklovi)", () => {
  const DOC_KEY = "titul";
  const body = { work: WORK_ID, member: MEMBER_ID, docKey: DOC_KEY, type: "positive" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("dublikat yo'q — yaratiladi", async () => {
    WorkReview.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    const savedDoc = { _id: "saved1" };
    WorkReview.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(savedDoc) }));

    const result = await service.create(body);

    expect(WorkReview.findOne).toHaveBeenCalledWith({
      work: WORK_ID,
      member: MEMBER_ID,
      docKey: DOC_KEY,
    });
    expect(result).toBe(savedDoc);
  });

  test("dublikat mavjud — 409 ErrorHandler throw qiladi, save() CHAQIRILMAYDI (asosiy fix)", async () => {
    WorkReview.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: "existing1" }),
    });
    const saveSpy = jest.fn();
    WorkReview.mockImplementation(() => ({ save: saveSpy }));

    await expect(service.create(body)).rejects.toMatchObject({ statusCode: 409 });
    expect(saveSpy).not.toHaveBeenCalled();
  });
});


describe("workReview.service — assertAssigned (biriktirilganlik chegarasi)", () => {
  const mockWork = (docAssignments) => {
    ScientificWork.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(docAssignments === null ? null : { docAssignments }),
      }),
    });
  };

  test("biriktirilgan a'zo — o'tadi", async () => {
    mockWork({ dissertation: [MEMBER_ID] });
    await expect(
      service.assertAssigned(WORK_ID, "dissertation", MEMBER_ID),
    ).resolves.toBeUndefined();
  });

  test("boshqa hujjatga biriktirilgan — 403", async () => {
    mockWork({ abstract: [MEMBER_ID] });
    await expect(
      service.assertAssigned(WORK_ID, "dissertation", MEMBER_ID),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("hujjatga umuman hech kim biriktirilmagan — 403", async () => {
    mockWork({});
    await expect(
      service.assertAssigned(WORK_ID, "dissertation", MEMBER_ID),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("boshqa a'zo biriktirilgan — 403", async () => {
    mockWork({ dissertation: ["dddddddddddddddddddddddd"] });
    await expect(
      service.assertAssigned(WORK_ID, "dissertation", MEMBER_ID),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("ObjectId va satr aralash bo'lsa ham solishtiradi", async () => {
    mockWork({ dissertation: [{ toString: () => MEMBER_ID }] });
    await expect(
      service.assertAssigned(WORK_ID, "dissertation", MEMBER_ID),
    ).resolves.toBeUndefined();
  });

  test("ilmiy ish topilmasa — 404", async () => {
    mockWork(null);
    await expect(
      service.assertAssigned(WORK_ID, "dissertation", MEMBER_ID),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
