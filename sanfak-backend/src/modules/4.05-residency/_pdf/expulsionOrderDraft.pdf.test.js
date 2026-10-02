"use strict";

const PDFDocument = require("pdfkit");
const R = require("./expulsionOrderDraft.pdf");

const ORDER_ID = "64b0000000000000000000a1";
const pageCount = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

function input(n, extra = {}) {
  const rows = Array.from({ length: n }, (_, i) => ({
    day: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
    science: i % 2 ? "Klinik farmakologiya" : "Ichki kasalliklar propedevtikasi",
    lessonType: "amaliy",
    hours: i % 5 === 0 ? 4 : 2,
  }));
  return {
    orderId: ORDER_ID,
    resident: { fullName: "Aliyev Sardor Botir o‘g‘li", program: "ordinatura", specialty: "Terapiya", department: "Ichki kasalliklar", course: 1, group: "ORD-101" },
    countingYear: "2026/2027",
    draftedAt: new Date("2026-10-14T03:10:00Z"),
    hoursAtDraft: 72,
    rows,
    total: rows.reduce((s, r) => s + r.hours, 0),
    generatedAt: new Date("2026-10-20T06:00:00Z"),
    ...extra,
  };
}

async function render(data) {
  const texts = [];
  const shapes = [];
  const pages = [];
  const pageNo = (page) => (pages.includes(page) ? pages.indexOf(page) : pages.push(page) - 1);
  const originals = { text: PDFDocument.prototype.text, rect: PDFDocument.prototype.rect, moveTo: PDFDocument.prototype.moveTo };
  PDFDocument.prototype.text = function patched(t, ...rest) {
    const out = originals.text.call(this, t, ...rest);
    texts.push(Object.assign(String(t), { page: pageNo(this.page), yAfter: this.y }));
    return out;
  };
  PDFDocument.prototype.rect = function patched(x, y, w, h) {
    shapes.push({ kind: "rect", page: pageNo(this.page), bottom: y + h });
    return originals.rect.call(this, x, y, w, h);
  };
  PDFDocument.prototype.moveTo = function patched(x, y) {
    shapes.push({ kind: "line", page: pageNo(this.page), y });
    return originals.moveTo.call(this, x, y);
  };
  try {
    return { buf: await R.buildExpulsionDraftPdf(data), texts: texts.map(String), placed: texts, shapes };
  } finally {
    Object.assign(PDFDocument.prototype, originals);
  }
}

const isFooter = (t) => t.startsWith("Chetlatish buyrug'i loyihasi |") || /^\d+ \/ \d+$/.test(t);

function expectClearFooter({ placed, shapes }, pages) {
  const rule = R.LAYOUT.FOOTER_Y - 6;
  const below = placed.filter((x) => !isFooter(String(x)) && x.yAfter > rule).map((x) => `${String(x).slice(0, 30)} @${x.yAfter}`);
  expect(below).toEqual([]);
  expect(shapes.filter((x) => x.kind === "rect" && x.bottom > rule).map((x) => x.bottom)).toEqual([]);
  const rules = shapes.filter((x) => x.kind === "line" && x.y === rule);
  expect(new Set(rules.map((x) => x.page)).size).toBe(pages);
}

describe("sahifalar, sarlavha takrori va footer", () => {
  test.each([
    [3, 2],
    [40, 3],
    [150, 5],
  ])("%i qator → %i sahifa; «Sana» har Ilova sahifasida bir marta; «i / N» har sahifada", async (n, pages) => {
    const { buf, texts } = await render(input(n));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(10 * 1024);
    expect(pageCount(buf)).toBe(pages);
    expect(texts.filter((t) => t === "Sana")).toHaveLength(pages - 1);
    const labels = texts.filter((t) => /^\d+ \/ \d+$/.test(t));
    expect(labels).toEqual(Array.from({ length: pages }, (_, i) => `${i + 1} / ${pages}`));
    const footers = texts.filter((t) => t.startsWith("Chetlatish buyrug'i loyihasi |"));
    expect(footers).toEqual(Array(pages).fill(`Chetlatish buyrug'i loyihasi | Holat: Loyiha | Kod: ${ORDER_ID}`));
  });

  test.each([[3, 2], [37, 3], [40, 3], [150, 5]])("%i qator — kontent footer'ga chiqmaydi", async (n, pages) => {
    expectClearFooter(await render(input(n)), pages);
  });


  test("AIS banneri yo'q, institut nomi va sarlavha bor", async () => {
    const { texts } = await render(input(3));
    expect(texts).toContain("FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI");
    expect(texts).toContain("CHETLATISH BUYRUG'I LOYIHASI");
    expect(texts).toContain("Ma'lumot holati: 20.10.2026");
    expect(texts.some((t) => t.includes("(AIS)"))).toBe(false);
  });
});

