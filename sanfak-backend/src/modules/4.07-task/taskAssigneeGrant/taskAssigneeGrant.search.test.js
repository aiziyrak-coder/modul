const { userSearchFilter } = require("./taskAssigneeGrant.service");

describe("userSearchFilter", () => {
  test("uchala ism maydoni bo'yicha qism-satr izlaydi", () => {
    const rx = { $regex: "bekzod", $options: "i" };
    expect(userSearchFilter("bekzod")).toEqual({
      $or: [{ firstName: rx }, { lastName: rx }, { middleName: rx }],
    });
  });

  test("bosh/oxirgi bo'shliq olib tashlanadi", () => {
    expect(userSearchFilter(" bekzod ").$or[0].firstName.$regex).toBe("bekzod");
  });

  test("faqat bo'shliqdan iborat so'rov FILTR QO'YMAYDI", () => {
    expect(userSearchFilter("   ")).toEqual({});
    expect(userSearchFilter("")).toEqual({});
    expect(userSearchFilter(undefined)).toEqual({});
  });

  test("metakarakterlar qochiriladi", () => {
    const rx = userSearchFilter("a+b (c)").$or[0].firstName.$regex;
    expect(rx).not.toBe("a+b (c)");
    expect(() => new RegExp(rx)).not.toThrow();
    expect(new RegExp(rx, "i").test("xa+b (c)yz")).toBe(true);
  });
});
