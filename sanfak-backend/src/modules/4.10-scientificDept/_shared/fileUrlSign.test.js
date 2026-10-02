process.env.FILE_URL_SECRET = process.env.FILE_URL_SECRET || "test-secret";
const mongoose = require("mongoose");
const { resignDeep, resignDocFiles, fileResigner } = require("./fileUrlSign");
const { verifySignature } = require("#shared/fileAccess");

const URL_A = "http://x/files/images/methodical/a.docx";
const URL_B = "http://x/files/images/methodical/b.pdf";

const isValid = (u) => {
  const q = new URL(u);
  return verifySignature(
    q.pathname.replace("/files/", ""),
    q.searchParams.get("t"),
    q.searchParams.get("e"),
  ).valid;
};

describe("fileUrlSign", () => {
  it("yalang'och havola imzolanadi va guard qabul qiladi", () => {
    expect(isValid(resignDeep(URL_A))).toBe(true);
  });

  it("slot obyekti (files{}) chuqur imzolanadi", () => {
    const out = resignDeep({ titul: URL_A, internal: URL_B, bosh: "" });
    expect(isValid(out.titul)).toBe(true);
    expect(isValid(out.internal)).toBe(true);
    expect(out.bosh).toBe("");
  });

  it("massiv ichidagi hujjatlar ham (docs[]/kafedras[])", () => {
    const out = resignDeep([{ label: "Tezis", fileUrl: URL_A }]);
    expect(out[0].label).toBe("Tezis");
    expect(isValid(out[0].fileUrl)).toBe(true);
  });

  it("eski imzo almashtiriladi, ikkilanmaydi", () => {
    const once = resignDeep(URL_A);
    const twice = resignDeep(once);
    expect(twice.match(/[?&]t=/g)).toHaveLength(1);
    expect(isValid(twice)).toBe(true);
  });

  it("fayl bo'lmagan matn va maxsus tiplar tegilmaydi", () => {
    const id = new mongoose.Types.ObjectId();
    const date = new Date("2026-08-19");
    const out = resignDeep({ title: "Uslubiy tavsiyanoma", link: "https://scholar.google.com/x", author: id, at: date });
    expect(out.title).toBe("Uslubiy tavsiyanoma");
    expect(out.link).toBe("https://scholar.google.com/x");
    expect(out.author).toBe(id);
    expect(out.at).toBe(date);
  });

  it("resignDocFiles hujjatni MUTATSIYA qilmaydi (nusxa qaytaradi)", () => {
    const doc = { files: { titul: URL_A } };
    const out = resignDocFiles(doc, ["files"]);
    expect(doc.files.titul).toBe(URL_A);
    expect(out).not.toBe(doc);
    expect(isValid(out.files.titul)).toBe(true);
  });

  it("fileResigner massivni ham, bitta hujjatni ham qabul qiladi", () => {
    const withFiles = fileResigner(["fileUrl"]);
    const arr = withFiles([{ fileUrl: URL_A }, { fileUrl: URL_B }]);
    expect(arr.every((d) => isValid(d.fileUrl))).toBe(true);
    expect(isValid(withFiles({ fileUrl: URL_A }).fileUrl)).toBe(true);
  });
});
