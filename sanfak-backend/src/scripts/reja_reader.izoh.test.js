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

async function buildFixture({ izohRows = null, sheetName = "Izoh" } = {}) {
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
  [
    ["1.01", "AN1104", "Odam anatomiyasi"],
    ["1.02", "TK1106", "Tibbiy kimyo"],
    ["1.03", "FZ1204", "Normal fiziologiya"],
    ["1.04", "GS1206", "Gistologiya"],
    ["1.05", "BK1304", "Biokimyo"],
    ["1.06", "MB1306", "Mikrobiologiya"],
  ].forEach(([tr, kod, nom], i) => {
    row(14 + i, { A: tr, B: kod, C: nom, D: 120, F: 60, L: 4, X: 4, AJ: 4 });
  });

  if (izohRows) {
    const iz = wb.addWorksheet(sheetName);
    izohRows.forEach((r, i) => {
      if (Array.isArray(r)) {
        r.forEach((cell, c) => {
          if (cell !== null) iz.getCell(i + 1, c + 1).value = cell;
        });
      } else {
        iz.getCell(i + 1, 1).value = r;
      }
    });
  }

  const file = path.join(
    os.tmpdir(),
    `reja-izoh-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`,
  );
  await wb.xlsx.writeFile(file);
  return file;
}

describeIfPython("reja_reader — \"Izoh\" varag'i", () => {
  const files = [];
  afterAll(() => {
    for (const f of files) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  });

  const parse = async (opts) => {
    const file = await buildFixture(opts);
    files.push(file);
    return parseReja(file);
  };

  test("varaq bo'lsa — matn `meta.izoh` ga tushadi, sarlavha katakchasi tashlanadi", async () => {
    const { meta } = await parse({
      izohRows: [
        "Izoh:",
        "1) 1 kredit 30 akademik soatni tashkil qiladi.",
        "2) GPA ko'rsatkichi avgust oyining uchinchi haftasida aniqlanadi.",
      ],
    });

    expect(meta.izoh).toBe(
      "1) 1 kredit 30 akademik soatni tashkil qiladi.\n" +
        "2) GPA ko'rsatkichi avgust oyining uchinchi haftasida aniqlanadi.",
    );
  });

  test("matn A emas, B ustunida bo'lsa ham o'qiladi (raqam alohida katakda)", async () => {
    const { meta } = await parse({
      izohRows: [["Izoh"], [1, "Birinchi band."], [2, "Ikkinchi band."]],
    });

    expect(meta.izoh).toBe("1 Birinchi band.\n2 Ikkinchi band.");
  });

  test("varaq umuman bo'lmasa — `meta.izoh` yo'q (bloklar buzilmaydi)", async () => {
    const { meta, blocks } = await parse({});

    expect(meta.izoh).toBeUndefined();
    expect(blocks.find((b) => b.blockCode === "MF1").sciences).toHaveLength(6);
  });
});
