import { describe, expect, it } from 'vitest';
import { DEFAULT_LIST_VIEW, listReturnPath, parseListView, toListSearch } from './expulsion-list-search';

const LIST = '/residency/chetlatish-buyruqlari';
const parse = (qs: string) => parseListView(new URLSearchParams(qs));

describe('parseListView', () => {
  it('bo‘sh URL — standart: loyiha, manbasiz, 1-sahifa', () => {
    expect(parse('')).toEqual({ tab: 'loyiha', origin: '', page: 1 });
    expect(parse('')).toEqual(DEFAULT_LIST_VIEW);
  });

  it('to‘g‘ri qiymatlar o‘qiladi', () => {
    expect(parse('status=imzolangan&origin=meros&page=3')).toEqual({ tab: 'imzolangan', origin: 'meros', page: 3 });
    expect(parse('status=all')).toEqual({ tab: 'all', origin: '', page: 1 });
    expect(parse('status=bekor_qilingan&origin=tizim')).toEqual({ tab: 'bekor_qilingan', origin: 'tizim', page: 1 });
  });

  it('noma‘lum holat/manba — standart', () => {
    expect(parse('status=chetlatilgan&origin=boshqa')).toEqual(DEFAULT_LIST_VIEW);
    expect(parse('status=&origin=')).toEqual(DEFAULT_LIST_VIEW);
  });

  it.each(['0', '-1', 'abc', '1.5', '01', '999999', ''])('buzuq sahifa %j — 1', (page) => {
    expect(parse(`page=${page}`).page).toBe(1);
  });
});

describe('toListSearch', () => {
  it('standart qiymatlar URL‘ga yozilmaydi', () => {
    expect(toListSearch(DEFAULT_LIST_VIEW).toString()).toBe('');
  });

  it('faqat standartdan farqli kalitlar', () => {
    expect(toListSearch({ tab: 'imzolangan', origin: 'meros', page: 3 }).toString()).toBe(
      'status=imzolangan&origin=meros&page=3',
    );
    expect(toListSearch({ tab: 'all', origin: '', page: 1 }).toString()).toBe('status=all');
    expect(toListSearch({ tab: 'loyiha', origin: '', page: 2 }).toString()).toBe('page=2');
  });

  it('aylanma: parse(toListSearch(v)) === v', () => {
    const view = { tab: 'rad_etilgan' as const, origin: 'tizim' as const, page: 7 };
    expect(parseListView(toListSearch(view))).toEqual(view);
  });
});

describe('listReturnPath — tafsilotdan ro‘yxatga qaytish', () => {
  it('state yo‘q yoki shakli boshqa — oddiy ro‘yxat yo‘li', () => {
    expect(listReturnPath(LIST, null)).toBe(LIST);
    expect(listReturnPath(LIST, undefined)).toBe(LIST);
    expect(listReturnPath(LIST, 'status=imzolangan')).toBe(LIST);
    expect(listReturnPath(LIST, { listSearch: 5 })).toBe(LIST);
  });

  it('ro‘yxat holati saqlanadi', () => {
    expect(listReturnPath(LIST, { listSearch: 'status=imzolangan&page=3' })).toBe(`${LIST}?status=imzolangan&page=3`);
  });

  it('begona kalit va buzuq qiymat tashlanadi — yo‘l doim ro‘yxat', () => {
    expect(listReturnPath(LIST, { listSearch: 'next=//evil.example&status=x&page=abc' })).toBe(LIST);
    expect(listReturnPath(LIST, { listSearch: 'origin=meros&next=/admin' })).toBe(`${LIST}?origin=meros`);
  });
});
