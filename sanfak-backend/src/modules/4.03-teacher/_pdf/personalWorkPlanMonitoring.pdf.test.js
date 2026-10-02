const { buildMonitoringPdf } = require("./personalWorkPlanMonitoring.pdf");

const rows = [
  {
    teacherId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    teacherName: "Valiyev Ali",
    academicYear: { title: "2025/2026" },
    department: { title: "Ichki kasalliklar" },
    submitStatus: "submitted",
    totalItems: 5,
    completedItems: 3,
    overdueCount: 1,
    completionPercent: 60,
  },
];

describe("buildMonitoringPdf — muvaffaqiyatli generatsiya", () => {
  test("qatorlar bilan xatosiz PDF quriladi va baytlar chiqadi", async () => {
    const doc = buildMonitoringPdf(rows, {
      departmentTitle: "Ichki kasalliklar",
      academicYearTitle: "2025/2026",
    });

    const chunks = [];
    const finished = new Promise((resolve) => {
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", resolve);
    });
    doc.end();
    await finished;

    expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
  });

  test("bo'sh ro'yxat bilan ham xato bermaydi ('Ma'lumot topilmadi' holati)", async () => {
    const doc = buildMonitoringPdf([], {});

    const chunks = [];
    const finished = new Promise((resolve) => {
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", resolve);
    });
    doc.end();
    await finished;

    expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
  });

  test("`meta` berilmasa ham (default {}) xato bermaydi", () => {
    expect(() => buildMonitoringPdf(rows)).not.toThrow();
  });
});
