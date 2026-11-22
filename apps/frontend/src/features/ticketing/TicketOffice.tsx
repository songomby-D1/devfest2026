import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { NotFoundPage } from '../../components/not-found/NotFoundPage';
import { Logo } from '../../components/logo/Logo';
import { Link } from '../../lib/router/Link';
import { useSession } from '../../lib/session/session';
import {
  type Exhibition,
  findExhibition,
} from '../exhibition/exhibition-content';
import {
  type Booking,
  calendarEvent,
  formatAriary,
  formatLongDay,
  newReservationCode,
  openDays,
  type Quantities,
  ticketCount,
  totalPrice,
  venueDay,
} from './booking';
import { Ticket } from './Ticket';
import styles from './TicketOffice.module.css';
import { readBookings, saveBooking } from './tickets-store';

const DAYS_SHOWN = 21;
const CHILD_TARIFF = 'enfant';

const weekdayLong = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  timeZone: 'UTC',
});

/** "Fermé le dimanche et le lundi." from the closed weekdays (0 is Sunday). */
function closedDaysText(weekdays: readonly number[]): string {
  if (weekdays.length === 0) return 'Ouvert tous les jours.';
  // 4 January 1970 was a Sunday.
  const names = weekdays.map(
    (day) => `le ${weekdayLong.format(new Date(Date.UTC(1970, 0, 4 + day)))}`,
  );
  const last = names.pop() ?? '';
  return `Fermé ${names.length > 0 ? `${names.join(', ')} et ${last}` : last}.`;
}

const weekdayShort = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  timeZone: 'UTC',
});
const monthShort = new Intl.DateTimeFormat('fr-FR', {
  month: 'short',
  timeZone: 'UTC',
});

function dayParts(day: string): {
  weekday: string;
  date: string;
  month: string;
} {
  const instant = new Date(`${day}T00:00:00Z`);
  return {
    weekday: weekdayShort.format(instant).replace('.', ''),
    date: String(instant.getUTCDate()),
    month: monthShort.format(instant).replace('.', ''),
  };
}

/** "1 h 30", "45 min". */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0
    ? `${String(hours)} h`
    : `${String(hours)} h ${String(rest).padStart(2, '0')}`;
}

function problemWith(
  day: string | null,
  slot: string | null,
  quantities: Quantities,
  holder: string,
): string | null {
  if (day === null) return 'Choisissez le jour de votre visite.';
  if (slot === null) return 'Choisissez votre heure d’entrée.';
  const count = ticketCount(quantities);
  if (count === 0) return 'Ajoutez au moins un billet.';
  if (count === (quantities[CHILD_TARIFF] ?? 0)) {
    return 'Un enfant de moins de 12 ans doit être accompagné d’un adulte.';
  }
  if (holder.trim().length < 2) {
    return 'Indiquez le nom inscrit sur le billet.';
  }
  return null;
}

