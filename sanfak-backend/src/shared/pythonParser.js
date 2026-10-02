const { spawn } = require("child_process");
const path = require("path");

const PYTHON = process.env.PYTHON_PATH || "python3";

const SCRIPT = path.join(__dirname, "../scripts/jarayon_reader.py");
const REJA_SCRIPT = path.join(__dirname, "../scripts/reja_reader.py");
const REJA_PDF_SCRIPT = path.join(__dirname, "../scripts/reja_pdf_reader.py");

async function parseJarayon(xlsxDiskYoli, sheetNom = null) {
  const args = [SCRIPT, xlsxDiskYoli, "--stdout"];
  if (sheetNom) args.push("--sheet", sheetNom);
  const jsonMatn = await _runPython(args);
  return JSON.parse(jsonMatn);
}

async function parseReja(xlsxDiskYoli, sheetNom = null) {
  const args = [REJA_SCRIPT, xlsxDiskYoli, "--stdout"];
  if (sheetNom) args.push("--sheet", sheetNom);
  const jsonMatn = await _runPython(args);
  const raw = JSON.parse(jsonMatn);

  const meta = raw.meta || {};
  const blocks = Object.entries(raw)
    .filter(([key]) => key !== "meta")
    .map(([, blok]) => blok);

  return { meta, blocks };
}

function fileUrlToPath(fileUrl) {
  const marker = "/files/";
  const markerIdx = fileUrl.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error(`Noto'g'ri fayl URL: ${fileUrl}`);
  }
  const relativePath = fileUrl
    .slice(markerIdx + marker.length)
    .split("?")[0]
    .split("#")[0];

  const baseDir = process.env.FILEPATH;
  if (!baseDir) {
    throw new Error("FILEPATH muhit o'zgaruvchisi sozlanmagan");
  }

  return path.join(baseDir, "uploads", relativePath);
}

function _runPython(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, args, {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        if (stderr.includes("ModuleNotFoundError") || stderr.includes("No module named")) {
          const moduleMatch = stderr.match(/No module named ['"]([^'"]+)['"]/);
          const moduleName = moduleMatch ? moduleMatch[1] : "<paket>";
          return reject(
            new Error(
              `Python paketlari o'rnatilmagan ('${moduleName}' topilmadi).\n` +
              `\nServerda quyidagi buyruqni bajaring:\n` +
              `  pip3 install -r src/scripts/requirements.txt\n` +
              `\nYoki manual:\n` +
              `  pip3 install openpyxl pdfplumber pytesseract Pillow PyMuPDF\n` +
              `\nAsl xato:\n${stderr.trim()}`,
            ),
          );
        }
        return reject(
          new Error(
            `Python skript xatolik bilan tugatdi (kod: ${code}).\n${stderr.trim()}`,
          ),
        );
      }
      if (!stdout.trim()) {
        return reject(new Error("Python skript hech narsa qaytarmadi."));
      }
      resolve(stdout);
    });

    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        return reject(
          new Error(
            `Python interpretator topilmadi ('${PYTHON}').\n` +
            `\nServerda Python3 o'rnating:\n` +
            `  sudo apt update && sudo apt install python3 python3-pip\n` +
            `\nKeyin paketlarni:\n` +
            `  pip3 install -r src/scripts/requirements.txt`,
          ),
        );
      }
      reject(new Error(`Python ishga tushmadi: ${err.message}`));
    });
  });
}

async function parsePdfReja(pdfDiskYoli) {
  const args = [REJA_PDF_SCRIPT, pdfDiskYoli, "--stdout"];
  const jsonMatn = await _runPython(args);
  return JSON.parse(jsonMatn);
}

module.exports = { parseJarayon, parseReja, parsePdfReja, fileUrlToPath };