describe("sahifa chegarasi — juda uzun matn", () => {
  test("bo'sh sahifaga ham sig'maydigan katak — o'sha katak cheklanadi, sahifa buzilmaydi", async () => {
    const data = input(3);
    data.rows[1] = { ...data.rows[1], science: "Klinik farmakologiya ".repeat(250) };
    const rendered = await render(data);
    const pages = pageCount(rendered.buf);
    expectClearFooter(rendered, pages);
    expect(rendered.texts.filter((t) => t === "Sana")).toHaveLength(pages - 1);
  });

  test("imzo bloki sahifa oxiriga to'g'ri kelsa — keyingi sahifaga to'liq ko'chadi", async () => {
    const data = input(3);
    data.resident = { ...data.resident, department: "Ichki kasalliklar kafedrasi ".repeat(120) };
    const rendered = await render(data);
    expectClearFooter(rendered, pageCount(rendered.buf));
    const signature = rendered.placed.filter((t) => ["____________________", "(lavozim)", "(imzo)", "(F.I.Sh.)"].includes(String(t)));
    expect(signature).toHaveLength(6);
    expect(new Set(signature.map((t) => t.page))).toEqual(new Set([1]));
  });

  test("juda uzun maydon — yorliq va qiymat bir sahifada, footer'ga chiqmaydi", async () => {
    const data = input(3);
    data.resident = { ...data.resident, department: "Ichki kasalliklar kafedrasi ".repeat(300) };
    const rendered = await render(data);
    expectClearFooter(rendered, pageCount(rendered.buf));
    const label = rendered.placed.find((t) => String(t) === "Kafedra:");
    const value = rendered.placed.find((t) => String(t).startsWith("Ichki kasalliklar kafedrasi Ichki"));
    expect(label.page).toBe(value.page);
  });
});

