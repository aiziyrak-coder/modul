import { describe, expect, test } from 'vitest';
import { autoChatPartner, UNKNOWN_PARTNER } from './chatPartner';

const USTOZ = { id: 'u-ustoz', name: 'Nazarov Dilshod' };

describe('autoChatPartner — talabaga suhbat o‘zi ochiladi', () => {
  test('biriktirilgan ustoz bo‘lsa — o‘sha tanlanadi', () => {
    expect(autoChatPartner(true, null, [USTOZ], [])).toEqual(USTOZ);
  });

  test('ustoz hali yuklanmagan — mavjud suhbatning birinchisi olinadi', () => {
    const conv = [{ userId: 'u-9', user: { name: 'Karimova Zilola' } }];
    expect(autoChatPartner(true, null, [], conv)).toEqual({
      id: 'u-9',
      name: 'Karimova Zilola',
    });
  });

  test('suhbatdosh nomi bo‘sh bo‘lsa — o‘rin bosar matn', () => {
    const conv = [{ userId: 'u-9', user: { name: null } }];
    expect(autoChatPartner(true, null, [], conv)?.name).toBe(UNKNOWN_PARTNER);
  });

  test('ustoz ham, suhbat ham yo‘q — null (bo‘sh holat ko‘rinadi)', () => {
    expect(autoChatPartner(true, null, [], [])).toBeNull();
  });

  test('ustoz suhbatdan USTUN — talaba o‘z rahbariga tushadi', () => {
    const conv = [{ userId: 'u-boshqa', user: { name: 'Boshqa odam' } }];
    expect(autoChatPartner(true, null, [USTOZ], conv)).toEqual(USTOZ);
  });
});

describe('autoChatPartner — aralashmaydigan holatlar', () => {
  test('foydalanuvchi allaqachon tanlagan bo‘lsa — tegilmaydi', () => {
    const picked = { id: 'u-1', name: 'Tanlangan' };
    expect(autoChatPartner(true, picked, [USTOZ], [])).toBeNull();
  });

  test('USTOZ rolida avto-tanlov YO‘Q — bir nechta talabasi bor', () => {
    const talabalar = [
      { id: 'u-a', name: 'Talaba A' },
      { id: 'u-b', name: 'Talaba B' },
    ];
    expect(autoChatPartner(false, null, talabalar, [])).toBeNull();
  });

  test('ustozda bitta talaba bo‘lsa ham avto-tanlanmaydi', () => {
    expect(autoChatPartner(false, null, [{ id: 'u-a', name: 'Talaba A' }], [])).toBeNull();
  });
});
