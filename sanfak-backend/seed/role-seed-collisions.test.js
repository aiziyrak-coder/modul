const { loadAll } = require("./_role-seed-inventory");

function groupByRoleSection(grants) {
  const map = new Map();
  for (const g of grants) {
    const key = `${g.title}|${g.section}`;
    if (!map.has(key)) map.set(key, new Map());
    const bySource = map.get(key);
    if (!bySource.has(g.source)) bySource.set(g.source, new Set());
    g.actions.forEach((a) => bySource.get(g.source).add(a));
  }
  return map;
}

function findCollisions(grants) {
  const grouped = groupByRoleSection(grants);
  const collisions = [];
  for (const [key, bySource] of grouped) {
    if (bySource.size < 2) continue;
    const [role, section] = key.split("|");
    const bySourceSorted = [...bySource.entries()]
      .map(([source, set]) => ({ source, actions: [...set].sort() }))
      .sort((a, b) => a.source.localeCompare(b.source));
    const first = JSON.stringify(bySourceSorted[0].actions);
    const allSame = bySourceSorted.every((s) => JSON.stringify(s.actions) === first);
    if (!allSame) collisions.push({ role, section, bySource: bySourceSorted });
  }
  return collisions.sort((a, b) => `${a.role}|${a.section}`.localeCompare(`${b.role}|${b.section}`));
}

const { grants } = loadAll();
const collisions = findCollisions(grants);

const KNOWN_COLLISIONS = [];

describe("Rol seedlari bir-birining grantlarini qayta yozmaydi (kolliziya tekshiruvi)", () => {
  test("inventar bo'sh emas (sanity — manba fayllar to'g'ri yuklandi)", () => {
    expect(grants.length).toBeGreaterThan(50);
  });

  test("yangi, hujjatlanmagan (rol,section) kolliziya YO'Q", () => {
    const unexpected = collisions.filter(
      (c) => !KNOWN_COLLISIONS.some((k) => k.role === c.role && k.section === c.section),
    );
    if (unexpected.length) {
      // eslint-disable-next-line no-console
      console.error(
        "Kutilmagan kolliziya(lar):\n" +
          unexpected
            .map(
              (c) =>
                `  ${c.role}|${c.section}: ` +
                c.bySource.map((s) => `${s.source}=[${s.actions.join(",")}]`).join(" vs "),
            )
            .join("\n"),
      );
    }
    expect(unexpected).toEqual([]);
  });

  if (KNOWN_COLLISIONS.length > 0) {
    test.each(KNOWN_COLLISIONS)(
      "ma'lum kolliziya $role|$section hali ham mavjud (tuzatilsa shu qatorni ro'yxatdan o'chiring)",
      ({ role, section }) => {
        const found = collisions.find((c) => c.role === role && c.section === section);
        expect(found).toBeDefined();
      },
    );
  } else {
    test("KNOWN_COLLISIONS bo'sh — barcha ma'lum kolliziyalar tuzatilgan (P7)", () => {
      expect(KNOWN_COLLISIONS).toEqual([]);
    });
  }

  test("KNOWN_COLLISIONS dan tashqari HAMMA (rol,section) bir xil action to'plamiga ega", () => {
    const known = new Set(KNOWN_COLLISIONS.map((k) => `${k.role}|${k.section}`));
    const stillMismatched = collisions.filter((c) => !known.has(`${c.role}|${c.section}`));
    expect(stillMismatched).toEqual([]);
  });
});
