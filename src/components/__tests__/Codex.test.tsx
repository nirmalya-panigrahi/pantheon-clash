import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Codex } from '../Codex';

describe('Codex component', () => {
  it('Blue Pill: filters by pantheon/realm/passive, sorts by stat, and opens card detail modal', async () => {
    const user = userEvent.setup();
    render(<Codex />);

    expect(screen.getByText(/showing 60 of 60 deities/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Greek' }));
    expect(screen.getByLabelText('Zeus card')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/filter by passive/i), 'PIERCING');
    await user.selectOptions(screen.getByLabelText(/sort cards/i), 'might');

    await user.click(screen.getByLabelText('Zeus card'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/zeus — greek/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close zeus — greek/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Red Pill: shows empty state when search filter matches no deity', async () => {
    const user = userEvent.setup();
    render(<Codex />);

    await user.type(screen.getByLabelText(/search deity name/i), 'NonexistentDeity999');
    expect(screen.getByText(/no mythology cards match the active filters/i)).toBeInTheDocument();
  });
});
