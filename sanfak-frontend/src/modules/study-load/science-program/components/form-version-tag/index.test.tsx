import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { mapScienceProgram, type BackendScienceProgramListItem } from '../../api/mapper';
import FormVersionTag from './index';

describe('FormVersionTag — tartib markirovkasi', () => {
  it("v259 qatorda '259-son' tegi KO'RINADI (ilgari belgi umuman yo'q edi)", () => {
    renderWithProviders(<FormVersionTag version="v259" />);

    expect(screen.getByText('259-son')).toBeInTheDocument();
  });

  it("v142 qatorda '142-son' tegi ko'rinadi (mavjud xatti-harakat saqlanadi)", () => {
    renderWithProviders(<FormVersionTag version="v142" />);

    expect(screen.getByText('142-son')).toBeInTheDocument();
  });

  it("legacy hujjat (`formVersion` backendda YO'Q) — mapper normalizatsiyasidan keyin '259-son'", () => {
    const legacy: BackendScienceProgramListItem = { _id: 'sp-legacy' };
    const item = mapScienceProgram(legacy);

    renderWithProviders(<FormVersionTag version={item.formVersion} />);

    expect(item.formVersion).toBe('v259');
    expect(screen.getByText('259-son')).toBeInTheDocument();
  });

  it("v259 tooltip'i to'liq rekvizitni beradi (2023-yil 9-iyun, 2-ilova)", async () => {
    renderWithProviders(<FormVersionTag version="v259" />);
    fireEvent.mouseEnter(screen.getByText('259-son'));

    const tip = await screen.findByText(/259-son buyruq/);
    expect(tip.textContent).toContain('2023-yil 9-iyun');
    expect(tip.textContent).toContain('2-ilova');
    expect(tip.textContent).not.toContain('876');
  });

  it("v142 tooltip'i to'liq rekvizitni beradi (2026-yil 15-aprel)", async () => {
    renderWithProviders(<FormVersionTag version="v142" />);
    fireEvent.mouseEnter(screen.getByText('142-son'));

    const tip = await screen.findByText(/142-son buyruq/);
    expect(tip.textContent).toContain('2026-yil 15-aprel');
    expect(tip.textContent).not.toContain('876');
  });

  it('teg klaviatura bilan fokuslanadi (tooltip sichqonchasiz ham ochiladi)', () => {
    renderWithProviders(<FormVersionTag version="v259" />);

    expect(screen.getByText('259-son')).toHaveAttribute('tabindex', '0');
  });
});
