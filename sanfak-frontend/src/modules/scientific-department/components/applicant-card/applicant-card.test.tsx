import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import ApplicantCard from './index';

describe('ApplicantCard', () => {
  it('ismni ko`rsatadi', () => {
    const { container } = render(<ApplicantCard name="Nazarov A.B." />);
    expect(container.textContent).toContain('Nazarov A.B.');
  });

  it('qo`shimcha satr berilsa chiqadi, berilmasa YO`Q', () => {
    const withSub = render(<ApplicantCard name="Nazarov A.B." subtitle="Jarrohlik · 3210200" />);
    expect(withSub.container.textContent).toContain('Jarrohlik · 3210200');
    withSub.unmount();

    const without = render(<ApplicantCard name="Nazarov A.B." />);
    expect(without.container.textContent).not.toContain('·');
  });

  it('`tone` faqat rangni o`zgartiradi — tuzilma bir xil qoladi', () => {
    const neutral = render(<ApplicantCard name="X" />);
    const neutralDivs = neutral.container.querySelectorAll('div').length;
    const neutralBg = (neutral.container.firstElementChild as HTMLElement).style.background;
    neutral.unmount();

    const success = render(<ApplicantCard name="X" tone="success" />);
    const successDivs = success.container.querySelectorAll('div').length;
    const successBg = (success.container.firstElementChild as HTMLElement).style.background;

    expect(successDivs).toBe(neutralDivs);
    expect(successBg).not.toBe(neutralBg);
    expect(successBg).toContain('--brand-primary');
  });

  it('ranglar dizayn token`laridan (hardcode yo`q)', () => {
    const { container } = render(<ApplicantCard name="X" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.background).toContain('var(--');
    expect(el.style.border).toContain('var(--');
    expect(el.style.borderRadius).toContain('var(--');
  });
});
