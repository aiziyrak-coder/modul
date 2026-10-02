const { computeChangedFields } = require("./changedFields");

describe("computeChangedFields — sodda maydonlar", () => {
  test("maydon o'zgardi -> ro'yxatda", () => {
    const out = computeChangedFields(
      { faculty: "old-id" },
      { faculty: "new-id" },
    );
    expect(out).toEqual(["faculty"]);
  });

  test("maydon o'zgarmadi -> ro'yxatda yo'q", () => {
    const out = computeChangedFields(
      { faculty: "same-id" },
      { faculty: "same-id" },
    );
    expect(out).toEqual([]);
  });

  test("`updateData`da yo'q maydon natijaga tushmaydi", () => {
    const out = computeChangedFields(
      { faculty: "old-id", position: "pos-1" },
      { position: "pos-2" },
    );
    expect(out).toEqual(["position"]);
  });
});

describe("computeChangedFields — normallashtirilgan solishtirish", () => {
  test("ObjectId va string bir xil deb qaraladi", () => {
    const fakeObjectId = {
      toString: () => "507f1f77bcf86cd799439011",
    };
    const out = computeChangedFields(
      { department: fakeObjectId },
      { department: "507f1f77bcf86cd799439011" },
    );
    expect(out).toEqual([]);
  });

  test("Date va ISO string bir xil deb qaraladi", () => {
    const out = computeChangedFields(
      { birthDate: new Date("1990-01-01T00:00:00.000Z") },
      { birthDate: "1990-01-01T00:00:00.000Z" },
    );
    expect(out).toEqual([]);
  });

  test("null, undefined, '' bir-biriga teng", () => {
    expect(computeChangedFields({ hIndex: null }, { hIndex: "" })).toEqual([]);
    expect(
      computeChangedFields({ hIndex: undefined }, { hIndex: null }),
    ).toEqual([]);
    expect(computeChangedFields({ hIndex: "" }, { hIndex: undefined })).toEqual(
      [],
    );
  });

  test("bo'shdan qiymatga o'tish -> o'zgargan hisoblanadi", () => {
    const out = computeChangedFields({ hIndex: null }, { hIndex: 5 });
    expect(out).toEqual(["hIndex"]);
  });
});

describe("computeChangedFields — ichma-ich obyekt", () => {
  test("nested obyekt maydoni -> nuqtali yo'l", () => {
    const out = computeChangedFields(
      { address: { region: "Farg'ona", district: "Marg'ilon" } },
      { address: { region: "Toshkent", district: "Marg'ilon" } },
    );
    expect(out).toEqual(["address.region"]);
  });

  test("nested obyektda hech narsa o'zgarmasa -> bo'sh", () => {
    const out = computeChangedFields(
      { contactInfo: { phone: "+998901234567", email: "a@b.com" } },
      { contactInfo: { phone: "+998901234567", email: "a@b.com" } },
    );
    expect(out).toEqual([]);
  });

  test("eski nested obyekt yo'q bo'lsa ham ishlaydi", () => {
    const out = computeChangedFields(
      {},
      { address: { region: "Toshkent" } },
    );
    expect(out).toEqual(["address.region"]);
  });
});

describe("computeChangedFields — massiv (education)", () => {
  test("massiv ichidagi maydon o'zgardi -> indeks bilan yo'l", () => {
    const out = computeChangedFields(
      { education: [{ institution: "TATU", specialty: "IT" }] },
      { education: [{ institution: "TDTU", specialty: "IT" }] },
    );
    expect(out).toEqual(["education.0.institution"]);
  });

  test("massivga element qo'shildi -> yangi element to'liq yo'llari", () => {
    const out = computeChangedFields(
      { education: [{ institution: "TATU", specialty: "IT" }] },
      {
        education: [
          { institution: "TATU", specialty: "IT" },
          { institution: "TDTU", specialty: "Matematika" },
        ],
      },
    );
    expect(out.sort()).toEqual(
      ["education.1.institution", "education.1.specialty"].sort(),
    );
  });

  test("massivdan element olib tashlandi -> indeks bilan belgilanadi", () => {
    const out = computeChangedFields(
      {
        education: [
          { institution: "TATU", specialty: "IT" },
          { institution: "TDTU", specialty: "Matematika" },
        ],
      },
      { education: [{ institution: "TATU", specialty: "IT" }] },
    );
    expect(out).toEqual(["education.1"]);
  });

  test("massiv o'zgarmasa -> bo'sh", () => {
    const arr = [{ institution: "TATU", specialty: "IT" }];
    const out = computeChangedFields({ education: arr }, { education: arr });
    expect(out).toEqual([]);
  });
});

describe("computeChangedFields — natija shakli", () => {
  test("unique va tartiblangan", () => {
    const out = computeChangedFields(
      { faculty: "a", position: "b", employmentType: "c" },
      { faculty: "x", position: "y", employmentType: "z" },
    );
    expect(out).toEqual([...out].sort());
    expect(new Set(out).size).toBe(out.length);
  });

  test("updateData yo'q/noto'g'ri turdagi bo'lsa -> bo'sh massiv", () => {
    expect(computeChangedFields({ a: 1 }, null)).toEqual([]);
    expect(computeChangedFields({ a: 1 }, undefined)).toEqual([]);
  });

  test("existingDoc yo'q bo'lsa ham yiqilmaydi (yangi hujjat holati)", () => {
    const out = computeChangedFields(null, { faculty: "x" });
    expect(out).toEqual(["faculty"]);
  });

  test("mongoose hujjati (`.toObject()` bilan) ham ishlaydi", () => {
    const plain = { faculty: "old" };
    const doc = { toObject: () => plain };
    const out = computeChangedFields(doc, { faculty: "new" });
    expect(out).toEqual(["faculty"]);
  });
});
