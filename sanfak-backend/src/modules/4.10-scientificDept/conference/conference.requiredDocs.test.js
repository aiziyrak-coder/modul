const {
  createConferenceSchema,
} = require("./conference.validation");
const { zipFileSlots, assertAllSlots } = require("../_shared/fileSlots");

const base = {
  title: "Konferensiya",
  type: "national",
  deadline: "2026-12-31",
  kafedras: ["6a5dcce53d2f8bdb0b832441"],
};

describe("conference — requiredDocs validatsiyasi", () => {
  it("matn + fayl turi o'tadi", () => {
    const { error } = createConferenceSchema.validate({
      ...base,
      requiredDocs: [
        { label: "Tezis matni", fileType: "pdf" },
        { label: "Ishtirok arizasi", fileType: "word" },
        { label: "Xarajatlar jadvali", fileType: "excel" },
        { label: "Sertifikat surati", fileType: "image" },
      ],
    });
    expect(error).toBeUndefined();
  });

  it("noma'lum fayl turi RAD etiladi", () => {
    const { error } = createConferenceSchema.validate({
      ...base,
      requiredDocs: [{ label: "X", fileType: "mp3" }],
    });
    expect(error).toBeDefined();
  });

  it("bo'sh matn RAD etiladi", () => {
    const { error } = createConferenceSchema.validate({
      ...base,
      requiredDocs: [{ label: "", fileType: "pdf" }],
    });
    expect(error).toBeDefined();
  });

  it("ro'yxatsiz ham o'tadi (ixtiyoriy maydon)", () => {
    expect(createConferenceSchema.validate(base).error).toBeUndefined();
  });
});

describe("conference — dinamik fayl slotlari (doc0..docN)", () => {
  const slots = ["doc0", "doc1", "doc2"];

  it("fayllarni tartib bo'yicha slotlarga bog'laydi", () => {
    const body = {
      fileSlots: JSON.stringify(slots),
      media: [{ image: "/files/a.pdf" }, { image: "/files/b.docx" }, { image: "/files/c.xlsx" }],
    };
    expect(zipFileSlots(body, slots)).toEqual({
      doc0: "/files/a.pdf",
      doc1: "/files/b.docx",
      doc2: "/files/c.xlsx",
    });
  });

  it("hammasi majburiy — bittasi yetishmasa xato", () => {
    const files = { doc0: "/files/a.pdf", doc2: "/files/c.xlsx" };
    expect(() => assertAllSlots(files, slots, "Konferensiya hujjatlari")).toThrow();
  });

  it("ro'yxatda yo'q slot yuborilsa RAD etiladi", () => {
    const body = {
      fileSlots: JSON.stringify(["doc0", "doc9"]),
      media: [{ image: "/files/a.pdf" }, { image: "/files/x.pdf" }],
    };
    expect(() => zipFileSlots(body, slots)).toThrow();
  });

  it("fayl soni slot soniga mos kelmasa RAD etiladi", () => {
    const body = {
      fileSlots: JSON.stringify(slots),
      media: [{ image: "/files/a.pdf" }],
    };
    expect(() => zipFileSlots(body, slots)).toThrow();
  });
});
