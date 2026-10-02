import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_ACCEPT_EXTENSIONS,
  ATTACHMENT_LIMITS,
  attachmentEmoji,
  fileExtension,
  formatFileSize,
  isPreviewable,
  validateAttachmentFile,
} from './announcement-types';
import type { Attachment } from './announcement-types';

const MB = 1024 * 1024;

const makeFile = (name: string, size: number): File => {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const emptyContext = { existingCount: 0, existingBytes: 0, pendingBytes: 0 };

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [250 * 1024, '250 KB'],
    [MB, '1.0 MB'],
    [2.5 * MB, '2.5 MB'],
  ])('%i bayt → %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });

  it('yaroqsiz qiymatda "—" qaytaradi', () => {
    expect(formatFileSize(Number.NaN)).toBe('—');
    expect(formatFileSize(-5)).toBe('—');
  });
});

describe('fileExtension', () => {
  it.each([
    ['buyruq.pdf', 'pdf'],
    ['ARXIV.ZIP', 'zip'],
    ['ikki.nuqtali.docx', 'docx'],
    ['kengaytmasiz', ''],
  ])('%s → "%s"', (name, expected) => {
    expect(fileExtension(name)).toBe(expected);
  });
});

describe('isPreviewable — SVG hech qachon ko‘rsatilmaydi', () => {
  const attachment = (type: string): Attachment => ({
    id: '1',
    name: `fayl.${type}`,
    size: '10 KB',
    type,
    bytes: 10240,
    mimeType: 'application/octet-stream',
    uploadedByName: null,
    uploadedAt: null,
  });

  it.each(['jpg', 'jpeg', 'png', 'webp', 'gif'])('%s — ko‘rsatiladi', (type) => {
    expect(isPreviewable(attachment(type))).toBe(true);
  });

  it('svg — KO‘RSATILMAYDI (XML/skript bo‘lishi mumkin)', () => {
    expect(isPreviewable(attachment('svg'))).toBe(false);
  });

  it.each(['pdf', 'docx', 'zip', 'txt'])('%s — ko‘rsatilmaydi', (type) => {
    expect(isPreviewable(attachment(type))).toBe(false);
  });
});

describe('attachmentEmoji', () => {
  it('ma’lum turlarga mos ikonka beradi', () => {
    expect(attachmentEmoji('pdf')).toBe('📕');
    expect(attachmentEmoji('XLSX')).toBe('📗');
    expect(attachmentEmoji('zip')).toBe('🗜️');
  });

  it('noma’lum turga umumiy skrepka beradi', () => {
    expect(attachmentEmoji('qqq')).toBe('📎');
  });
});

describe('ATTACHMENT_ACCEPT', () => {
  it('`accept` atributi barcha kengaytmalarni qamrab oladi', () => {
    expect(ATTACHMENT_ACCEPT.split(',')).toEqual([...ATTACHMENT_ACCEPT_EXTENSIONS]);
  });

  it('backend ro‘yxati bilan bir xil — 22 ta kengaytma', () => {
    expect(ATTACHMENT_ACCEPT_EXTENSIONS).toHaveLength(22);
    expect(ATTACHMENT_ACCEPT_EXTENSIONS).toContain('.svg');
    expect(ATTACHMENT_ACCEPT_EXTENSIONS).not.toContain('.exe');
    expect(ATTACHMENT_ACCEPT_EXTENSIONS).not.toContain('.mp4');
  });
});

describe('validateAttachmentFile', () => {
  it('to‘g‘ri fayl o‘tadi', () => {
    expect(validateAttachmentFile(makeFile('buyruq.pdf', 2 * MB), emptyContext)).toBeNull();
  });

  it('ruxsat etilmagan kengaytmani rad etadi', () => {
    const msg = validateAttachmentFile(makeFile('virus.exe', 1024), emptyContext);
    expect(msg).toContain('qabul qilinmaydi');
  });

  it('bo‘sh faylni rad etadi', () => {
    expect(validateAttachmentFile(makeFile('bosh.pdf', 0), emptyContext)).toContain(
      'bo‘sh fayl',
    );
  });

  it('hajmi oshgan faylni rad etadi', () => {
    const big = makeFile('katta.pdf', ATTACHMENT_LIMITS.maxFileSize + 1);
    expect(validateAttachmentFile(big, emptyContext)).toContain('oshmasligi kerak');
  });

  it('fayllar soni chegarasiga yetganda rad etadi', () => {
    const msg = validateAttachmentFile(makeFile('yana.pdf', 1024), {
      ...emptyContext,
      existingCount: ATTACHMENT_LIMITS.maxFiles,
    });
    expect(msg).toContain(`${ATTACHMENT_LIMITS.maxFiles} ta fayl`);
  });

  it('umumiy hajm chegarasidan oshganda rad etadi', () => {
    const msg = validateAttachmentFile(makeFile('yana.pdf', 10 * MB), {
      existingCount: 1,
      existingBytes: ATTACHMENT_LIMITS.maxTotalSize - 5 * MB,
      pendingBytes: 0,
    });
    expect(msg).toContain('Umumiy hajm');
  });

  it('navbatdagi (hali yuklanmagan) fayllar ham umumiy hajmga qo‘shiladi', () => {
    const file = makeFile('yana.pdf', 10 * MB);
    expect(validateAttachmentFile(file, emptyContext)).toBeNull();
    expect(
      validateAttachmentFile(file, {
        existingCount: 1,
        existingBytes: 0,
        pendingBytes: ATTACHMENT_LIMITS.maxTotalSize - 5 * MB,
      }),
    ).toContain('Umumiy hajm');
  });
});