function downloadCalendar(booking: Booking, exhibition: Exhibition): void {
  const blob = new Blob([calendarEvent(booking, exhibition.visit)], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lova-${booking.code}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TicketOffice({ id }: { readonly id: string }) {
  const exhibition = findExhibition(id);
  if (exhibition === undefined) return <NotFoundPage />;
  return <TicketOfficeView exhibition={exhibition} />;
}

function TicketOfficeView({ exhibition }: { readonly exhibition: Exhibition }) {
  const { visit } = exhibition;
  const session = useSession();
  const holderId = useId();
  const [today] = useState(() => venueDay(new Date()));
  const days = useMemo(
    () => openDays(visit, today, DAYS_SHOWN),
    [visit, today],
  );
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Quantities>({});
  const [holder, setHolder] = useState('');
  const [holderTouched, setHolderTouched] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [history, setHistory] = useState<Booking[]>(() =>
    readBookings().filter((item) => item.exhibitionId === exhibition.id),
  );
  const preview = useRef<HTMLElement>(null);

  // The signed-in visitor's name fills the ticket until they edit it.
  useEffect(() => {
    if (!holderTouched && session.status === 'signed-in') {
      setHolder(session.me.displayName ?? '');
    }
  }, [session, holderTouched]);

  const count = ticketCount(quantities);
  const total = totalPrice(quantities, visit.tariffs);
  const ended = days.length === 0;

  function setQuantity(tariff: string, delta: number): void {
    setProblem(null);
    setQuantities((current) => {
      const next = Math.max(0, (current[tariff] ?? 0) + delta);
      if (delta > 0 && ticketCount(current) >= visit.maxTickets) {
        return current;
      }
      return { ...current, [tariff]: next };
    });
  }

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const issue = problemWith(day, slot, quantities, holder);
    setProblem(issue);
    if (issue !== null || day === null || slot === null) return;
    const issued: Booking = {
      code: newReservationCode(),
      exhibitionId: exhibition.id,
      exhibitionTitle: exhibition.title,
      day,
      slot,
      quantities,
      holder: holder.trim(),
      total,
      issuedAt: new Date().toISOString(),
    };
    setBooking(issued);
    setHistory(
      saveBooking(issued).filter((item) => item.exhibitionId === exhibition.id),
    );
    preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startOver(): void {
    setBooking(null);
    setDay(null);
    setSlot(null);
    setQuantities({});
    setProblem(null);
  }

  function show(previous: Booking): void {
    setBooking(previous);
    setDay(previous.day);
    setSlot(previous.slot);
    setQuantities(previous.quantities);
    setHolder(previous.holder);
    setHolderTouched(true);
    preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const locked = booking !== null;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link to={`/expositions/${exhibition.id}`} className={styles.back}>
          <span aria-hidden="true">←</span> L’exposition en 3D
        </Link>
        <Link to="/" className={styles.logo} aria-label="LOVA, accueil">
          <Logo />
        </Link>
        <span className={styles.topLabel}>Billetterie</span>
      </header>

      <main className={styles.layout}>
        <section className={styles.formColumn} aria-labelledby="office-title">
          <p className={styles.eyebrow}>
            Exposition {exhibition.number} · Sur place
          </p>
          <h1 id="office-title" className={styles.title}>
            Venir voir <em>en vrai</em>
          </h1>
          <p className={styles.lead}>
            {exhibition.title} se visite aussi en salle, à {visit.city}. Les
            matières, les gestes, les proportions : rien ne remplace la
            rencontre avec les œuvres.
          </p>

          <dl className={styles.facts}>
            <div>
              <dt>Lieu</dt>
              <dd>
                {visit.venue}
                <span>
                  {visit.address}, {visit.city}
                </span>
              </dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>
                Du {formatLongDay(visit.opens).replace(/^\S+ /, '')}
                <span>
                  au {formatLongDay(visit.closes).replace(/^\S+ /, '')}
                </span>
              </dd>
            </div>
            <div>
              <dt>Horaires</dt>
              <dd>
                {visit.hours.split(', ')[0]}
                <span>{visit.hours.split(', ')[1]}</span>
              </dd>
            </div>
          </dl>

          {ended ? (
            <p className={styles.notice} role="status">
              Cette exposition n’a plus de date ouverte à la réservation.
            </p>
          ) : (
            <form className={styles.form} onSubmit={submit} noValidate>
              <fieldset className={styles.step} disabled={locked}>
                <legend>
                  <span className={styles.stepNumber}>1</span> Le jour
                </legend>
                <div className={styles.days}>
                  {days.map((value) => {
                    const parts = dayParts(value);
                    return (
                      <label key={value} className={styles.day}>
                        <input
                          type="radio"
                          name="day"
                          value={value}
                          checked={day === value}
                          onChange={() => {
                            setDay(value);
                            setProblem(null);
                          }}
                          aria-label={formatLongDay(value)}
                        />
                        <span className={styles.dayWeekday}>
                          {parts.weekday}
                        </span>
                        <span className={styles.dayDate}>{parts.date}</span>
                        <span className={styles.dayMonth}>{parts.month}</span>
                      </label>
                    );
                  })}
                </div>
                <p className={styles.hint}>
                  {closedDaysText(visit.closedWeekdays)} Réservation au plus
                  tard la veille.
                </p>
              </fieldset>

              <fieldset className={styles.step} disabled={locked}>
                <legend>
                  <span className={styles.stepNumber}>2</span> L’heure d’entrée
                </legend>
                <div className={styles.slots}>
                  {visit.slots.map((value) => (
                    <label key={value} className={styles.slot}>
                      <input
                        type="radio"
                        name="slot"
                        value={value}
                        checked={slot === value}
                        onChange={() => {
                          setSlot(value);
                          setProblem(null);
                        }}
                      />
                      <span>{value}</span>
                    </label>
                  ))}
                </div>
                <p className={styles.hint}>
                  Comptez environ {formatDuration(visit.slotMinutes)} de visite.
                </p>
              </fieldset>

              <fieldset className={styles.step} disabled={locked}>
                <legend>
                  <span className={styles.stepNumber}>3</span> Les billets
                </legend>
                <ul className={styles.tariffs}>
                  {visit.tariffs.map((tariff) => {
                    const value = quantities[tariff.id] ?? 0;
                    return (
                      <li key={tariff.id} className={styles.tariff}>
                        <span className={styles.tariffText}>
                          <span className={styles.tariffLabel}>
                            {tariff.label}
                          </span>
                          <span className={styles.tariffDetail}>
                            {tariff.detail}
                          </span>
                        </span>
                        <span className={styles.tariffPrice}>
                          {formatAriary(tariff.price)}
                        </span>
                        <span className={styles.stepper}>
                          <button
                            type="button"
                            aria-label={`Retirer un billet ${tariff.label}`}
                            disabled={value === 0}
                            onClick={() => {
                              setQuantity(tariff.id, -1);
                            }}
                          >
                            −
                          </button>
                          <output aria-label={`Billets ${tariff.label}`}>
                            {value}
                          </output>
                          <button
                            type="button"
                            aria-label={`Ajouter un billet ${tariff.label}`}
                            disabled={count >= visit.maxTickets}
                            onClick={() => {
                              setQuantity(tariff.id, 1);
                            }}
                          >
                            +
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className={styles.hint}>
                  {visit.proof} Jusqu’à {visit.maxTickets} billets par
                  réservation.
                </p>
              </fieldset>

              <fieldset className={styles.step} disabled={locked}>
                <legend>
                  <span className={styles.stepNumber}>4</span> Le visiteur
                </legend>
                <div className={styles.field}>
                  <label htmlFor={holderId}>Nom inscrit sur le billet</label>
                  <input
                    id={holderId}
                    value={holder}
                    maxLength={60}
                    autoComplete="name"
                    onChange={(event) => {
                      setHolder(event.target.value);
                      setHolderTouched(true);
                      setProblem(null);
                    }}
                  />
                </div>
              </fieldset>

              {problem !== null ? (
                <p className={styles.error} role="alert">
                  {problem}
                </p>
              ) : null}

              {locked ? null : (
                <button type="submit" className={styles.submit}>
                  <span>Réserver</span>
                  <span className={styles.submitTotal}>
                    {count === 0
                      ? 'Choisissez vos billets'
                      : `${String(count)} billet${count > 1 ? 's' : ''} · ${formatAriary(total)}`}
                  </span>
                </button>
              )}
              <p className={styles.hint}>
                Pas de paiement en ligne : vous réglez à l’accueil,{' '}
                {visit.payment}. Le billet est gardé sur cet appareil ;
                imprimez-le ou présentez-le sur votre téléphone.
              </p>
            </form>
          )}
        </section>

        <aside
          ref={preview}
          className={styles.previewColumn}
          aria-label="Votre billet"
        >
          <p className={styles.previewLabel} aria-live="polite">
            {booking
              ? `Réservation confirmée · ${booking.code}`
              : 'Votre billet se compose ici'}
          </p>
          <div className={styles.printable}>
            <Ticket
              exhibition={exhibition}
              draft={{ day, slot, quantities, holder }}
              booking={booking}
            />
          </div>
          {booking ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  window.print();
                }}
              >
                Imprimer le billet
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  downloadCalendar(booking, exhibition);
                }}
              >
                Ajouter au calendrier
              </button>
              <button type="button" className={styles.link} onClick={startOver}>
                Nouvelle réservation
              </button>
            </div>
          ) : null}

          {history.length > 0 ? (
            <section className={styles.history} aria-label="Vos billets">
              <h2 className={styles.eyebrow}>Vos billets sur cet appareil</h2>
              <ul>
                {history.map((item) => (
                  <li key={item.code}>
                    <button
                      type="button"
                      aria-current={item.code === booking?.code}
                      onClick={() => {
                        show(item);
                      }}
                    >
                      <span className={styles.historyCode}>{item.code}</span>
                      <span>
                        {formatLongDay(item.day)} · {item.slot}
                      </span>
                      <span className={styles.historyCount}>
                        {ticketCount(item.quantities)} billet
                        {ticketCount(item.quantities) > 1 ? 's' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
