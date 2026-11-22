import type { Tariff, Visit } from '../exhibition/exhibition-content';

/*
 * Booking rules of the ticket office. Days are calendar strings
 * (`YYYY-MM-DD`) handled in UTC, so the visitor's own time zone never
 * shifts a date.
 */

export type Quantities = Readonly<Record<string, number>>;

export interface Booking {
  readonly code: string;
  readonly exhibitionId: string;
  readonly exhibitionTitle: string;
  readonly day: string;
  readonly slot: string;
  readonly quantities: Quantities;
  readonly holder: string;
  readonly total: number;
  readonly issuedAt: string;
}

/** Antananarivo is UTC+3 all year (no daylight saving time). */
const VENUE_UTC_OFFSET_HOURS = 3;
const DAY_MS = 86_400_000;
/** No 0/O or 1/I/L, so a code read aloud at the desk is unambiguous. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function parseDay(day: string): number {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The calendar day at the venue for an instant. */
export function venueDay(now: Date): string {
  return formatDay(now.getTime() + VENUE_UTC_OFFSET_HOURS * 3_600_000);
}

export function addDays(day: string, count: number): string {
  return formatDay(parseDay(day) + count * DAY_MS);
}

export function weekday(day: string): number {
  return new Date(parseDay(day)).getUTCDay();
}

/**
 * The next `count` open days, booked at the latest the day before: today's
 * slots may already have passed at the venue.
 */
export function openDays(visit: Visit, today: string, count: number): string[] {
  const days: string[] = [];
  let day = addDays(today, 1);
  if (day < visit.opens) day = visit.opens;
  while (days.length < count && day <= visit.closes) {
    if (!visit.closedWeekdays.includes(weekday(day))) days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

export function ticketCount(quantities: Quantities): number {
  return Object.values(quantities).reduce((sum, value) => sum + value, 0);
}

export function totalPrice(
  quantities: Quantities,
  tariffs: readonly Tariff[],
): number {
  return tariffs.reduce(
    (sum, tariff) => sum + tariff.price * (quantities[tariff.id] ?? 0),
    0,
  );
}

/** "2 × Plein tarif", in tariff order, skipping empty lines. */
export function ticketLines(
  quantities: Quantities,
  tariffs: readonly Tariff[],
): string[] {
  return tariffs
    .filter((tariff) => (quantities[tariff.id] ?? 0) > 0)
    .map((tariff) => `${String(quantities[tariff.id])} × ${tariff.label}`);
}

const ariary = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatAriary(amount: number): string {
  return amount === 0 ? 'Gratuit' : `${ariary.format(amount)} Ar`;
}

const longDay = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const shortDay = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  timeZone: 'UTC',
});

/** "samedi 5 décembre 2026". */
export function formatLongDay(day: string): string {
  return longDay.format(new Date(parseDay(day)));
}

/** "05.12.26", as printed on the stub. */
export function formatShortDay(day: string): string {
  return shortDay.format(new Date(parseDay(day))).replaceAll('/', '.');
}

/** "LV-7K3P-29QD". */
export function newReservationCode(
  fill: (bytes: Uint8Array<ArrayBuffer>) => void = (bytes) => {
    crypto.getRandomValues(bytes);
  },
): string {
  const bytes = new Uint8Array(8);
  fill(bytes);
  const chars = Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length] ?? 'X',
  ).join('');
  return `LV-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** A stable serial number for the ticket, derived from its code. */
export function serialNumber(code: string): string {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000;
  return String(hash).padStart(6, '0');
}

/** What the QR code on the stub encodes, read by the desk. */
export function ticketPayload(booking: Booking): string {
  return [
    'LOVA',
    `EXPO-${booking.exhibitionId}`,
    booking.code,
    `${booking.day}T${booking.slot}`,
    `N${String(ticketCount(booking.quantities))}`,
  ].join('|');
}

function icsText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n');
}

function icsUtc(day: string, time: string, plusMinutes = 0): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const ms =
    parseDay(day) +
    ((hours - VENUE_UTC_OFFSET_HOURS) * 60 + minutes + plusMinutes) * 60_000;
  return `${new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/** An iCalendar event for the visit, in UTC. */
export function calendarEvent(booking: Booking, visit: Visit): string {
  const stamp = `${booking.issuedAt.replace(/[-:]/g, '').slice(0, 15)}Z`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LOVA//Billetterie//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${booking.code}@lova`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsUtc(booking.day, booking.slot)}`,
    `DTEND:${icsUtc(booking.day, booking.slot, visit.slotMinutes)}`,
    `SUMMARY:${icsText(`Exposition ${booking.exhibitionTitle}`)}`,
    `LOCATION:${icsText(`${visit.venue}, ${visit.address}, ${visit.city}`)}`,
    `DESCRIPTION:${icsText(
      `Réservation ${booking.code} : ${ticketLines(booking.quantities, visit.tariffs).join(', ')}. Total ${formatAriary(booking.total)}, à régler à l’accueil ${visit.payment}.`,
    )}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
