const PersonalWorkPlanModel = require("./personalWorkPlan.model");

describe("status enum (5-holat)", () => {
  test("`completed` enumga kiritilgan", () => {
    const enumValues = PersonalWorkPlanModel.schema.path("status").enumValues;
    expect(enumValues).toEqual([
      "draft",
      "submitted",
      "approved",
      "rejected",
      "completed",
    ]);
  });
});

describe("APPROVAL_STEPS / buildDefaultApprovals", () => {
  test("8 bosqich, shablon imzo blokidagi TARTIBDA", () => {
    expect(PersonalWorkPlanModel.APPROVAL_STEPS.map((s) => s.step)).toEqual([
      "teacher",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
      "kafedraMudiri",
      "oquvUslubiy",
      "dekan",
      "ichkiNazorat",
    ]);
  });

  test("har bosqichda `label` bo'sh emas", () => {
    for (const step of PersonalWorkPlanModel.APPROVAL_STEPS) {
      expect(typeof step.label).toBe("string");
      expect(step.label.length).toBeGreaterThan(0);
    }
  });

  test("`buildDefaultApprovals()` — 8ta, hammasi `pending`", () => {
    const approvals = PersonalWorkPlanModel.buildDefaultApprovals();
    expect(approvals).toHaveLength(8);
    expect(approvals.every((a) => a.status === "pending")).toBe(true);
    expect(approvals.map((a) => a.step)).toEqual(
      PersonalWorkPlanModel.APPROVAL_STEPS.map((s) => s.step),
    );
  });

  test("chaqiruvlar orasida MUTATSIYA sizib chiqmaydi (har safar yangi massiv)", () => {
    const a1 = PersonalWorkPlanModel.buildDefaultApprovals();
    a1[0].status = "approved";
    const a2 = PersonalWorkPlanModel.buildDefaultApprovals();
    expect(a2[0].status).toBe("pending");
  });
});

describe("`approvals` schema maydoni — mavjud", () => {
  test("`approvals` array sifatida e'lon qilingan", () => {
    const path = PersonalWorkPlanModel.schema.path("approvals");
    expect(path).toBeDefined();
    expect(path.instance).toBe("Array");
  });
});

describe("fillDefaultApprovals — pre-save hook (nomlangan, to'g'ridan-to'g'ri chaqiriladi)", () => {
  const { fillDefaultApprovals } = PersonalWorkPlanModel;

  test("`isNew: true` va bo'sh `approvals` — 8 bosqich to'ldiriladi", (done) => {
    const fakeDoc = { isNew: true, approvals: [] };
    fillDefaultApprovals.call(fakeDoc, () => {
      expect(fakeDoc.approvals).toHaveLength(8);
      expect(fakeDoc.approvals[0].step).toBe("teacher");
      expect(fakeDoc.approvals.every((a) => a.status === "pending")).toBe(true);
      done();
    });
  });

  test("`isNew: true`, `approvals` yo'q (`undefined`) — baribir to'ldiriladi", (done) => {
    const fakeDoc = { isNew: true };
    fillDefaultApprovals.call(fakeDoc, () => {
      expect(fakeDoc.approvals).toHaveLength(8);
      done();
    });
  });

  test("mavjud (bo'sh bo'lmagan) `approvals` qayta yozilmaydi", (done) => {
    const existing = [{ step: "teacher", label: "x", status: "approved" }];
    const fakeDoc = { isNew: true, approvals: existing };
    fillDefaultApprovals.call(fakeDoc, () => {
      expect(fakeDoc.approvals).toBe(existing);
      expect(fakeDoc.approvals).toHaveLength(1);
      done();
    });
  });

  test("`isNew: false` (mavjud hujjatni saqlash) — approvals tegilmaydi", (done) => {
    const fakeDoc = { isNew: false, approvals: [] };
    fillDefaultApprovals.call(fakeDoc, () => {
      expect(fakeDoc.approvals).toEqual([]);
      done();
    });
  });
});

describe("WorkItemSchema.effectiveStatus — lean bilan virtual yo'qoladimi (F-4)", () => {
  const buildPlan = () =>
    new PersonalWorkPlanModel({
      teacher: "aaaaaaaaaaaaaaaaaaaaaaaa",
      academicYear: "bbbbbbbbbbbbbbbbbbbbbbbb",
      researchWork: [
        {
          title: "Muddati o'tgan ish",
          status: "planned",
          deadline: new Date("2020-01-01"),
        },
      ],
    });

  test("virtuallarsiz (`lean(true)` bilan bir xil shakl) — `effectiveStatus` YO'Q", () => {
    const plain = buildPlan().toObject({ virtuals: false });
    expect(plain.researchWork[0].effectiveStatus).toBeUndefined();
  });

  test("virtuallar bilan (`lean({virtuals:true})` bilan bir xil shakl) — `effectiveStatus: 'overdue'`", () => {
    const plain = buildPlan().toObject({ virtuals: true });
    expect(plain.researchWork[0].effectiveStatus).toBe("overdue");
  });
});

describe("teachingLoad.sciences — D-3b yangi kalitlar (null = eski qator)", () => {
  const doc = new PersonalWorkPlanModel({
    teachingLoad: { sciences: [{ hoursByType: { lecture: 24, seminar: 192, independent: 10 }, totalHour: 226 }] },
  });
  const row = doc.teachingLoad.sciences[0];

  test.each([["on"], ["yan"], ["retake"], ["practiceLead"], ["otherWork"], ["adjustment"]])(
    "hoursByType.%s — null (0 EMAS)",
    (key) => {
      expect(row.hoursByType[key]).toBeNull();
    },
  );

  test("oqim/guruh/blockId — null; eski kalitlar va `independent` saqlanadi", () => {
    expect(row.streamCount).toBeNull();
    expect(row.groupCount).toBeNull();
    expect(row.blockId).toBeNull();
    expect(row.hoursByType.independent).toBe(10);
  });
});
