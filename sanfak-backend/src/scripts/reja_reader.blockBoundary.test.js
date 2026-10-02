const path = require("path");
const fs = require("fs");
const os = require("os");

require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { spawnSync } = require("child_process");

const ExcelJS = require("exceljs");
const { parseReja } = require("#shared/pythonParser");

const PYTHON = process.env.PYTHON_PATH || "python3";
const pythonReady =
  spawnSync(PYTHON, ["-c", "import openpyxl"], { stdio: "ignore" }).status === 0;
const describeIfPython = pythonReady ? describe : describe.skip;

jest.setTimeout(30000);

async function buildFixture({ practiceCode = null } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Oquv rejasi");
  ws.getCell("A1").value = "O'QUV REJASI";
  ws.getCell("A2").value = "Ta'lim yo'nalishi: 60910200 - Davolash ishi";

  ws.getCell("A4").value = "T/r";
  ws.getCell("B4").value = "Fanning malakaviy kodi";
  ws.getCell("C4").value = "O'quv bloklari, fanlar va faoliyat turlarining nomlari";
  ws.getCell("D5").value = "Umumiy yuklamaning hajmi";
  ws.getCell("F6").value = "Jami";
  ws.getCell("G6").value = "Ma'ruza";
  ws.getCell("H6").value = "Amaliy";
  ws.getCell("I6").value = "Laboratoriya";
  ws.getCell("J6").value = "Seminar";
  ws.getCell("K5").value = "Mustaqil ta'lim";
  ws.getCell("D10").value = "soat";
  ws.getCell("E10").value = "%";
  ws.getCell("L8").value = "Semestrlar";
  ws.getCell("X8").value = "Semestrlar";
  for (let s = 1; s <= 12; s += 1) {
    ws.getCell(9, 11 + s).value = s;
    ws.getCell(9, 23 + s).value = s;
  }
  ws.getCell("L10").value = "Semestrdagi auditoriya mashg'ulotlari haftalarining soni";
  ws.getCell("X10").value = "Kredit taqsimoti";
  for (let c = 1; c <= 36; c += 1) ws.getCell(12, c).value = c <= 10 ? c : c + 1;

  const row = (r, vals) => {
    Object.entries(vals).forEach(([col, val]) => {
      ws.getCell(`${col}${r}`).value = val;
    });
  };

  row(13, { A: "1.00", B: "MF1", C: "Majburiy fanlar", D: 720, F: 360, L: 4, X: 4, AJ: 24 });
  const FANLAR = [
    ["1.01", "AN1104", "Odam anatomiyasi"],
    ["1.02", "TK1106", "Tibbiy kimyo"],
    ["1.03", "FZ1204", "Normal fiziologiya"],
    ["1.04", "GS1206", "Gistologiya"],
    ["1.05", "BK1304", "Biokimyo"],
    ["1.06", "MB1306", "Mikrobiologiya"],
  ];
  FANLAR.forEach(([tr, kod, nom], i) => {
    row(14 + i, { A: tr, B: kod, C: nom, D: 120, F: 60, L: 4, X: 4, AJ: 4 });
  });
  row(20, { A: "2.00", B: "TF2", C: "Tanlov fanlar", D: 120, F: 60, N: 4, Z: 4, AJ: 4 });
  row(21, { C: "Jami", D: 840, F: 420, AJ: 28 });
  row(22, practiceCode
    ? { B: practiceCode, C: "Malakaviy amaliyot", D: 60, AJ: 2 }
    : { C: "Malakaviy amaliyot", D: 60, AJ: 2 });
  row(23, { B: "TM104", C: "Tanishuv amaliyoti", O: 2, AA: 2, AJ: 2 });
  row(24, { C: "HAMMASI", D: 900, AJ: 30 });

  const file = path.join(
    os.tmpdir(),
    `reja-blok-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`,
  );
  await wb.xlsx.writeFile(file);
  return file;
}

describeIfPython("reja_reader — blok chegarasi (FIX-4)", () => {
  const files = [];
  afterAll(() => {
    for (const f of files) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  });

  test("tanlov bloki YIG'INDI va AMALIYOT qatorlarini YUTMAYDI", async () => {
    const file = await buildFixture();
    files.push(file);

    const { blocks } = await parseReja(file);
    const byCode = Object.fromEntries(blocks.map((b) => [b.blockCode, b]));

    expect(byCode.MF1.sciences).toHaveLength(6);
    expect(byCode.TF2.sciences).toHaveLength(0);

    expect(byCode.MA).toBeDefined();
    expect(byCode.MA.isPractice).toBe(true);
    expect(byCode.MA.sciences.map((s) => s.code)).toEqual(["TM104"]);
  });

  test("amaliyot bo'limi KODLI bo'lsa — kod blockCode bo'ladi", async () => {
    const file = await buildFixture({ practiceCode: "MM2-520" });
    files.push(file);

    const { blocks } = await parseReja(file);
    const byCode = Object.fromEntries(blocks.map((b) => [b.blockCode, b]));

    expect(byCode.TF2.sciences).toHaveLength(0);
    expect(byCode["MM2-520"]).toBeDefined();
    expect(byCode["MM2-520"].isPractice).toBe(true);
  });

  test("yig'indi qatorlari meta.totals ga ajratiladi (blok bolasi EMAS)", async () => {
    const file = await buildFixture();
    files.push(file);

    const { meta } = await parseReja(file);
    expect((meta.totals || []).map((t) => t.title)).toEqual(["Jami", "HAMMASI"]);
  });
});
