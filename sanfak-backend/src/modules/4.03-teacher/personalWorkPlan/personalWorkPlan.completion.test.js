const {
  completeActivityLock,
  countsAsCompleted,
  completionBlockers,
} = require("./personalWorkPlan.completion");

const approved = { status: "approved" };

describe("completeActivityLock (D-7, D-32)", () => {
  it.each(["draft", "submitted", "rejected", "completed", undefined])(
    "reja holati %s — qulf (faqat tasdiqlangan rejada)",
    (status) => {
      expect(completeActivityLock({ status }, { status: "planned" })).toMatch(
        /tasdiqlangan ish rejasida/,
      );
    },
  );

  it("tasdiqlangan reja, rejalashtirilgan faoliyat — ruxsat", () => {
    expect(completeActivityLock(approved, { status: "planned" })).toBeNull();
  });

  it("D-32: rad etilgan dalilni qayta yuborish — ruxsat", () => {
    expect(
      completeActivityLock(approved, {
        status: "completed",
        verification: { status: "rejected" },
      }),
    ).toBeNull();
  });

  it.each(["pending", "approved", undefined])(
    "bajarilgan, dalil %s — qulf (tasdiqlangan dalil qayta pending'ga tushmasin)",
    (verification) => {
      expect(
        completeActivityLock(approved, {
          status: "completed",
          verification: verification ? { status: verification } : undefined,
        }),
      ).toMatch(/allaqachon bajarilgan/);
    },
  );
});

describe("countsAsCompleted (D-21 monitoring)", () => {
  it("rad etilgan dalil bajarilgan hisoblanmaydi", () => {
    expect(countsAsCompleted({ status: "completed", verification: { status: "rejected" } })).toBe(false);
  });

  it("tekshiruvdagi va tasdiqlangan dalil — bajarilgan", () => {
    expect(countsAsCompleted({ status: "completed", verification: { status: "pending" } })).toBe(true);
    expect(countsAsCompleted({ status: "completed", verification: { status: "approved" } })).toBe(true);
  });

  it("bajarilmagan — yo'q", () => {
    expect(countsAsCompleted({ status: "planned" })).toBe(false);
  });
});

describe("completionBlockers (D-21 yakunlash)", () => {
  it("bajarilmagan va tasdiqlanmagan alohida sanaladi", () => {
    const plan = {
      a: [
        { status: "planned" },
        { status: "completed", verification: { status: "pending" } },
        { status: "completed", verification: { status: "rejected" } },
        { status: "completed", verification: { status: "approved" } },
      ],
      b: [{ status: "completed" }],
    };
    expect(completionBlockers(plan, ["a", "b", "c"])).toEqual({
      notCompleted: 1,
      notVerified: 3,
    });
  });

  it("hammasi bajarilgan va tasdiqlangan — to'siq yo'q", () => {
    const plan = { a: [{ status: "completed", verification: { status: "approved" } }] };
    expect(completionBlockers(plan, ["a"])).toEqual({ notCompleted: 0, notVerified: 0 });
  });
});
