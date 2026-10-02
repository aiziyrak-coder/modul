process.env.FILE_URL_SECRET = process.env.FILE_URL_SECRET || "test-secret";

const signFileUrls = require("./signFileUrls");

function through(body) {
  let out;
  const res = { json: (b) => { out = b; return res; } };
  signFileUrls({}, res, () => {});
  res.json(body);
  return out;
}

const PDF = "http://localhost:4000/files/images/public/passport-1.pdf";
const IMG = "http://localhost:4000/files/images/public/photo.jpg";

describe("4.08 signFileUrls — abituriyent hujjatlari", () => {
  it("hujjat havolasiga imzo qo'yiladi", () => {
    const out = through({ fileUrl: PDF });
    expect(out.fileUrl).toMatch(/\?t=[^&]+&e=\d+$/);
    expect(out.fileUrl.startsWith(PDF)).toBe(true);
  });

  it("maxfiy yo'ldagi rasm ham IMZOLANADI (PII — pasport/surat)", () => {
    const out = through({ photo: IMG });
    expect(out.photo).toMatch(/\?t=[^&]+&e=\d+$/);
    expect(out.photo.startsWith(IMG)).toBe(true);
  });

  it("ODDIY rasm baribir OCHIQ qoladi — avatar/logo buzilmasin", () => {
    const avatar = "http://localhost:4000/files/images/tasks/17854076667660.jpg";
    expect(through({ photo: avatar }).photo).toBe(avatar);
  });

  it("chuqur joylashgan havolalar ham imzolanadi (massiv, ichki obyekt)", () => {
    const out = through({
      docs: [{ file: PDF }],
      slots: { passport: PDF, diploma: PDF },
    });
    expect(out.docs[0].file).toContain("?t=");
    expect(out.slots.passport).toContain("?t=");
    expect(out.slots.diploma).toContain("?t=");
  });

  it("eski imzo almashtiriladi (ikkilanmaydi)", () => {
    const out = through({ fileUrl: `${PDF}?t=eski&e=1` });
    expect(out.fileUrl.match(/t=/g)).toHaveLength(1);
    expect(out.fileUrl).not.toContain("t=eski");
  });

  it("fayl bo'lmagan javob TEGILMAYDI (aynan o'sha obyekt)", () => {
    const body = { title: "Kurs", count: 3 };
    expect(through(body)).toBe(body);
  });

  it("boshqa matnlar (nom, izoh) o'zgarmaydi", () => {
    const out = through({ title: "Hujjat /files/ emas", fileUrl: PDF });
    expect(out.title).toBe("Hujjat /files/ emas");
  });

  it("null/массiv/bo'sh javobda yiqilmaydi", () => {
    expect(through(null)).toBeNull();
    expect(through([])).toEqual([]);
    expect(through({ fileUrl: null }).fileUrl).toBeNull();
  });
});
