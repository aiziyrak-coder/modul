import { describe, expect, it } from 'vitest';
import { mapArticle, mapMethodical, mapMonograph, mapThesis } from './my-scientific-works-api';

describe('my-scientific-works-api mapper — _id → id', () => {
  it('mapArticle _id ni id ga aylantiradi va statusni saqlaydi', () => {
    const item = mapArticle({
      _id: 'a1',
      title: 'Maqola sarlavhasi',
      journalName: 'Some Journal',
      status: 'approved',
      fileUrl: 'https://files/a1.pdf',
    });
    expect(item.id).toBe('a1');
    expect(item.title).toBe('Maqola sarlavhasi');
    expect(item.status).toBe('approved');
    expect(item.fileUrl).toBe('https://files/a1.pdf');
  });

  it('mapThesis _id ni id ga aylantiradi', () => {
    const item = mapThesis({ _id: 't1', title: 'Tezis nomi', status: 'pending', fileUrl: null });
    expect(item.id).toBe('t1');
    expect(item.status).toBe('pending');
  });

  it('mapMonograph _id ni id ga aylantiradi', () => {
    const item = mapMonograph({ _id: 'm1', title: 'Monografiya', status: 'rejected' });
    expect(item.id).toBe('m1');
  });

  it('mapMethodical _id ni id ga aylantiradi', () => {
    const item = mapMethodical({ _id: 'me1', title: 'Tavsiyanoma', status: 'new' });
    expect(item.id).toBe('me1');
  });
});

describe('my-scientific-works-api mapper — nom fallback (article: title bo`sh → journalName)', () => {
  it("title bo'lsa — o'shani ishlatadi", () => {
    const item = mapArticle({
      _id: 'a2',
      title: 'Aniq sarlavha',
      journalName: 'Fallback Journal',
      status: 'new',
      fileUrl: null,
    });
    expect(item.title).toBe('Aniq sarlavha');
  });

  it("title null bo'lsa — journalName'ga fallback qiladi", () => {
    const item = mapArticle({
      _id: 'a3',
      title: null,
      journalName: 'Fallback Journal',
      status: 'new',
      fileUrl: null,
    });
    expect(item.title).toBe('Fallback Journal');
  });

  it("title bo'sh string bo'lsa — journalName'ga fallback qiladi", () => {
    const item = mapArticle({
      _id: 'a4',
      title: '',
      journalName: 'Fallback Journal',
      status: 'new',
      fileUrl: null,
    });
    expect(item.title).toBe('Fallback Journal');
  });
});

describe('my-scientific-works-api mapper — fileUrl (ko`p-faylli entitylarda doim null)', () => {
  it('mapArticle — fileUrl bo`lmasa null qaytaradi', () => {
    const item = mapArticle({ _id: 'a5', title: 'X', journalName: 'Y', status: 'new', fileUrl: undefined });
    expect(item.fileUrl).toBeNull();
  });

  it('mapMonograph — fileUrl har doim null (ko`p-faylli, detal sahifaga o`tiladi)', () => {
    const item = mapMonograph({ _id: 'm2', title: 'Monografiya 2', status: 'approved' });
    expect(item.fileUrl).toBeNull();
  });

  it('mapMethodical — fileUrl har doim null (ko`p-faylli, detal sahifaga o`tiladi)', () => {
    const item = mapMethodical({ _id: 'me2', title: 'Tavsiyanoma 2', status: 'approved' });
    expect(item.fileUrl).toBeNull();
  });
});
