const { nextBackupNumber, parseObjectIdString } = require("./_lib");

describe("_lib — nextBackupNumber", () => {
  test("bo'sh ro'yxatda 1 dan boshlaydi", () => {
    expect(nextBackupNumber([], "fix-workload-academicyear-ref")).toBe(1);
  });

  test("mavjud fayllardan eng kattasidan keyingisini tanlaydi", () => {
    const files = [
      "fix-workload-academicyear-ref-1.json",
      "fix-workload-academicyear-ref-3.json",
    ];
    expect(nextBackupNumber(files, "fix-workload-academicyear-ref")).toBe(4);
  });

  test("boshqa skript nomidagi fayllarni e'tiborsiz qoldiradi", () => {
    const files = ["merge-academicyear-duplicates-9.json"];
    expect(nextBackupNumber(files, "fix-workload-academicyear-ref")).toBe(1);
  });

  test("raqamsiz/mos kelmaydigan fayl nomlarini e'tiborsiz qoldiradi", () => {
    const files = ["fix-workload-academicyear-ref-abc.json", "random.json"];
    expect(nextBackupNumber(files, "fix-workload-academicyear-ref")).toBe(1);
  });

  test("prefiksi bir xil, lekin uzunroq skript nomini aralashtirmaydi", () => {
    const files = ["fix-workload-academicyear-ref-x-5.json"];
    expect(nextBackupNumber(files, "fix-workload-academicyear-ref")).toBe(1);
  });
});

describe("_lib — parseObjectIdString", () => {
  test("to'g'ri 24-hex qatorni ObjectId'ga aylantiradi", () => {
    const id = parseObjectIdString("64f1a2b3c4d5e6f7a8b9c0d1");
    expect(id).not.toBeNull();
    expect(String(id)).toBe("64f1a2b3c4d5e6f7a8b9c0d1");
  });

  test("bosh-oxiridagi bo'shliqni tozalab qabul qiladi", () => {
    const id = parseObjectIdString("  64f1a2b3c4d5e6f7a8b9c0d1  ");
    expect(id).not.toBeNull();
  });

  test("12-belgili qatorni RAD etadi (mashhur mongoose tuzog'i)", () => {
    expect(parseObjectIdString("abcdefghijkl")).toBeNull();
  });

  test("null/undefined/raqam RAD etiladi", () => {
    expect(parseObjectIdString(null)).toBeNull();
    expect(parseObjectIdString(undefined)).toBeNull();
    expect(parseObjectIdString(123)).toBeNull();
  });

  test("bo'sh yoki noto'g'ri uzunlikdagi qator RAD etiladi", () => {
    expect(parseObjectIdString("")).toBeNull();
    expect(parseObjectIdString("64f1a2b3")).toBeNull();
  });

  test("hex bo'lmagan belgili 24-uzunlik RAD etiladi", () => {
    expect(parseObjectIdString("zzzzzzzzzzzzzzzzzzzzzzzz")).toBeNull();
  });
});
