"use strict";

const mongoose = require("mongoose");
const { toAdvisorRef, pickAdvisorId } = require("./advisorRefPlugin");

const HEX = "6a47a5343c087184996522a9";

describe("toAdvisorRef", () => {
  it("haqiqiy hex -> ObjectId", () => {
    const ref = toAdvisorRef(HEX);
    expect(ref).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(ref)).toBe(HEX);
  });

  it("ObjectId ning o'zi ham qabul qilinadi", () => {
    expect(String(toAdvisorRef(new mongoose.Types.ObjectId(HEX)))).toBe(HEX);
  });

  it("bo'shliqlar tozalanadi", () => {
    expect(String(toAdvisorRef(`  ${HEX}  `))).toBe(HEX);
  });

  it.each(["PROF-001", "", "   ", null, undefined, "12345", "not-an-id-at-all!!"])(
    "ObjectId bo'lmagan %p -> null (TAXMIN QILINMAYDI)",
    (v) => {
      expect(toAdvisorRef(v)).toBeNull();
    },
  );

  it("12 belgili oddiy satr QABUL QILINMAYDI", () => {
    expect(toAdvisorRef("abcdefghijkl")).toBeNull();
  });
});

describe("pickAdvisorId", () => {
  it("`$set` ichidan oladi", () => {
    expect(pickAdvisorId({ $set: { advisorId: HEX } })).toBe(HEX);
  });

  it("tekis update'dan oladi", () => {
    expect(pickAdvisorId({ advisorId: HEX })).toBe(HEX);
  });

  it("update `advisorId` ga tegmasa -> undefined", () => {
    expect(pickAdvisorId({ $set: { fullName: "X" } })).toBeUndefined();
    expect(pickAdvisorId({})).toBeUndefined();
    expect(pickAdvisorId(null)).toBeUndefined();
  });

  it("ANIQ `null` uzatilsa — u qaytadi (bekor qilish)", () => {
    expect(pickAdvisorId({ $set: { advisorId: null } })).toBeNull();
  });
});

describe("plagin sxemaga ulanishi", () => {
  const advisorRefPlugin = require("./advisorRefPlugin");

  it("save va uchala update hook'ini ro'yxatdan o'tkazadi", () => {
    const calls = [];
    const schema = { pre: (name, fn) => calls.push({ name, fn }) };

    advisorRefPlugin(schema);

    expect(calls[0].name).toBe("save");
    expect(calls[1].name).toEqual(["updateOne", "findOneAndUpdate", "updateMany"]);
  });

  it("save: `advisorId` o'zgarmagan bo'lsa `advisor` ga TEGILMAYDI", () => {
    const calls = [];
    advisorRefPlugin({ pre: (name, fn) => calls.push({ name, fn }) });
    const saveHook = calls[0].fn;

    const doc = { advisorId: HEX, advisor: "qo'lda-qo'yilgan", isModified: () => false };
    saveHook.call(doc, () => {});

    expect(doc.advisor).toBe("qo'lda-qo'yilgan");
  });

  it("save: o'zgargan bo'lsa ref yoziladi", () => {
    const calls = [];
    advisorRefPlugin({ pre: (name, fn) => calls.push({ name, fn }) });
    const saveHook = calls[0].fn;

    const doc = { advisorId: HEX, advisor: null, isModified: () => true };
    saveHook.call(doc, () => {});

    expect(String(doc.advisor)).toBe(HEX);
  });

  it("update: `$set` ga ref qo'shiladi", () => {
    const calls = [];
    advisorRefPlugin({ pre: (name, fn) => calls.push({ name, fn }) });
    const updateHook = calls[1].fn;

    const update = { $set: { advisorId: HEX } };
    updateHook.call({ getUpdate: () => update, setUpdate: () => {} }, () => {});

    expect(String(update.$set.advisor)).toBe(HEX);
  });

  it("update: `advisorId` yo'q bo'lsa update TEGILMAYDI", () => {
    const calls = [];
    advisorRefPlugin({ pre: (name, fn) => calls.push({ name, fn }) });
    const updateHook = calls[1].fn;

    const update = { $set: { fullName: "X" } };
    let replaced = false;
    updateHook.call({ getUpdate: () => update, setUpdate: () => { replaced = true; } }, () => {});

    expect(update.$set).not.toHaveProperty("advisor");
    expect(replaced).toBe(false);
  });
});
