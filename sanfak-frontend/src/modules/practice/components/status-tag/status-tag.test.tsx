import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { StatusTag } from './index';

describe('StatusTag', () => {
  it('renders draft as "Yangi"', () => {
    renderWithProviders(<StatusTag status="draft" />);
    expect(screen.getByText('Yangi')).toBeInTheDocument();
  });

  it('renders both_approved as "Ikki tomon tasdiqlagan"', () => {
    renderWithProviders(<StatusTag status="both_approved" />);
    expect(screen.getByText('Ikki tomon tasdiqlagan')).toBeInTheDocument();
  });

  it('remaps rektor_approved to "Tasdiqlagan" for the rektor role', () => {
    renderWithProviders(<StatusTag status="rektor_approved" role="rektor" />);
    expect(screen.getByText('Tasdiqlagan')).toBeInTheDocument();
  });

  it('renders rektor_approved as "Rektor tasdiqlagan" when no role is given', () => {
    renderWithProviders(<StatusTag status="rektor_approved" />);
    expect(screen.getByText('Rektor tasdiqlagan')).toBeInTheDocument();
  });
});
