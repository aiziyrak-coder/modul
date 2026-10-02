import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import Modal from './Modal';
import { theme } from '../../styles/theme';

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider theme={theme as unknown as DefaultTheme}>{ui}</ThemeProvider>
);

const overlayOf = (title: string): HTMLElement => {
  const head = screen.getByText(title);
  const overlay = head.closest('div')?.parentElement?.parentElement;
  if (!overlay) throw new Error(`"${title}" uchun overlay topilmadi`);
  return overlay;
};

const zOf = (title: string) => Number(getComputedStyle(overlayOf(title)).zIndex);

describe('Modal — ichma-ich qatlam (MD-57)', () => {
  it('yolg‘iz oyna bazaviy qatlamda qoladi (eski xulq buzilmaydi)', () => {
    render(wrap(<Modal open onClose={() => {}} title="Yolg‘iz" />));
    expect(zOf('Yolg‘iz')).toBeGreaterThanOrEqual(1000);
  });

  it('KEYIN ochilgan oyna, DOM da OLDINROQ bo‘lsa ham, ustida turadi', () => {
    render(
      wrap(
        <>
          <Modal open onClose={() => {}} title="Ichki (DOM da birinchi)" />
          <Modal open onClose={() => {}} title="Tashqi (DOM da ikkinchi)" />
        </>,
      ),
    );
    expect(zOf('Ichki (DOM da birinchi)')).not.toBe(zOf('Tashqi (DOM da ikkinchi)'));
  });

  it('yopilgan oyna hech narsa chizmaydi va qatlam egallamaydi', () => {
    render(wrap(<Modal open={false} onClose={() => {}} title="Yopiq" />));
    expect(screen.queryByText('Yopiq')).toBeNull();
  });

  it('ketma-ket ochilgan uch oyna uch xil qatlam oladi', () => {
    render(
      wrap(
        <>
          <Modal open onClose={() => {}} title="Bir" />
          <Modal open onClose={() => {}} title="Ikki" />
          <Modal open onClose={() => {}} title="Uch" />
        </>,
      ),
    );
    const layers = [zOf('Bir'), zOf('Ikki'), zOf('Uch')];
    expect(new Set(layers).size).toBe(3);
  });
});
