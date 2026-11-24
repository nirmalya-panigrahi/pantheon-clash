import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCardById } from '../../data/cards';
import { DEITY_IMAGE_FILES, getDeityImageUrl } from '../../data/deityImages';
import { Card } from '../Card';
import { DeityArt } from '../MythEmblem';

describe('Deity art mapping and Gold Idol Card component', () => {
  it('maps all 60 deities cleanly to Slide1.PNG .. Slide60.PNG without leading slash', () => {
    expect(ALL_CARDS).toHaveLength(60);
    expect(Object.keys(DEITY_IMAGE_FILES)).toHaveLength(60);

    expect(getDeityImageUrl('zeus')).toMatch(/^\.?\/?.*deity\/Slide1\.PNG$/);
    expect(getDeityImageUrl('zeus')?.startsWith('/deity/')).toBe(false);
    expect(getDeityImageUrl('jormungandr')).toContain('deity/Slide15.PNG');
    expect(getDeityImageUrl('mictlantecuhtli')).toContain('deity/Slide60.PNG');
    expect(getDeityImageUrl('missing_deity')).toBeNull();
  });

  it('renders transparent PNG deity artwork and falls back to PantheonCrest on error', () => {
    const zeus = getCardById('zeus');
    const { container } = render(<DeityArt card={zeus} />);

    const img = screen.getByRole('img', { name: 'Zeus artwork' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveClass('object-contain');
    expect(img).toHaveClass('bg-transparent');

    fireEvent.error(img);
    expect(screen.queryByRole('img', { name: 'Zeus artwork' })).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders full Gold Idol details and hides info strip/bottom boxes/footer in compact mode', () => {
    const zeus = getCardById('zeus');
    const { rerender } = render(<Card card={zeus} activeRealm="SKY" realmBonus={15} />);

    expect(screen.getByText(/Pantheon Clash · No\. 01\/60/)).toBeInTheDocument();
    expect(screen.getAllByText('+15').length).toBeGreaterThanOrEqual(1);

    rerender(<Card card={zeus} activeRealm="SKY" bonusNegated />);
    expect(screen.getByText('Pierced')).toBeInTheDocument();

    rerender(<Card card={zeus} compact />);
    expect(screen.queryByText(/Pantheon Clash · No\. 01\/60/)).not.toBeInTheDocument();
  });
});
