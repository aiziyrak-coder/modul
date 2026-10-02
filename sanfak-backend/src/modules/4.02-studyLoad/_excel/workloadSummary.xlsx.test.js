const {
  buildSummaryRows,
  sumRows,
  buildWorkloadSummaryWorkbook,
  summaryFileName,
  summarizeWorkload,
  fullPersonName,
  FIRST_DATA_ROW,
  HEADER_CELLS,
} = require("./workloadSummary.xlsx");

const item = (category, slug, positions, hourly = 0) => ({
  category,
  slug,
  positions,
  load: 0,
  totalHours: 0,
  hourly,
});

const anatomy = () => ({
  department: {
    _id: "d1",
    title: "Normal anatomiya",
    head: { firstName: "Arsen", lastName: "Abdulhakimov", middleName: "Renatovich" },
  },
  directions: [{ blocks: [{ totalHour: 10000 }, { totalHour: 6830 }] }],
  staffPositions: {
    totalPositions: 23,
    hourly: 999,
    items: [
      item("departmentHead", "docent", 1),
      item("teachingStaff", "docent", 1, 200),
      item("teachingStaff", "seniorTeacher", 2),
      item("teachingStaff", "assistant", 16, 70),
      item("teachingStaff", "trainee", 0.5),
      item("supportStaff", "laborant", 2),
      item("supportStaff", "seniorLaborant", 1),
      item("supportStaff", "cabinetHead", 1),
    ],
  },
});

const physiology = () => ({
  department: { _id: "d0", title: "Fiziologiya" },
  approvalSteps: [
    { step: "methodical", status: "approved", approvedBy: { firstName: "N", lastName: "Komilov" } },
    { step: "kafedra", status: "approved", approvedBy: { firstName: "Moxidil", lastName: "Rasulova" } },
  ],
  directions: [{ blocks: [{ totalHour: 12460 }] }],
  staffPositions: { totalPositions: 17, hourly: 220, items: [] },
});

describe("summarizeWorkload — manba xaritasi (namuna ustunlari)", () => {
  test("D/E/F: umumiy = Σ blocks.totalHour, soatbay = Σ items[].hourly (qo'lda), taqsimot = D − E", () => {
    const r = summarizeWorkload(anatomy());
    expect(r.total).toBe(16830);
    expect(r.hourly).toBe(270);
    expect(r.forDistribution).toBe(16560);
  });

  test("Soatbay qo'lda kiritilmagan (items[] bo'sh) — E = 0, derived qoldiq ishlatilmaydi", () => {
    const r = summarizeWorkload(physiology());
    expect(r.hourly).toBe(0);
    expect(r.forDistribution).toBe(12460);
  });

  test("items[] to'ldirilgan — G = Σ(kafedra mudiri + ilmiy-pedagogik).positions; N = assistant + trainee; R = laborant + katta laborant", () => {
    const r = summarizeWorkload(anatomy());
    expect(r.dh).toEqual({ professor: 0, docent: 1, seniorTeacher: 0 });
    expect(r.ts).toEqual({ professor: 0, docent: 1, seniorTeacher: 2, assistant: 16.5 });
    expect(r.positions).toBe(20.5);
    expect(r.support).toEqual({ cabinetHead: 1, laborant: 3 });
    expect(r.supportTotal).toBe(4);
  });

  test("items[] bo'sh — G avto `totalPositions` (staffPositionsCalculator), lavozim ustunlari 0", () => {
    const r = summarizeWorkload(physiology());
    expect(r.positions).toBe(17);
    expect(r.dh).toEqual({ professor: 0, docent: 0, seniorTeacher: 0 });
    expect(r.supportTotal).toBe(0);
  });

  test("Kafedra mudiri: department.head (to'liq F.I.O) → zaxira zanjir `kafedra` bosqichi imzosi → bo'sh", () => {
    expect(summarizeWorkload(anatomy()).head).toBe("Abdulhakimov Arsen Renatovich");
    expect(summarizeWorkload(physiology()).head).toBe("Rasulova Moxidil");
    expect(summarizeWorkload({ department: { _id: "x", title: "X" } }).head).toBe("");
    expect(fullPersonName(null)).toBe("");
    expect(fullPersonName("5f1a…")).toBe("");
  });

  test("bo'sh/yarim hujjat — nol qaytaradi, xato bermaydi", () => {
    const r = summarizeWorkload({ department: null });
    expect(r.total).toBe(0);
    expect(r.positions).toBe(0);
    expect(r.department).toBe("");
  });
});

