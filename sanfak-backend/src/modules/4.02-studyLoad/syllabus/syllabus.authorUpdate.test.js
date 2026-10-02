jest.mock("./syllabus.model");

const Syllabus = require("./syllabus.model");
const Controller = require("./syllabus.controller");
const { authorSetFields } = require("./syllabus.author");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const OWNER_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const OTHER_ID = "ffffffffffffffffffffffff";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const runUpdate = async (body) => {
  Syllabus.findOne = jest.fn().mockResolvedValue({
    _id: DOC_ID,
    status: "draft",
    author: { teacher: OWNER_ID },
  });
  Syllabus.findByIdAndUpdate = jest.fn().mockResolvedValue({});
  const res = createRes();
  const next = jest.fn();
  await Controller.updateSyllabus(
    {
      params: { id: DOC_ID },
      body,
      scope: {},
      user: { _id: OWNER_ID, role: { title: ROLES.OQITUVCHI } },
    },
    res,
    next,
  );
  const call = Syllabus.findByIdAndUpdate.mock.calls[0];
  return { res, next, set: call?.[1]?.$set };
};

describe("syllabus PUT — author egaligi (D-33)", () => {
  it("reviewer tahriri subhujjatni almashtirmaydi — faqat nuqtali yo'l", async () => {
    const { res, next, set } = await runUpdate({
      desc: "yangi",
      author: { reviewer: { desc: "Taqrizchi: prof. A" } },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(set).toEqual({
      desc: "yangi",
      "author.reviewer.desc": "Taqrizchi: prof. A",
    });
    expect(set).not.toHaveProperty("author");
    expect(set).not.toHaveProperty("author.teacher");
  });

  it("body'dagi author.teacher e'tiborsiz qoldiriladi (egalik o'tkazilmaydi)", async () => {
    const { set } = await runUpdate({
      author: { teacher: OTHER_ID, email: "a@b.uz" },
    });

    expect(set).toEqual({ "author.email": "a@b.uz" });
    expect(Object.keys(set).some((k) => k.startsWith("author.teacher"))).toBe(
      false,
    );
  });

  it("author yuborilmasa — author.* ga tegilmaydi", async () => {
    const { set } = await runUpdate({ desc: "faqat izoh" });

    expect(set).toEqual({ desc: "faqat izoh" });
  });

  it("reviewer: null — desc null, egalik maydoni yo'q", async () => {
    const { set } = await runUpdate({ author: { reviewer: null } });

    expect(set).toEqual({ "author.reviewer.desc": null });
  });
});

describe("authorSetFields", () => {
  it("bo'sh/noto'g'ri kirish — bo'sh obyekt", () => {
    expect(authorSetFields(undefined)).toEqual({});
    expect(authorSetFields(null)).toEqual({});
    expect(authorSetFields("x")).toEqual({});
  });

  it("bo'sh satrlar null ga aylanadi (model default bilan bir xil)", () => {
    expect(
      authorSetFields({ email: "", organization: "", reviewer: { desc: "" } }),
    ).toEqual({
      "author.email": null,
      "author.organization": null,
      "author.reviewer.desc": null,
    });
  });
});