describe("mazmun", () => {
  test("buyruq jumlasi (W-1=A) va shablon versiyasi", async () => {
    const data = input(3);
    expect(R.operativeSentence(data)).toBe(
      "Aliyev Sardor Botir o‘g‘li 2026/2027 o'quv yilida jami 8 soat mashg'ulotni sababsiz qoldirgani uchun rezidenturadan chetlatilsin.",
    );
    expect(R.TEMPLATE_VERSION).toBe(1);
    const { texts } = await render(data);
    expect(texts).toContain(R.operativeSentence(data));
  });

  test("«Jami» qatori — jadval yig'indisi; qatorlar raqamlangan", () => {
    const rows = R.tableRows(input(5));
    const body = rows.slice(0, -1);
    expect(body.map((r) => r.no)).toEqual(["1", "2", "3", "4", "5"]);
    expect(rows.at(-1)).toMatchObject({ science: "Jami", hours: String(body.reduce((s, r) => s + Number(r.hours), 0)), isTotal: true });
  });

  test("noma'lum dars turi O'ZI chiqadi, bo'sh fan — «—»", () => {
    const [row] = R.tableRows(input(0, { rows: [{ day: "2026-09-02", science: null, lessonType: "seminar_x", hours: 2 }], total: 2 }));
    expect(row).toMatchObject({ day: "02.09.2026", science: "—", lessonType: "seminar_x", hours: "2" });
  });

  test("kurs «N-kurs»; kasr soat suzuvchi nuqta qoldig'isiz (faqat ko'rinish)", () => {
    expect(R.residentLines(input(1))[4]).toEqual(["Kurs", "1-kurs"]);
    const total = Array.from({ length: 60 }, () => 1.2).reduce((a, b) => a + b, 0);
    expect(total).not.toBe(72);
    const data = input(0, { rows: [{ day: "2026-09-02", science: "X", lessonType: "amaliy", hours: 1.25 }], total, hoursAtDraft: total });
    expect(R.operativeSentence(data)).toContain("jami 72 soat");
    expect(R.basisLines(data)[1]).toEqual(["Sababsiz qoldirilgan soat (ma'lumot holatiga)", "72 soat"]);
    expect(R.basisLines(data)[2][1]).toMatch(/· 72 soat$/);
    expect(R.tableRows(data).map((r) => r.hours)).toEqual(["1.25", "72"]);
  });

  test("rezident va asos qatorlari: bo'sh qiymat «—», loyiha soati noma'lum — faqat sana", () => {
    const data = input(3, { resident: { fullName: "X", program: "magistratura" }, hoursAtDraft: null });
    expect(R.residentLines(data)).toEqual([
      ["F.I.Sh.", "X"], ["Ta'lim dasturi", "Magistratura"], ["Mutaxassislik", "—"],
      ["Kafedra", "—"], ["Kurs", "—"], ["Guruh", "—"],
    ]);
    expect(R.basisLines(data)).toEqual([
      ["O'quv yili", "2026/2027"],
      ["Sababsiz qoldirilgan soat (ma'lumot holatiga)", "8 soat"],
      ["Loyiha shakllantirilgan", "14.10.2026"],
      ["Chegara (TZ 4.5.4)", "72 soat"],
    ]);
    expect(R.basisLines(input(3))[2]).toEqual(["Loyiha shakllantirilgan", "14.10.2026 · 72 soat"]);
  });

  test("fayl nomi ASCII, F.I.Sh siz, buyruq kodi va UZ kuni bilan", () => {
    expect(R.draftFileName(ORDER_ID, new Date("2026-10-20T20:30:00Z"))).toBe("chetlatish-buyrugi-loyihasi-0000a1-21.10.2026.pdf");
  });
});

describe("determinizm, shrift va shaxsiy ma'lumot", () => {
  test("bir xil kirish — bir xil bayt; boshqa `generatedAt` — boshqa bayt", async () => {
    const a = await R.buildExpulsionDraftPdf(input(10));
    const b = await R.buildExpulsionDraftPdf(input(10));
    const c = await R.buildExpulsionDraftPdf(input(10, { generatedAt: new Date("2026-10-21T06:00:00Z") }));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  test("Times New Roman JOYLANGAN (standart Helvetica'ga tushib qolmagan)", async () => {
    expect((await R.buildExpulsionDraftPdf(input(3))).toString("latin1")).toMatch(/TimesNewRoman/);
  });

  test("kirishdagi JSHSHIR, pasport, telefon qog'ozga TUSHMAYDI", async () => {
    const data = input(3);
    data.resident = { ...data.resident, jshshir: "31234567890123", passportNumber: "AA1234567", phone: "+998901234567" };
    const { texts } = await render(data);
    expect(texts.join("\n")).not.toMatch(/31234567890123|AA1234567|998901234567/);
  });

  test("shrift ochilmasa — promise RAD etiladi (buzuq qog'oz chiqmaydi)", async () => {
    const original = PDFDocument.prototype.font;
    const spy = jest.spyOn(PDFDocument.prototype, "font").mockImplementation(function failBold(name, ...rest) {
      if (name === "Helvetica-Bold") throw Object.assign(new Error("ENOENT: timesbd.ttf"), { code: "ENOENT" });
      return original.call(this, name, ...rest);
    });
    await expect(R.buildExpulsionDraftPdf(input(3))).rejects.toThrow("ENOENT");
    spy.mockRestore();
  });
});
