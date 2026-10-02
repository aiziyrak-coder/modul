"use strict";

const { preserveRefIds, preserveRefIdsAll, preservePaginated } = require("./refIdPreserve");

const fakeDoc = (plain, populated = {}) => ({
  toObject: () => ({ ...plain }),
  populated: (path) => populated[path],
});

describe("preserveRefIds", () => {
  it("ma'lumotnoma o'chirilgan bo'lsa `_id` ni qaytarib qo'yadi", () => {
    const doc = fakeDoc(
      { fullName: "A", group: null, groupTitle: "2-guruh" },
      { group: "6a5a0acbd34b3c21a575d5c8" },
    );
    expect(preserveRefIds(doc)).toEqual({
      fullName: "A",
      group: "6a5a0acbd34b3c21a575d5c8",
      groupTitle: "2-guruh",
    });
  });

  it("ma'lumotnoma qayta nomlangan bo'lsa snapshot sarlavhani yangilaydi", () => {
    const doc = fakeDoc(
      { group: { _id: "x", title: "2-A guruh" }, groupTitle: "2-guruh" },
      { group: "x" },
    );
    expect(preserveRefIds(doc).groupTitle).toBe("2-A guruh");
  });

  it("`name` maydonli ma'lumotnomani ham tushunadi", () => {
    const doc = fakeDoc(
      { department: { _id: "d", name: "Nevrologiya" }, departmentTitle: "eski" },
      { department: "d" },
    );
    expect(preserveRefIds(doc).departmentTitle).toBe("Nevrologiya");
  });

  it("hech qachon bog'lanmagan maydonga TEGMAYDI", () => {
    const doc = fakeDoc({ group: null, groupTitle: null }, {});
    expect(preserveRefIds(doc)).toEqual({ group: null, groupTitle: null });
  });

  it("snapshot maydoni yo'q yo'llarda faqat `_id` saqlanadi", () => {
    const doc = fakeDoc({ supervisor: null }, { supervisor: "u1" });
    expect(preserveRefIds(doc)).toEqual({ supervisor: "u1" });
  });

  it("mongoose hujjati bo'lmagan qiymatni o'zgarishsiz qaytaradi", () => {
    expect(preserveRefIds(null)).toBeNull();
    expect(preserveRefIds({ a: 1 })).toEqual({ a: 1 });
  });

  it("ro'yxat va sahifalangan natijani ham qayta ishlaydi", () => {
    const doc = fakeDoc({ group: null }, { group: "g1" });
    expect(preserveRefIdsAll([doc])).toEqual([{ group: "g1" }]);
    expect(preservePaginated({ totalDocs: 1, docs: [doc] })).toEqual({
      totalDocs: 1,
      docs: [{ group: "g1" }],
    });
    expect(preservePaginated({ totalDocs: 0 })).toEqual({ totalDocs: 0 });
  });
});
