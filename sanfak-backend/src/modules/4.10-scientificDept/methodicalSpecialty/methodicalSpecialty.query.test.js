const { buildQuery } = require("./methodicalSpecialty.service");

describe("methodicalSpecialty.buildQuery — soft-delete ro'yxatdan yashirinsin", () => {
  it("active berilmasa — faqat FAOL yozuvlar (default active:true)", () => {
    expect(buildQuery()).toEqual({ active: true });
    expect(buildQuery({})).toEqual({ active: true });
    expect(buildQuery({ search: "" })).toEqual({ active: true });
  });

  it("active:true — faol", () => {
    expect(buildQuery({ active: true })).toEqual({ active: true });
  });

  it("active:false — ataylab inactive (masalan tiklash ekrani)", () => {
    expect(buildQuery({ active: false })).toEqual({ active: false });
  });

  it("qidiruv active bilan birga ishlaydi", () => {
    const q = buildQuery({ search: "terap" });
    expect(q.active).toBe(true);
    expect(Array.isArray(q.$or)).toBe(true);
    expect(q.$or).toHaveLength(2);
  });
});
