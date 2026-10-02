import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SmallUpload } from './small-upload';

const file = (name: string, type = '') => new File(['x'], name, { type });

const drop = (el: HTMLElement, files: File[]) =>
  fireEvent.drop(el, { dataTransfer: { files } });

describe('SmallUpload — klaviatura (D-37)', () => {
  it('🔴 tugma sifatida e\u2019lon qilinadi va fokuslanadi', () => {
    render(<SmallUpload placeholder="Fayl tanlash" />);
    const btn = screen.getByRole('button', { name: 'Fayl tanlash' });
    expect(btn.getAttribute('tabindex')).toBe('0');
  });

  it('🔴 Enter va Space pikerni ochadi', () => {
    render(<SmallUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('o\u2018chirilgan holat tab tartibidan chiqadi', () => {
    render(<SmallUpload disabled />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('tabindex')).toBe('-1');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('nom fayl tanlangach ham YO\u2018QOLMAYDI — to\u2018liq nom o\u2018qiladi', () => {
    const long = `/files/${'a'.repeat(60)}.xlsx`;
    render(<SmallUpload value={long} placeholder="Fayl tanlash" />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('a'.repeat(60));
  });
});

describe('SmallUpload — piker BIR marta ochiladi', () => {
  it('🔴 oddiy klik — pikerni bir marta ochadi', () => {
    render(<SmallUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button'));
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('SmallUpload — drag & drop (D-38)', () => {
  it('🔴 tashlangan fayl QABUL qilinadi', () => {
    const onFileSelect = vi.fn();
    render(<SmallUpload onFileSelect={onFileSelect} />);
    const f = file('hisobot.pdf', 'application/pdf');
    drop(screen.getByRole('button'), [f]);
    expect(onFileSelect).toHaveBeenCalledWith(f);
  });

  it('🔴 `dragOver` da `preventDefault` — busiz `drop` UMUMAN otilmaydi', () => {
    render(<SmallUpload onFileSelect={() => {}} />);
    const ev = new Event('dragover', { bubbles: true, cancelable: true });
    screen.getByRole('button').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('brauzer faylni yangi tabda ochib yubormaydi', () => {
    render(<SmallUpload onFileSelect={() => {}} />);
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: { files: [] } });
    screen.getByRole('button').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('🔴 `accept` ga MOS KELMAGAN fayl rad etiladi', () => {
    const onFileSelect = vi.fn();
    render(<SmallUpload accept=".xlsx" onFileSelect={onFileSelect} />);
    drop(screen.getByRole('button'), [file('hujjat.pdf', 'application/pdf')]);
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('`accept` uchala shaklda ham ishlaydi', () => {
    const cases: Array<[string, File, boolean]> = [
      ['.xlsx', file('r.xlsx'), true],
      ['image/png', file('r.png', 'image/png'), true],
      ['image/*', file('r.jpg', 'image/jpeg'), true],
      ['image/*', file('r.pdf', 'application/pdf'), false],
      ['.xlsx,.xls', file('r.xls'), true],
    ];
    for (const [accept, f, ok] of cases) {
      const onFileSelect = vi.fn();
      const { unmount } = render(<SmallUpload accept={accept} onFileSelect={onFileSelect} />);
      drop(screen.getByRole('button'), [f]);
      expect(onFileSelect.mock.calls.length, `${accept} ← ${f.name}`).toBe(ok ? 1 : 0);
      unmount();
    }
  });

  it('bir nechta fayl tashlansa faqat BIRINCHISI olinadi', () => {
    const onFileSelect = vi.fn();
    render(<SmallUpload onFileSelect={onFileSelect} />);
    drop(screen.getByRole('button'), [file('a.pdf'), file('b.pdf')]);
    expect(onFileSelect).toHaveBeenCalledTimes(1);
    const picked = onFileSelect.mock.calls[0]?.[0] as File | undefined;
    expect(picked?.name).toBe('a.pdf');
  });

  it('o\u2018chirilgan holatda drop e\u2019tiborsiz qoldiriladi', () => {
    const onFileSelect = vi.fn();
    render(<SmallUpload disabled onFileSelect={onFileSelect} />);
    drop(screen.getByRole('button'), [file('a.pdf')]);
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('🔴 «yuklab olish» rejimida drop qiymatni JIMGINA almashtirmaydi', () => {
    const onFileSelect = vi.fn();
    render(<SmallUpload value="/files/eski.pdf" download onFileSelect={onFileSelect} />);
    drop(screen.getByRole('button'), [file('yangi.pdf')]);
    expect(onFileSelect).not.toHaveBeenCalled();
  });
});
