import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import FeedPager from './index';

const renderPager = (loading?: boolean) =>
  render(
    <FeedPager page={2} pageSize={12} total={40} loading={loading} onChange={() => {}}>
      <div>ro&apos;yxat</div>
    </FeedPager>,
  );

describe('FeedPager loader', () => {
  it('`loading` berilganda spinner BOR', () => {
    const { container } = renderPager(true);

    expect(container.querySelector('.ant-spin-spinning')).not.toBeNull();
  });

  it('`loading` bo`lmasa spinner YO`Q (kontent tinch turadi)', () => {
    const { container } = renderPager(false);

    expect(container.querySelector('.ant-spin-spinning')).toBeNull();
    expect(container.textContent).toContain("ro'yxat");
  });

  it('yuklanayotganda ham eski kontent ko`rinib turadi (sakramaydi)', () => {
    const { container } = renderPager(true);

    expect(container.textContent).toContain("ro'yxat");
  });

  it('paginatsiya paneli yuklanayotganda ham joyida (bar yo`qolmaydi)', () => {
    const { container } = renderPager(true);

    expect(container.querySelector('.ant-pagination')).not.toBeNull();
  });
});
