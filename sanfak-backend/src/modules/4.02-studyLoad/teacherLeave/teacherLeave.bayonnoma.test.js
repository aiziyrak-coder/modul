const { Types } = require("mongoose");
const {
  buildBayonnomaInfoRows,
  buildBayonnomaSignature,
  formatLeavePeriod,
  teacherFullName,
  refTitle,
} = require("./teacherLeave.bayonnoma");

const rowsToMap = (rows) => Object.fromEntries(rows);

describe("teacherLeave bayonnoma — ma'lumot kartasi", () => {
  const base = {
    type: "leave",
    reason: "Oilaviy sabab",
    approvalDate: new Date("2026-09-13T10:00:00Z"),
  };

  test("populate qilingan lavozim / kafedra / o'quv yili — NOMI chiqadi", () => {
    const m = rowsToMap(
      buildBayonnomaInfoRows({
        ...base,
        teacher: {
          lastName: "Umirzakov",
          firstName: "Odiljon",
          middleName: "Ergashevich",
          position: { _id: new Types.ObjectId(), title: "Assistent" },
          department: { _id: new Types.ObjectId(), title: "Anatomiya kafedrasi" },
        },
        distribution: {
          department: { _id: new Types.ObjectId(), title: "Normal anatomiya kafedrasi" },
          academicYear: { _id: new Types.ObjectId(), title: "2026/2027" },
        },
      }),
    );
    expect(m["O'qituvchi"]).toBe("Umirzakov Odiljon Ergashevich");
    expect(m.Lavozim).toBe("Assistent");
    expect(m.Kafedra).toBe("Normal anatomiya kafedrasi");
    expect(m["O'quv yili"]).toBe("2026/2027");
    expect(m["Amaliyot turi"]).toBe("Ta'til/chetlatish");
    expect(m.Sabab).toBe("Oilaviy sabab");
    expect(m.Sana).toBe("13.09.2026");
  });

  test("XOM ObjectId (populate qilinmagan) HECH QACHON chizilmaydi — «—»", () => {
    const rawPos = new Types.ObjectId();
    const rawYear = new Types.ObjectId();
    const m = rowsToMap(
      buildBayonnomaInfoRows({
        ...base,
        teacher: { lastName: "A", firstName: "B", position: rawPos },
        distribution: { academicYear: rawYear },
      }),
    );
    expect(m.Lavozim).toBe("—");
    expect(m["O'quv yili"]).toBe("—");
    expect(JSON.stringify(m)).not.toContain(String(rawPos));
    expect(JSON.stringify(m)).not.toContain(String(rawYear));
  });

  test("taqsimot bog'lanmagan — kafedra o'qituvchining o'z kafedrasidan", () => {
    const m = rowsToMap(
      buildBayonnomaInfoRows({
        ...base,
        teacher: {
          lastName: "A",
          firstName: "B",
          department: { title: "Fiziologiya kafedrasi" },
        },
        distribution: null,
      }),
    );
    expect(m.Kafedra).toBe("Fiziologiya kafedrasi");
    expect(m["O'quv yili"]).toBe("—");
  });

  test("bo'sh qiymatlar — «—», xato yo'q", () => {
    const m = rowsToMap(buildBayonnomaInfoRows({ type: "transfer" }));
    expect(m.Sana).toBe("—");
    expect(m["O'qituvchi"]).toBe("—");
    expect(m.Lavozim).toBe("—");
    expect(m.Sabab).toBe("—");
    expect(m.Kafedra).toBe("—");
    expect(m["Amaliyot turi"]).toBe("Ko'chirish");
  });

  test("yordamchilar", () => {
    expect(refTitle({ title: "  Dotsent " })).toBe("Dotsent");
    expect(refTitle("Dotsent")).toBeNull();
    expect(refTitle({})).toBeNull();
    expect(teacherFullName(null)).toBe("—");
  });
});

describe("teacherLeave bayonnoma — Muddat", () => {
  const from = new Date("2026-10-01T12:00:00Z");
  const to = new Date("2026-11-15T12:00:00Z");

  test("ikkalasi bor — «dd.mm.yyyy – dd.mm.yyyy», «Amaliyot turi»dan keyin", () => {
    const rows = buildBayonnomaInfoRows({ type: "leave", fromDate: from, toDate: to });
    const labels = rows.map(([k]) => k);
    expect(labels.indexOf("Muddat")).toBe(labels.indexOf("Amaliyot turi") + 1);
    expect(rowsToMap(rows).Muddat).toBe("01.10.2026 – 15.11.2026");
  });

  test("bir tomoni yo'q — mavjudi ko'rsatiladi", () => {
    expect(formatLeavePeriod(from, null)).toBe("01.10.2026 dan boshlab");
    expect(formatLeavePeriod(null, to)).toBe("15.11.2026 gacha");
  });

  test("ikkalasi yo'q — «—»", () => {
    expect(formatLeavePeriod(null, undefined)).toBe("—");
    expect(rowsToMap(buildBayonnomaInfoRows({ type: "transfer" })).Muddat).toBe("—");
  });
});

describe("teacherLeave bayonnoma — tasdiqlash bloki", () => {
  const approvalDate = new Date("2026-09-20T12:00:00Z");
  const approver = {
    _id: new Types.ObjectId(),
    firstName: "Botir",
    middleName: "Karimovich",
    lastName: "Yusupov",
    position: { _id: new Types.ObjectId(), title: "Normal anatomiya kafedrasi mudiri" },
  };

  test("lavozim NOMI + qisqa ism (A.A.Familiya) + dd.mm.yyyy + chain manba", () => {
    const o = buildBayonnomaSignature({ approvedBy: approver, approvalDate }, null);
    expect(o.layout).toBe("row");
    expect(o.position).toBe("Normal anatomiya kafedrasi mudiri:");
    expect(o.sig.name).toBe("B.K.Yusupov");
    expect(o.sig.dateText).toBe("20.09.2026");
    expect(o.sig.source).toBe("chain");
    expect(o.qr).toBeUndefined();
  });

  test("lavozim populate qilinmagan — «Kafedra mudiri» (xom ID chizilmaydi)", () => {
    const o = buildBayonnomaSignature(
      { approvedBy: { ...approver, position: new Types.ObjectId() }, approvalDate },
      null,
    );
    expect(o.position).toBe("Kafedra mudiri:");
  });

  test("snapshot bor — ism/sana snapshot'dan (ADR-020), QR slotga uzatiladi", () => {
    const qr = { image: Buffer.from("qr"), url: "https://x/verify/doc/abc" };
    const o = buildBayonnomaSignature(
      {
        approvedBy: approver,
        approvalDate,
        verify: {
          snapshot: [{ step: "kafedra", label: "Kafedra mudiri", shortName: "B.Yusupov", date: approvalDate }],
        },
      },
      qr,
    );
    expect(o.sig.source).toBe("snapshot");
    expect(o.sig.name).toBe("B.Yusupov");
    expect(o.sig.dateText).toBe("20.09.2026");
    expect(o.qr).toEqual({ image: qr.image, size: 40 });
  });
});
