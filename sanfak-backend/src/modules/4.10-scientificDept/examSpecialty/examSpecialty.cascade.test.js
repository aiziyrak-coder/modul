const { cascadeCodeChange } = require("./examSpecialty.service");

const fakeModel = (modifiedCount = 0) => {
  const calls = [];
  return {
    calls,
    updateMany: async (filter, update) => {
      calls.push({ filter, update });
      return { modifiedCount };
    },
  };
};

describe("examSpecialty — shifr kaskadi", () => {
  it("shifr o'zgarsa arizalar va e'lonlar ko'chiriladi", async () => {
    const Applicant = fakeModel(2);
    const Post = fakeModel(1);

    const res = await cascadeCodeChange("3210100", "14.00.02", { Applicant, Post });

    expect(res).toEqual({ applicants: 2, posts: 1 });
    expect(Applicant.calls[0].filter).toEqual({ specialization: "3210100" });
    expect(Applicant.calls[0].update).toEqual({ $set: { specialization: "14.00.02" } });
    expect(Post.calls[0].filter).toEqual({ specialtyCode: "3210100" });
    expect(Post.calls[0].update).toEqual({ $set: { specialtyCode: "14.00.02" } });
  });

  it("shifr o'zgarmagan bo'lsa bazaga tegilmaydi", async () => {
    const Applicant = fakeModel(5);
    const Post = fakeModel(5);

    const res = await cascadeCodeChange("14.00.02", "14.00.02", { Applicant, Post });

    expect(res).toEqual({ applicants: 0, posts: 0 });
    expect(Applicant.calls).toHaveLength(0);
    expect(Post.calls).toHaveLength(0);
  });

  it("bo'sh shifrda ham hech narsa yozilmaydi", async () => {
    const Applicant = fakeModel(3);
    const Post = fakeModel(3);

    expect(await cascadeCodeChange("", "14.00.02", { Applicant, Post })).toEqual({
      applicants: 0,
      posts: 0,
    });
    expect(await cascadeCodeChange("3210100", "", { Applicant, Post })).toEqual({
      applicants: 0,
      posts: 0,
    });
    expect(Applicant.calls).toHaveLength(0);
    expect(Post.calls).toHaveLength(0);
  });

  it("modifiedCount qaytmasa 0 deb hisoblanadi", async () => {
    const noCount = { updateMany: async () => ({}) };
    const res = await cascadeCodeChange("a", "b", { Applicant: noCount, Post: noCount });
    expect(res).toEqual({ applicants: 0, posts: 0 });
  });
});
