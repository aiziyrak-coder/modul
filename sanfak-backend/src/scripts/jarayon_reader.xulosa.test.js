const path = require("path");
const fs = require("fs");
const os = require("os");

require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { spawnSync } = require("child_process");

const ExcelJS = require("exceljs");
const { parseJarayon } = require("#shared/pythonParser");

const PYTHON = process.env.PYTHON_PATH || "python3";
const pythonReady =
  spawnSync(PYTHON, ["-c", "import openpyxl"], { stdio: "ignore" }).status === 0;

const describeIfPython = pythonReady ? describe : describe.skip;

jest.setTimeout(30000);

async function buildFixture({ withXulosa = true } = {}) {
  const wb = new ExcelJS.Workbook();

  const jar = wb.addWorksheet("Jarayon");
  jar.addRow([
    "Nazariy va amaliy ta'lim", "A", "Attestatsiyalar",
    "M", "Malakaviy amaliyot",
    "D", "Yakuniy Davlat attestatsiyasi",
    "T", "Ta'til",
    "K", "Kredit ta'lim tizimiga kirish",
    "G", "GPA ko'rsatkichini hisoblash",
  ]);

  if (withXulosa) {
    const xu = wb.addWorksheet("Xulosa");
    xu.addRow(["O'quv jarayonining tarkibiy qismlari", null, null, null]);
    xu.addRow([]);
    xu.addRow(["O'quv jarayonining tarkibiy qismlari", "Haftalar soni", "Semestr", null]);
    xu.addRow([
      "Nazariy va amaliy ta'lim", 180, "1-12",
      "Ixtisoslik fanlaridan birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi",
    ]);
    xu.addRow(["Amaliyot", 27, "2-11", null]);
    xu.addRow(["Attestatsiyalar", 35, "1-12", null]);
    xu.addRow(["Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi", 4, 12, null]);
    xu.addRow(["Ta'til haftalari", 56, "1-12", null]);
    xu.addRow(["Kredit ta'lim tizimiga kirish", 1, 1, null]);
    xu.addRow(["GPA ko'rsatkichini hisoblash", 5, "2,4,6,8,10", null]);
    xu.addRow(["JAMI", 308, null, null]);
  }

  const filePath = path.join(
    os.tmpdir(),
    `jarayon-xulosa-${withXulosa}-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`,
  );
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

describeIfPython("jarayon_reader.py — 'Xulosa' varaq (Q-5, Semestr)", () => {
  const files = [];
  afterAll(() => {
    for (const f of files) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  });

  test("Xulosa varaq BOR — summary[] to'ldirilgan, har qator legend bilan fuzzy-match qilingan", async () => {
    const file = await buildFixture({ withXulosa: true });
    files.push(file);

    const natija = await parseJarayon(file, "Jarayon");

    expect(Array.isArray(natija.summary)).toBe(true);
    expect(natija.summary).toHaveLength(7);

    const byKey = (k) => natija.summary.find((s) => s.key === k);

    expect(byKey(" ")).toMatchObject({
      title: "Nazariy va amaliy ta'lim",
      weeks: 180,
      semester: "1-12",
    });
    expect(byKey("M")).toMatchObject({ title: "Amaliyot", weeks: 27, semester: "2-11" });
    expect(byKey("A")).toMatchObject({ title: "Attestatsiyalar", weeks: 35, semester: "1-12" });
    expect(byKey("D")).toMatchObject({
      title: "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi",
      weeks: 4,
      semester: "12",
    });
    expect(byKey("T")).toMatchObject({ title: "Ta'til haftalari", weeks: 56, semester: "1-12" });
    expect(byKey("K")).toMatchObject({
      title: "Kredit ta'lim tizimiga kirish",
      weeks: 1,
      semester: "1",
    });
    expect(byKey("G")).toMatchObject({
      title: "GPA ko'rsatkichini hisoblash",
      weeks: 5,
      semester: "2,4,6,8,10",
    });

    expect(byKey(" ").note).toBe(
      "Ixtisoslik fanlaridan birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi",
    );
    expect(byKey("A").note).toBeNull();
  });

  test("Xulosa varaq YO'Q (eski shablon) — summary `null`, legend/xato holati o'zgarmaydi", async () => {
    const file = await buildFixture({ withXulosa: false });
    files.push(file);

    const natija = await parseJarayon(file, "Jarayon");

    expect(natija.summary).toBeNull();
    expect(Array.isArray(natija.keys)).toBe(true);
    expect(natija.keys.length).toBeGreaterThan(0);
  });
});
