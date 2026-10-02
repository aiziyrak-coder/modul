import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DepartmentBars from './index';

const ITEMS = [
  { id: 'a', label: 'Ichki kasalliklar propedevtikasi kafedrasi', value: 2 },
  { id: 'b', label: 'Klinik fanlar kafedrasi', value: 5 },
  { id: 'c', label: 'Mikrobiologiya, virusologiya va immunologiya kafedrasi', value: 2 },
  { id: 'd', label: 'Noorganik va analitik kimyo kafedrasi', value: 1 },
];

describe('DepartmentBars', () => {
  it("har kafedra nomi to'liq ko'rinadi va kamayish tartibida turadi", () => {
    render(<DepartmentBars title="Kafedra bo'yicha biriktirilmagan" items={ITEMS} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]!).getByText('Klinik fanlar kafedrasi')).toBeInTheDocument();
    expect(
      screen.getByText('Mikrobiologiya, virusologiya va immunologiya kafedrasi'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Kafedra bo'yicha biriktirilmagan" })).toBeInTheDocument();
  });

  it('bar kengligi maksimal qiymatga nisbatan foizda', () => {
    render(<DepartmentBars title="T" items={ITEMS} />);
    const bars = screen.getAllByTestId('department-bar');
    expect(bars[0]).toHaveStyle({ width: '100%' });
    expect(bars[1]).toHaveStyle({ width: '40%' });
    expect(bars[3]).toHaveStyle({ width: '20%' });
  });

  it("ro'yxat bo'sh bo'lsa — i18n bo'sh-holat matni, listitem yo'q", () => {
    render(<DepartmentBars title="T" items={[]} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText("Ma'lumot yo'q")).toBeInTheDocument();
  });
});
