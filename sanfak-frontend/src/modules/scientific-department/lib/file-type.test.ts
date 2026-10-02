import { describe, expect, it } from 'vitest';
import { fileExt, fileTagColor } from './file-type';

describe('fileExt', () => {
  it('oddiy nomdan kengaytmani oladi', () => {
    expect(fileExt('shablon.pdf')).toBe('pdf');
    expect(fileExt('hisobot.DOCX')).toBe('docx');
  });

  it('URL va imzo paramlarini tashlaydi', () => {
    expect(fileExt('http://x.uz/files/pdfs/MN00004.pdf?t=abc&e=123')).toBe('pdf');
    expect(fileExt('/files/docs/reja.docx#page=2')).toBe('docx');
  });

  it('kengaytmasiz va bo‘sh qiymatda bo‘sh qaytaradi', () => {
    expect(fileExt('REJA')).toBe('');
    expect(fileExt('')).toBe('');
    expect(fileExt(null)).toBe('');
    expect(fileExt(undefined)).toBe('');
  });

  it('nuqtali papka nomi chalg‘itmaydi', () => {
    expect(fileExt('/files/v1.2/reja.pdf')).toBe('pdf');
  });
});

describe('fileTagColor', () => {
  it('tur bo‘yicha rang beradi', () => {
    expect(fileTagColor('a.pdf')).toBe('error');
    expect(fileTagColor('a.docx')).toBe('blue');
    expect(fileTagColor('a.xlsx')).toBe('green');
    expect(fileTagColor('a.png')).toBe('gold');
  });

  it('taqdimot — to‘q sariq (Word emas)', () => {
    expect(fileTagColor('taqdimot.ppt')).toBe('orange');
    expect(fileTagColor('taqdimot.pptx')).toBe('orange');
  });

  it('noma’lum kengaytma — neytral', () => {
    expect(fileTagColor('a.zip')).toBe('default');
    expect(fileTagColor(null)).toBe('default');
  });
});
