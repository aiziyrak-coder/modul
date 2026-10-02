import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import TabLabel from './index';

describe('TabLabel', () => {
  it('matnni har doim ko`rsatadi', () => {
    const { container } = render(<TabLabel text="2. E-imzolar" done={false} />);
    expect(container.textContent).toContain('2. E-imzolar');
  });

  it('tugagan bosqichda belgi BOR', () => {
    const { container } = render(<TabLabel text="2. E-imzolar" done />);
    expect(container.querySelector('.anticon-check-circle')).not.toBeNull();
  });

  it('tugamagan bosqichda belgi YO`Q', () => {
    const { container } = render(<TabLabel text="3. SSV" done={false} />);
    expect(container.querySelector('.anticon-check-circle')).toBeNull();
  });

  it('belgi ekran o`quvchidan yashiriladi (matn o`zi ma`noni beradi)', () => {
    const { container } = render(<TabLabel text="1. Fayllar" done />);
    const icon = container.querySelector('.anticon-check-circle');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});
