import { Logo } from '../../components/logo/Logo';
import type { Exhibition } from '../exhibition/exhibition-content';
import {
  type Booking,
  formatAriary,
  formatLongDay,
  formatShortDay,
  type Quantities,
  serialNumber,
  ticketCount,
  ticketLines,
  ticketPayload,
  totalPrice,
} from './booking';
import { QrCode } from './QrCode';
import styles from './Ticket.module.css';

export interface TicketDraft {
  readonly day: string | null;
  readonly slot: string | null;
  readonly quantities: Quantities;
  readonly holder: string;
}

interface TicketProps {
  readonly exhibition: Exhibition;
  readonly draft: TicketDraft;
  /** Present once the reservation is confirmed: the stub then carries its code. */
  readonly booking: Booking | null;
}

/**
 * A paper admission ticket: main part with the visit details, a perforated
 * control stub with the QR code, and a "Réservé" stamp once confirmed.
 * Before confirmation it is a live preview of the choices.
 */
export function Ticket({ exhibition, draft, booking }: TicketProps) {
  const { visit } = exhibition;
  const lines = ticketLines(draft.quantities, visit.tariffs);
  const count = ticketCount(draft.quantities);
  const holder = draft.holder.trim();
  const label = booking
    ? `Billet ${booking.code}, ${exhibition.title}, ${formatLongDay(booking.day)} à ${booking.slot}`
    : `Aperçu du billet pour ${exhibition.title}`;

  return (
    <div className={styles.shadow}>
      <article
        className={styles.ticket}
        data-issued={booking !== null}
        aria-label={label}
      >
        <div className={styles.main}>
          <p className={styles.serial} aria-hidden="true">
            {booking ? `N° ${serialNumber(booking.code)}` : 'N° ······'} · Série{' '}
            {exhibition.number}
          </p>
          <header className={styles.band}>
            <span className={styles.bandBrand}>
              <Logo className={styles.logo} />
              Exposition {exhibition.number}
            </span>
            <span>Billet d’entrée</span>
          </header>

          <div className={styles.body}>
            <p className={styles.kicker}>Admission · Visite sur place</p>
            <h3 className={styles.title}>{exhibition.title}</h3>
            <p className={styles.subtitle}>{exhibition.curator}</p>

            <dl className={styles.fields}>
              <div className={styles.wide}>
                <dt>Date</dt>
                <dd>
                  {draft.day ? formatLongDay(draft.day) : '— à choisir —'}
                </dd>
              </div>
              <div>
                <dt>Entrée</dt>
                <dd className={styles.time}>{draft.slot ?? '--:--'}</dd>
              </div>
              <div className={styles.wide}>
                <dt>Lieu</dt>
                <dd>
                  {visit.venue}, {visit.address}, {visit.city}
                </dd>
              </div>
              <div>
                <dt>Visiteur</dt>
                <dd>{holder === '' ? '—' : holder}</dd>
              </div>
              <div className={styles.wide}>
                <dt>Billets</dt>
                <dd>{lines.length > 0 ? lines.join(' · ') : '—'}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>
                  {count === 0
                    ? '—'
                    : formatAriary(
                        booking?.total ??
                          totalPrice(draft.quantities, visit.tariffs),
                      )}
                </dd>
              </div>
            </dl>
          </div>

          <p className={styles.fine}>
            Valable pour une entrée dans le créneau indiqué. Règlement à
            l’accueil, {visit.payment}. {visit.proof}
          </p>
          <span className={styles.foil} aria-hidden="true" />
          {booking ? (
            <span className={styles.stamp} aria-hidden="true">
              Réservé
            </span>
          ) : null}
        </div>

        <div className={styles.stub}>
          <p className={styles.stubKicker}>Talon de contrôle</p>
          {booking ? (
            <QrCode
              className={styles.qr}
              value={ticketPayload(booking)}
              label={`Code de contrôle ${booking.code}`}
            />
          ) : (
            <span className={styles.qrPlaceholder}>
              Code délivré à la confirmation
            </span>
          )}
          <p className={styles.code}>{booking?.code ?? 'LV-····-····'}</p>
          <p className={styles.stubMeta}>
            {draft.day ? formatShortDay(draft.day) : '--.--.--'} ·{' '}
            {draft.slot ?? '--:--'}
          </p>
          <p className={styles.admit}>
            Admet <strong>{count}</strong>
          </p>
        </div>
      </article>
    </div>
  );
}
