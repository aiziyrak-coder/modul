import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBackTo } from './use-back-to';

const navigate = vi.fn();
let key = 'abc123';

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ key }),
}));

beforeEach(() => {
  navigate.mockClear();
});

describe('useBackTo', () => {
  it('tarix bo`lsa — ORTGA qaytadi (qayerdan kelgan bo`lsa o`sha yerga)', () => {
    key = 'abc123';
    const { result } = renderHook(() => useBackTo('/scientific-department/articles'));
    result.current();

    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('to`g`ridan-to`g`ri kirilgan bo`lsa — fallback ro`yxatga', () => {
    key = 'default';
    const { result } = renderHook(() => useBackTo('/scientific-department/articles'));
    result.current();

    expect(navigate).toHaveBeenCalledWith('/scientific-department/articles');
    expect(navigate).not.toHaveBeenCalledWith(-1);
  });

  it('fallback har sahifada O`ZINIKI bo`ladi', () => {
    key = 'default';
    const { result } = renderHook(() => useBackTo('/scientific-department/theses'));
    result.current();

    expect(navigate).toHaveBeenCalledWith('/scientific-department/theses');
  });
});
