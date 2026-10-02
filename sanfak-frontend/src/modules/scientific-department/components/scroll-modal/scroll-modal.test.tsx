import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Modal from './index';

describe('scroll-modal', () => {
  it('kontentni scroll konteyneriga o`raydi (ant-modal-body ning bevosita bolasi emas)', () => {
    render(
      <Modal open title="Sinov">
        <p data-testid="content">Kontent</p>
      </Modal>,
    );

    const content = screen.getByTestId('content');
    const wrapper = content.parentElement;

    expect(wrapper).not.toBeNull();
    expect(wrapper?.tagName).toBe('DIV');
    expect(wrapper?.className).not.toContain('ant-modal-body');
    expect(wrapper?.parentElement?.className).toContain('ant-modal-body');
  });

  it('scroll konteynerida vertikal scroll va balandlik chegarasi bor', () => {
    render(
      <Modal open title="Sinov">
        <p data-testid="content2">Kontent</p>
      </Modal>,
    );

    const wrapper = screen.getByTestId('content2').parentElement as HTMLElement;
    const cs = getComputedStyle(wrapper);

    expect(cs.overflowY).toBe('auto');
    expect(cs.overflowX).toBe('hidden');
    expect(cs.maxHeight).toBe('72vh');
  });

  it('sarlavha va footer scroll maydonidan TASHQARIDA qoladi (qotib turadi)', () => {
    render(
      <Modal open title="Sarlavha" okText="Saqlash">
        <p data-testid="content3">Kontent</p>
      </Modal>,
    );

    const wrapper = screen.getByTestId('content3').parentElement as HTMLElement;
    expect(wrapper.textContent).not.toContain('Sarlavha');
    expect(wrapper.textContent).not.toContain('Saqlash');
    expect(screen.getByText('Sarlavha')).toBeDefined();
    expect(screen.getByText('Saqlash')).toBeDefined();
  });

  it('default`da ekran markazida chiqadi', () => {
    render(
      <Modal open title="Sinov">
        <p data-testid="content4">Kontent</p>
      </Modal>,
    );

    const wrap = screen.getByTestId('content4').closest('.ant-modal-wrap');
    expect(wrap?.className).toContain('ant-modal-centered');
  });

  it('chaqiruvchi `centered={false}` bilan bekor qila oladi', () => {
    render(
      <Modal open centered={false} title="Sinov">
        <p data-testid="content5">Kontent</p>
      </Modal>,
    );

    const wrap = screen.getByTestId('content5').closest('.ant-modal-wrap');
    expect(wrap?.className).not.toContain('ant-modal-centered');
  });

  it('modul bo`ylab har bir imperativ modal.confirm markazlashtirilgan', () => {
    const sources = import.meta.glob('../../**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;

    const offenders: string[] = [];
    let found = 0;
    for (const [path, src] of Object.entries(sources)) {
      let from = src.indexOf('modal.confirm({');
      while (from !== -1) {
        found += 1;
        if (!src.slice(from, from + 300).includes('centered: true')) offenders.push(path);
        from = src.indexOf('modal.confirm({', from + 1);
      }
    }

    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(found).toBeGreaterThanOrEqual(1);
    expect(offenders).toEqual([]);
  });
});
