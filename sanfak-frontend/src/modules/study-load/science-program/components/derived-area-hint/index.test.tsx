import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type { DirectionRef } from '../../../study-plan/model/types';
import DerivedAreaHint from './index';

const DIRECTIONS: DirectionRef[] = [
  { id: 'dir-1', title: 'Davolash ishi', knowledgeArea: "900000 – Sog'liqni saqlash va ijtimoiy ta'minot" },
  { id: 'dir-2', title: 'Sohasiz' },
];

describe("DerivedAreaHint — «Bilim sohasi» yo'nalishdan", () => {
  it("o'z qatorlari bo'sh — yo'nalishdagi qiymat ko'rsatiladi", () => {
    renderWithProviders(
      <DerivedAreaHint field="knowledgeArea" ownRows={['']} selectedDirectionIds={['dir-1']} directions={DIRECTIONS} />,
    );
    expect(screen.getByTestId('derived-knowledgeArea')).toHaveTextContent(
      "900000 – Sog'liqni saqlash va ijtimoiy ta'minot",
    );
  });

  it("o'z qatori to'la — izoh chizilmaydi", () => {
    renderWithProviders(
      <DerivedAreaHint field="knowledgeArea" ownRows={['Tibbiyot']} selectedDirectionIds={['dir-1']} directions={DIRECTIONS} />,
    );
    expect(screen.queryByTestId('derived-knowledgeArea')).not.toBeInTheDocument();
  });

  it("yo'nalishda soha yo'q — izoh chizilmaydi", () => {
    renderWithProviders(
      <DerivedAreaHint field="knowledgeArea" ownRows={[]} selectedDirectionIds={['dir-2']} directions={DIRECTIONS} />,
    );
    expect(screen.queryByTestId('derived-knowledgeArea')).not.toBeInTheDocument();
  });
});
