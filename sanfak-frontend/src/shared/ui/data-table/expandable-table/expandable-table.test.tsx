import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExpandableTable, type WithSubRows } from './index';

interface Row {
  name: string;
  hours: number;
}

const columns: ColumnDef<WithSubRows<Row>, unknown>[] = [
  { id: 'name', header: 'Nomi', cell: ({ row }) => row.original.name },
  { id: 'hours', header: 'Soat', cell: ({ row }) => row.original.hours },
];

const data: WithSubRows<Row>[] = [
  {
    name: 'Aliyev A.',
    hours: 450,
    subRows: [
      { name: 'Stomatologiyaga kirish', hours: 163 },
      { name: 'Gigiyena', hours: 120 },
    ],
  },
];

describe('ExpandableTable — ota qator (colSpan)', () => {
  it('`renderParentRow` BERILMASA — har ustun alohida katak (eski xatti-harakat)', () => {
    const { container } = render(<ExpandableTable data={data} columns={columns} />);
    const firstRow = container.querySelectorAll('tbody tr')[0] as HTMLElement;
    const cells = firstRow.querySelectorAll('td');
    expect(cells).toHaveLength(3);
    expect([...cells].some((c) => c.hasAttribute('colspan'))).toBe(false);
  });

  it('`renderParentRow` BERILSA — bitta katak, colSpan = barcha ustunlar', () => {
    const { container } = render(
      <ExpandableTable
        data={data}
        columns={columns}
        renderParentRow={(row) => <span>{row.original.name}</span>}
      />,
    );
    const firstRow = container.querySelectorAll('tbody tr')[0] as HTMLElement;
    const cells = firstRow.querySelectorAll('td');
    expect(cells).toHaveLength(1);
    expect(cells[0]?.getAttribute('colspan')).toBe('2');
    expect(cells[0]?.textContent).toBe('Aliyev A.');
  });

  it('`renderParentRow` rejimida "ochish" ustuni qo`shilmaydi', () => {
    const withParent = render(
      <ExpandableTable
        data={data}
        columns={columns}
        renderParentRow={(row) => <span>{row.original.name}</span>}
      />,
    );
    expect(withParent.container.querySelectorAll('thead th')).toHaveLength(2);
    withParent.unmount();

    const plain = render(<ExpandableTable data={data} columns={columns} />);
    expect(plain.container.querySelectorAll('thead th')).toHaveLength(3);
  });

  it('sub-row lar ustunlarga bo`linadi (ota qator rejimida ham)', () => {
    const { container } = render(
      <ExpandableTable
        data={data}
        columns={columns}
        renderParentRow={(row) => (
          <button type="button" onClick={row.getToggleExpandedHandler()}>
            och
          </button>
        )}
      />,
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);

    fireEvent.click(container.querySelector('tbody button') as HTMLElement);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rows[1]?.querySelectorAll('td')).toHaveLength(2);
    expect(rows[1]?.textContent).toContain('Stomatologiyaga kirish');
  });

  it('`parentRowTone` "warning" — ogohlantirish foni (yig`ilgan holatda ham)', () => {
    const tone = vi.fn().mockReturnValue('warning' as const);
    const { container } = render(
      <ExpandableTable
        data={data}
        columns={columns}
        renderParentRow={(row) => <span>{row.original.name}</span>}
        parentRowTone={tone}
      />,
    );
    expect(tone).toHaveBeenCalled();
    const td = container.querySelector('tbody td') as HTMLElement;
    const rules = Array.from(document.styleSheets)
      .flatMap((s) => {
        try {
          return Array.from(s.cssRules).map((r) => r.cssText);
        } catch {
          return [];
        }
      })
      .filter((r) => r.includes(td.className.split(' ').pop() ?? '___'));
    expect(rules.some((r) => r.toLowerCase().includes('#fef6ee'))).toBe(true);
  });
});

describe('ExpandableTable — ko`p qavatli sarlavha', () => {
  const grouped: ColumnDef<WithSubRows<Row>, unknown>[] = [
    {
      id: 'name',
      header: 'Fanning nomi',
      cell: ({ row }) => row.original.name,
      meta: { rowSpan: 2 },
    },
    {
      id: 'sem',
      header: 'Mazkur semester uchun',
      meta: { headerStyle: { background: '#FEF6EE' } },
      columns: [
        { id: 'total', header: 'Umumiy soat', cell: ({ row }) => row.original.hours },
        { id: 'aud', header: 'Auditoriya', cell: () => 45 },
      ],
    },
  ];

  it('guruh sarlavhasi colSpan oladi, `rowSpan` ustuni ikki marta chizilmaydi', () => {
    const { container } = render(<ExpandableTable data={data} columns={grouped} />);
    const headRows = container.querySelectorAll('thead tr');
    expect(headRows).toHaveLength(2);

    const firstRowThs = [...headRows[0]!.querySelectorAll('th')];
    const group = firstRowThs.find((th) => th.textContent === 'Mazkur semester uchun');
    expect(group?.getAttribute('colspan')).toBe('2');

    const nameTh = firstRowThs.find((th) => th.textContent === 'Fanning nomi');
    expect(nameTh?.getAttribute('rowspan')).toBe('2');

    const secondRowTexts = [...headRows[1]!.querySelectorAll('th')].map((th) => th.textContent);
    expect(secondRowTexts).not.toContain('Fanning nomi');
    expect(secondRowTexts).toEqual(expect.arrayContaining(['Umumiy soat', 'Auditoriya']));
  });

  it('`headerStyle` sarlavha katagiga qo`llanadi', () => {
    const { container } = render(<ExpandableTable data={data} columns={grouped} />);
    const group = [...container.querySelectorAll('thead th')].find(
      (th) => th.textContent === 'Mazkur semester uchun',
    ) as HTMLElement;
    expect(group.style.background).toBe('rgb(254, 246, 238)');
  });
});

describe('ExpandableTable — boshqariladigan ochilish', () => {
  it('prop berilmasa — ichki holat (eski xatti-harakat)', () => {
    const { container } = render(
      <ExpandableTable
        data={data}
        columns={columns}
        renderParentRow={(row) => (
          <button type="button" onClick={row.getToggleExpandedHandler()}>
            och
          </button>
        )}
      />,
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    fireEvent.click(container.querySelector('tbody button') as HTMLElement);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('`expanded` prop berilsa — TASHQARIDAN ochiladi', () => {
    const { container } = render(
      <ExpandableTable
        data={data}
        columns={columns}
        expanded={{ 0: true }}
        onExpandedChange={() => {}}
        renderParentRow={(row) => <span>{row.original.name}</span>}
      />,
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('controlled rejimda ichki holat qatorni O`ZI ochmaydi', () => {
    const onExpandedChange = vi.fn();
    const { container } = render(
      <ExpandableTable
        data={data}
        columns={columns}
        expanded={{}}
        onExpandedChange={onExpandedChange}
        renderParentRow={(row) => (
          <button type="button" onClick={row.getToggleExpandedHandler()}>
            och
          </button>
        )}
      />,
    );
    fireEvent.click(container.querySelector('tbody button') as HTMLElement);
    expect(onExpandedChange).toHaveBeenCalled();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});
