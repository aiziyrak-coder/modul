const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { parseReja } = require("#shared/pythonParser");

const NAMUNA = path.join(
  __dirname,
  "../../../o'quv-reja -namunalar/Davolash-ishi-2023_Oquv-rejasi.xlsx",
);

const fs = require("fs");
const describeIfFixture = fs.existsSync(NAMUNA) ? describe : describe.skip;

describeIfFixture("reja_reader — semestr vs kurs hafta qatori ajratilishi", () => {
  jest.setTimeout(30000);

  test("distribution.weekly (kurs, 30×6) va distribution.audience (semestr, 15×12) adashtirilmaydi", async () => {
    const { meta } = await parseReja(NAMUNA, "Oquv rejasi");

    expect(meta.distribution.weekly).toEqual([30, 30, 30, 30, 30, 30]);
    expect(meta.distribution.audience).toEqual([
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
    ]);
  });

  test("credit.weekly (kurs, 30×6) va credit.distribution (semestr, 30×12) — barqaror qoladi", async () => {
    const { meta } = await parseReja(NAMUNA, "Oquv rejasi");

    expect(meta.credit.weekly).toEqual([30, 30, 30, 30, 30, 30]);
    expect(meta.credit.distribution).toEqual([
      30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    ]);
  });
});
