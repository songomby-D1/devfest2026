import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setApiClient } from '../../lib/api';
import { createMockClient } from '../../lib/api/mock-client';
import { TicketOffice } from './TicketOffice';

async function chooseVisit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('radio', { name: 'mardi 8 décembre 2026' }),
  );
  await user.click(screen.getByRole('radio', { name: '10:30' }));
}

describe('TicketOffice', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T09:00:00Z'));
    window.localStorage.clear();
    Element.prototype.scrollIntoView = () => undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('presents the visit on site with its open days and entry times', () => {
    render(<TicketOffice id="1" />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Venir voir en vrai/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Musée d’Art et d’Archéologie'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Fermé le dimanche et le lundi\./),
    ).toBeInTheDocument();
    // Opens on 5 December; Sundays and Mondays are closed.
    expect(
      screen.getByRole('radio', { name: 'samedi 5 décembre 2026' }),
    ).toBeInTheDocument();
    for (const closed of [
      'dimanche 6 décembre 2026',
      'lundi 7 décembre 2026',
    ]) {
      expect(screen.queryByRole('radio', { name: closed })).toBeNull();
    }
    expect(screen.getAllByRole('radio', { name: /^\d\d:\d\d$/ })).toHaveLength(
      4,
    );
  });

  it('explains what is missing before booking', async () => {
    const user = userEvent.setup();
    render(<TicketOffice id="1" />);
    await user.click(screen.getByRole('button', { name: /^Réserver/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choisissez le jour de votre visite.',
    );

    await chooseVisit(user);
    await user.click(
      screen.getByRole('button', { name: 'Ajouter un billet Enfant' }),
    );
    await user.type(screen.getByLabelText('Nom inscrit sur le billet'), 'Ana');
    await user.click(screen.getByRole('button', { name: /^Réserver/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'doit être accompagné d’un adulte',
    );
  });

  it('issues a ticket with a QR code and keeps it on the device', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TicketOffice id="1" />);
    await chooseVisit(user);
    const addAdult = screen.getByRole('button', {
      name: 'Ajouter un billet Résident',
    });
    await user.click(addAdult);
    await user.click(addAdult);
    await user.click(
      screen.getByRole('button', { name: 'Ajouter un billet Enfant' }),
    );
    await user.type(
      screen.getByLabelText('Nom inscrit sur le billet'),
      'Miora Rakoto',
    );
    expect(screen.getByRole('button', { name: /^Réserver/ })).toHaveTextContent(
      /3 billets · 10\s000\sAr/,
    );
    await user.click(screen.getByRole('button', { name: /^Réserver/ }));

    const ticket = screen.getByRole('article', { name: /^Billet LV-/ });
    expect(ticket).toHaveAccessibleName(
      /Héritage moderne, mardi 8 décembre 2026 à 10:30/,
    );
    expect(within(ticket).getByText('Miora Rakoto')).toBeInTheDocument();
    expect(
      within(ticket).getByRole('img', { name: /Code de contrôle LV-/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Imprimer le billet' }),
    ).toBeInTheDocument();
    unmount();

    render(<TicketOffice id="1" />);
    const history = screen.getByRole('region', { name: 'Vos billets' });
    expect(
      within(history).getByText(/mardi 8 décembre 2026 · 10:30/),
    ).toBeInTheDocument();
  });

  it('caps a reservation at the maximum number of tickets', async () => {
    const user = userEvent.setup();
    render(<TicketOffice id="1" />);
    const add = screen.getByRole('button', {
      name: 'Ajouter un billet Non-résident',
    });
    for (let i = 0; i < 8; i += 1) await user.click(add);
    expect(add).toBeDisabled();
    expect(screen.getByLabelText('Billets Non-résident')).toHaveTextContent(
      '8',
    );
  });

  it('prefills the ticket holder with the signed-in visitor', async () => {
    setApiClient(createMockClient({ signedInAs: 'curator' }));
    render(<TicketOffice id="1" />);
    const input = screen.getByLabelText('Nom inscrit sur le billet');
    await vi.waitFor(() => {
      expect((input as HTMLInputElement).value).not.toBe('');
    });
  });
});