describe("buildSummaryRows — kafedra bo'yicha yig'ish, tartib, raqamlash", () => {
  test("kafedra nomi bo'yicha saralanadi, № 1 dan", () => {
    const rows = buildSummaryRows([anatomy(), physiology()]);
    expect(rows.map((r) => [r.no, r.department])).toEqual([
      [1, "Fiziologiya"],
      [2, "Normal anatomiya"],
    ]);
  });

  test("bir kafedraning bir yildagi ikki hujjati BITTA qatorga yig'iladi", () => {
    const rows = buildSummaryRows([anatomy(), anatomy()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(33660);
    expect(rows[0].positions).toBe(41);
    expect(rows[0].support.laborant).toBe(6);
  });

  test("«Jami» — barcha ustunlar yig'indisi", () => {
    const t = sumRows(buildSummaryRows([anatomy(), physiology()]));
    expect(t.total).toBe(29290);
    expect(t.hourly).toBe(270);
    expect(t.forDistribution).toBe(29020);
    expect(t.positions).toBe(37.5);
    expect(t.ts.assistant).toBe(16.5);
    expect(t.supportTotal).toBe(4);
  });

  test("bo'sh kirish — bo'sh ro'yxat, Jami nol", () => {
    expect(buildSummaryRows([])).toEqual([]);
    expect(buildSummaryRows(null)).toEqual([]);
    expect(sumRows([]).total).toBe(0);
  });
});

describe("buildWorkloadSummaryWorkbook — namuna bilan 1:1 (sarlavha, merge, qatorlar)", () => {
  const DATE = new Date(2026, 8, 16);
  const build = () =>
    buildWorkloadSummaryWorkbook({
      rows: buildSummaryRows([anatomy(), physiology()]),
      academicYearTitle: "2026/2027",
      date: DATE,
    }).worksheets[0];

  test("varaq nomi = sana; A8 sarlavha o'quv yili bilan; R9 sana; muqova bloklari", () => {
    const ws = build();
    expect(ws.name).toBe("16.09.2026");
    expect(ws.getCell("A8").value).toBe(
      "Farg'ona jamoat salomatligi tibbiyot instituti 2026/2027-o'quv yili uchun kafedralar soatlar hisobi va ish o'rinlari\nJADVALI",
    );
    expect(ws.getCell("R9").value).toBe("16.09.2026-yil");
    expect(ws.getCell("A1").value).toContain('"TASDIQLAYMAN"');
    expect(ws.getCell("A1").value).toContain("instituti rektori");
    expect(ws.getCell("P1").value).toContain('"KELISHILDI"');
    expect(ws.getCell("P1").value).toContain("prorektor");
    expect(ws.getCell("A1").value).toContain("____________");
  });

  test("sarlavha merge'lari va matnlari namunadagidek (26 katak, A10:A18 … T15:T18)", () => {
    const ws = build();
    const merges = new Set(Object.keys(ws._merges));
    for (const [range, text] of HEADER_CELLS) {
      expect(merges.has(range.split(":")[0])).toBe(true);
      expect(ws.getCell(range.split(":")[0]).value).toBe(text);
    }
    expect(ws.getCell("D10").value).toBe("Umumiy o'quv\nyuklama");
    expect(ws.getCell("G10").value).toBe("Professor-o'qituvchi\numumiy ish o'rinlari");
    expect(ws.getCell("N15").value).toBe("O'qituvchi, assistent");
    expect(ws.getCell("Q15").value).toBe("Laboratoriya mudiri");
    expect(ws.getCell("S15").value).toBe("Laboratoriya ishchisi");
    expect(ws.getCell("T15").value).toBe("EXM\nmuxandisi");
    for (const m of ["A1", "P1", "A8", "R9"]) expect(merges.has(m)).toBe(true);
  });

  test("ma'lumot qatorlari 19-dan: A..T qiymatlari; Q/S/T BO'SH (a-variant); nol → bo'sh", () => {
    const ws = build();
    const r1 = ws.getRow(FIRST_DATA_ROW).values;
    expect(r1.slice(1, 8)).toEqual([1, "Fiziologiya", "Rasulova Moxidil", 12460, undefined, 12460, 17]);
    expect(r1[8]).toBeUndefined();
    const r2 = ws.getRow(FIRST_DATA_ROW + 1).values;
    expect(r2.slice(1, 8)).toEqual([
      2, "Normal anatomiya", "Abdulhakimov Arsen Renatovich", 16830, 270, 16560, 20.5,
    ]);
    expect(r2[9]).toBe(1);
    expect(r2[12]).toBe(1);
    expect(r2[13]).toBe(2);
    expect(r2[14]).toBe(16.5);
    expect(r2[15]).toBe(4);
    expect(r2[16]).toBe(1);
    expect(r2[17]).toBeUndefined();
    expect(r2[18]).toBe(3);
    expect(r2[19]).toBeUndefined();
    expect(r2[20]).toBeUndefined();
  });

  test("«Jami» qatori ma'lumotlardan keyin, A:C merge, yig'indilar; imzo qatorlari +3/+6", () => {
    const ws = build();
    const jamiRow = FIRST_DATA_ROW + 2;
    expect(ws.getCell(jamiRow, 1).value).toBe("Jami");
    expect(Object.keys(ws._merges)).toContain(`A${jamiRow}`);
    expect(ws.getRow(jamiRow).values.slice(4, 8)).toEqual([29290, 270, 29020, 37.5]);
    expect(ws.getCell(jamiRow, 19).value).toBe(0);
    expect(ws.getCell(jamiRow + 3, 3).value).toBe("O'quv-uslubiy boshqarma boshlig'i:");
    expect(ws.getCell(jamiRow + 6, 3).value).toBe("Reja moliya bo'limi boshlig'i:");
    expect(ws.getCell(jamiRow + 3, 12).value).toBe("____________");
  });

  test("bo'sh ro'yxat — sarlavha + Jami (nol) qatori, xato yo'q", () => {
    const ws = buildWorkloadSummaryWorkbook({ rows: [], academicYearTitle: "2026/2027", date: DATE })
      .worksheets[0];
    expect(ws.getCell(FIRST_DATA_ROW, 1).value).toBe("Jami");
    expect(ws.getCell(FIRST_DATA_ROW, 4).value).toBe(0);
  });

  test("ustun kengliklari va muzlatish namunadan (A 4.9 · B 31.9 · C 39 · raqamlilar 9.7; 18 qator muzlatilgan)", () => {
    const ws = build();
    expect(ws.getColumn("A").width).toBe(4.9);
    expect(ws.getColumn("B").width).toBe(31.9);
    expect(ws.getColumn("C").width).toBe(39);
    expect(ws.getColumn("T").width).toBe(9.7);
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 18 });
  });

  test("workbook haqiqiy xlsx baytlariga yoziladi (ExcelJS)", async () => {
    const wb = buildWorkloadSummaryWorkbook({
      rows: buildSummaryRows([anatomy()]),
      academicYearTitle: "2026/2027",
      date: DATE,
    });
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.slice(0, 2).toString("binary")).toBe("PK");
  });
});

describe("summaryFileName", () => {
  test("o'quv yilidan xavfsiz nom", () => {
    expect(summaryFileName("2026/2027")).toBe("kafedralar-soatlar-hisobi-2026-2027.xlsx");
    expect(summaryFileName("")).toBe("kafedralar-soatlar-hisobi.xlsx");
    expect(summaryFileName(null)).toBe("kafedralar-soatlar-hisobi.xlsx");
  });
});
