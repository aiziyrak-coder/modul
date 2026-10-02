import { describe, it, expect } from 'vitest';
import { liveTitle, titleOrSnapshot, codeOrSnapshot, nameOrSnapshot } from './ref-title';

describe('titleOrSnapshot — ustuvorlik (MD-40)', () => {
  it("havola TIRIK bo'lsa uning HOZIRGI nomi olinadi", () => {
    expect(titleOrSnapshot({ title: 'Nefrologiya' }, 'UI-Test Nefrologiya')).toBe('Nefrologiya');
  });

  it("havola populate QILINMAGAN bo'lsa snapshot ishlaydi", () => {
    expect(titleOrSnapshot('6a5a0acbd34b3c21a575d59d', 'Nefrologiya')).toBe('Nefrologiya');
  });

  it("havola YO'Q bo'lsa (o'chirilgan) snapshot ishlaydi", () => {
    expect(titleOrSnapshot(null, 'Eski mutaxassislik')).toBe('Eski mutaxassislik');
    expect(titleOrSnapshot(undefined, 'Eski mutaxassislik')).toBe('Eski mutaxassislik');
  });

  it("ikkalasi ham yo'q -> null", () => {
    expect(titleOrSnapshot(null, null)).toBeNull();
    expect(titleOrSnapshot(null, undefined)).toBeNull();
  });

  it("`name` maydonli havola ham qo'llab-quvvatlanadi (guruh/kafedra)", () => {
    expect(titleOrSnapshot({ name: '1-guruh' }, 'eski')).toBe('1-guruh');
  });

  it("populate qilingan, lekin nomi BO'SH -> snapshotga tushadi", () => {
    expect(titleOrSnapshot({ title: null }, 'Nefrologiya')).toBe('Nefrologiya');
  });
});

describe('liveTitle', () => {
  it('faqat obyektdan nom oladi', () => {
    expect(liveTitle({ title: 'A' })).toBe('A');
    expect(liveTitle({ name: 'B' })).toBe('B');
    expect(liveTitle('id-satri')).toBeNull();
    expect(liveTitle(null)).toBeNull();
  });
});

describe('codeOrSnapshot', () => {
  it('jonli kod birinchi', () => {
    expect(codeOrSnapshot({ code: '70910101' }, '00000000')).toBe('70910101');
  });
  it("populate yo'q -> snapshot", () => {
    expect(codeOrSnapshot('id-satri', '00000000')).toBe('00000000');
  });
  it("ikkalasi ham yo'q -> null", () => {
    expect(codeOrSnapshot(null, null)).toBeNull();
  });
});

describe('nameOrSnapshot — ism uchun alohida qoida', () => {
  it("backend `select` da sharif bo'lmasa snapshot saqlanadi", () => {
    expect(nameOrSnapshot('Sobirov Jasur', 'Sobirov Jasur Nodirovich')).toBe(
      'Sobirov Jasur Nodirovich',
    );
  });

  it('HAQIQIY nom o‘zgarishida jonli nom g‘olib (snapshot eskirgan)', () => {
    expect(nameOrSnapshot('Nodirov Jasur', 'Sobirov Jasur Nodirovich')).toBe('Nodirov Jasur');
  });

  it("jonli nom BOYROQ bo'lsa u g'olib (piker yorlig'i emas)", () => {
    expect(nameOrSnapshot('Aliyev Sardor Botir o‘g‘li', 'Aliyev Sardor')).toBe(
      'Aliyev Sardor Botir o‘g‘li',
    );
  });

  it('backend `select` ga `middleName` qo‘shilgach qoida jonliga o‘tadi', () => {
    expect(nameOrSnapshot('Sobirov Jasur Nodirovich', 'Sobirov Jasur Nodirovich')).toBe(
      'Sobirov Jasur Nodirovich',
    );
  });

  it("populate qilinmagan bo'lsa snapshot ishlaydi", () => {
    expect(nameOrSnapshot(null, 'Sobirov Jasur Nodirovich')).toBe('Sobirov Jasur Nodirovich');
  });

  it("snapshot yo'q bo'lsa jonli nom ishlaydi", () => {
    expect(nameOrSnapshot('Sobirov Jasur', null)).toBe('Sobirov Jasur');
  });

  it("ikkalasi ham yo'q -> null", () => {
    expect(nameOrSnapshot(null, null)).toBeNull();
    expect(nameOrSnapshot('', '')).toBeNull();
  });

  it("so'z chegarasi hisobga olinadi (tasodifiy prefiks emas)", () => {
    expect(nameOrSnapshot('Aliyev Sar', 'Aliyev Sardor')).toBe('Aliyev Sar');
  });
});
