import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ModalActions, ModalFooter } from './modal-footer';
import { useModalStore } from './modal-store';

describe('ModalFooter', () => {
  beforeEach(() => {
    useModalStore.setState({ show: true, animating: true });
  });

  it('ikki tugma chiqaradi: avval bekor, keyin tasdiq', () => {
    const { container } = render(<ModalFooter cancelLabel="Bekor" confirmLabel="Saqlash" />);
    const btns = container.querySelectorAll('button');
    expect(btns).toHaveLength(2);
    expect(btns[0]?.textContent).toContain('Bekor');
    expect(btns[1]?.textContent).toContain('Saqlash');
  });

  it('bekor tugmasi link roli, tasdiq tugmasi primary', () => {
    const { container } = render(<ModalFooter />);
    const btns = container.querySelectorAll('button');
    expect(btns[0]?.className).toContain('ant-btn-link');
    expect(btns[1]?.className).toContain('ant-btn-primary');
  });

  it('`danger` faqat tasdiq tugmasini qizil qiladi', () => {
    const { container } = render(<ModalFooter danger />);
    const btns = container.querySelectorAll('button');
    expect(btns[0]?.className).not.toContain('ant-btn-dangerous');
    expect(btns[1]?.className).toContain('ant-btn-dangerous');
  });

  it('bekor bosilsa modal yopiladi (default xatti-harakat)', () => {
    const { container } = render(<ModalFooter />);
    fireEvent.click(container.querySelectorAll('button')[0] as HTMLElement);
    expect(useModalStore.getState().animating).toBe(false);
  });

  it('`onCancel` berilsa `hideModal` o`rniga u chaqiriladi', () => {
    const onCancel = vi.fn();
    const { container } = render(<ModalFooter onCancel={onCancel} />);
    fireEvent.click(container.querySelectorAll('button')[0] as HTMLElement);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(useModalStore.getState().animating).toBe(true);
  });

  it('`loading` bekor tugmasini ham bloklaydi', () => {
    const onCancel = vi.fn();
    const { container } = render(<ModalFooter loading onCancel={onCancel} />);
    const cancel = container.querySelectorAll('button')[0] as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    fireEvent.click(cancel);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('`confirmDisabled` faqat tasdiqni bloklaydi', () => {
    const { container } = render(<ModalFooter confirmDisabled />);
    const btns = container.querySelectorAll('button');
    expect((btns[0] as HTMLButtonElement).disabled).toBe(false);
    expect((btns[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('`submit` bo`lmasa tugma formani yubormaydi (type="button")', () => {
    const { container } = render(<ModalFooter />);
    expect((container.querySelectorAll('button')[1] as HTMLButtonElement).type).toBe('button');
  });

  it('`submit` berilsa tugma formani yuboradi (type="submit")', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const { container } = render(
      <form onSubmit={onSubmit}>
        <ModalFooter submit />
      </form>,
    );
    const confirm = container.querySelectorAll('button')[1] as HTMLButtonElement;
    expect(confirm.type).toBe('submit');
    fireEvent.click(confirm);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

function gridColumnRules(): string[] {
  return Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((r) => r.cssText);
      } catch {
        return [];
      }
    })
    .filter((r) => r.includes('grid-template-columns'));
}

describe('ModalActions', () => {
  beforeEach(() => {
    useModalStore.setState({ show: true, animating: true });
  });

  it('ustunlar soni amallar soniga teng', () => {
    render(<ModalActions actions={[{ label: 'Yopish' }]} />);
    expect(gridColumnRules().some((r) => /grid-template-columns:\s*repeat\(1, ?1fr\)/.test(r)))
      .toBe(true);

    render(
      <ModalActions
        actions={[{ label: 'Yopish' }, { label: 'Rad etish' }, { label: 'Tasdiqlash' }]}
      />,
    );
    expect(gridColumnRules().some((r) => /grid-template-columns:\s*repeat\(3, ?1fr\)/.test(r)))
      .toBe(true);
  });

  it('rollarni to`g`ri tugma turiga xaritalaydi', () => {
    const { container } = render(
      <ModalActions
        actions={[
          { label: 'Yopish' },
          { label: 'Rad etish', variant: 'danger' },
          { label: 'Tasdiqlash', variant: 'primary' },
        ]}
      />,
    );
    const b = container.querySelectorAll('button');
    expect(b[0]?.className).toContain('ant-btn-link');
    expect(b[1]?.className).toContain('ant-btn-dangerous');
    expect(b[2]?.className).toContain('ant-btn-primary');
    expect(b[2]?.className).not.toContain('ant-btn-dangerous');
  });

  it('tartibni saqlaydi va har amal o`z handlerini chaqiradi', () => {
    const close = vi.fn();
    const reject = vi.fn();
    const approve = vi.fn();
    const { container } = render(
      <ModalActions
        actions={[
          { label: 'Yopish', onClick: close },
          { label: 'Rad etish', variant: 'danger', onClick: reject },
          { label: 'Tasdiqlash', variant: 'primary', onClick: approve },
        ]}
      />,
    );
    const b = [...container.querySelectorAll('button')];
    expect(b.map((x) => x.textContent?.trim())).toEqual(['Yopish', 'Rad etish', 'Tasdiqlash']);
    fireEvent.click(b[1] as HTMLElement);
    expect(reject).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
  });

  it('ro`yxatdan chiqarilgan amal grid ustunini ham olib tashlaydi', () => {
    const canApprove = false;
    const { container } = render(
      <ModalActions
        actions={[
          { label: 'Yopish' },
          ...(canApprove ? [{ label: 'Tasdiqlash', variant: 'primary' as const }] : []),
        ]}
      />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(gridColumnRules().some((r) => /grid-template-columns:\s*repeat\(1, ?1fr\)/.test(r)))
      .toBe(true);
  });
});
