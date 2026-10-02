const { deriveAttestationNote } = require("./attestationNote");

describe("deriveAttestationNote (ADR-038)", () => {
  test("summary yo'q / massiv emas — null", () => {
    expect(deriveAttestationNote(undefined)).toBeNull();
    expect(deriveAttestationNote(null)).toBeNull();
    expect(deriveAttestationNote({ note: "x" })).toBeNull();
    expect(deriveAttestationNote([])).toBeNull();
  });

  test("faqat bo'sh joydan iborat note — null", () => {
    expect(deriveAttestationNote([{ note: "   \n\t " }, { note: "" }])).toBeNull();
  });

  test("0-qator note null — birinchi bo'sh bo'lmagani olinadi (trim bilan)", () => {
    const summary = [
      { key: "T", title: "Nazariy", note: null },
      { key: "K", title: "Kanikul" },
      { key: "A", note: "  Ixtisoslik fanlaridan birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi  " },
      { key: "D", note: "ikkinchi" },
    ];
    expect(deriveAttestationNote(summary)).toBe(
      "Ixtisoslik fanlaridan birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi",
    );
  });

  test("500 belgidan uzun — 500 gacha kesiladi", () => {
    const out = deriveAttestationNote([{ note: "a".repeat(700) }]);
    expect(out).toHaveLength(500);
  });

  test("note satr emas (raqam) — o'tkazib yuboriladi", () => {
    expect(deriveAttestationNote([{ note: 42 }, { note: "ok" }])).toBe("ok");
  });
});
