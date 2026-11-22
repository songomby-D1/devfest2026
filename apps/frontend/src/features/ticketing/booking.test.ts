import { describe, expect, it } from 'vitest';
import { exhibitions } from '../exhibition/exhibition-content';
import {
  addDays,
  type Booking,
  calendarEvent,
  formatAriary,
  formatLongDay,
  formatShortDay,
  newReservationCode,
  openDays,
  serialNumber,
  ticketCount,
  ticketLines,
  ticketPayload,
  totalPrice,
  venueDay,
  weekday,
} from './booking';

const exhibition = exhibitions[0];
if (exhibition === undefined) throw new Error('Missing exhibition fixture');
const { visit } = exhibition;

const booking: Booking = {
  code: 'LV-7K3P-29QD',
  exhibitionId: '1',
  exhibitionTitle: 'Héritage moderne',
  day: '2026-12-08',
  slot: '10:30',
  quantities: { resident: 2, enfant: 1 },
  holder: 'Miora Rakoto',
  total: 10000,
  issuedAt: '2026-11-22T08:30:00.000Z',
};

describe('ticket office rules', () => {
  it('reads the calendar day at the venue, in Antananarivo time', () => {
    expect(venueDay(new Date('2026-11-22T20:59:00Z'))).toBe('2026-11-22');
    expect(venueDay(new Date('2026-11-22T21:00:00Z'))).toBe('2026-11-23');
  });

  it('walks calendar days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekday('2026-12-07')).toBe(1);
  });

  it('offers open days from the opening, skipping Sundays and Mondays', () => {
    const days = openDays(visit, '2026-11-22', 5);
    expect(days).toEqual([
      '2026-12-05',
      '2026-12-08',
      '2026-12-09',
      '2026-12-10',
      '2026-12-11',
    ]);
  });

  it('starts the day after today once the exhibition is open', () => {
    expect(openDays(visit, '2027-01-05', 1)).toEqual(['2027-01-06']);
  });

  it('stops at the closing day', () => {
    expect(openDays(visit, '2027-02-25', 10)).toEqual([
      '2027-02-26',
      '2027-02-27',
    ]);
    expect(openDays(visit, '2027-02-27', 10)).toEqual([]);
  });

  it('counts tickets and prices them in ariary', () => {
    expect(ticketCount(booking.quantities)).toBe(3);
    expect(totalPrice(booking.quantities, visit.tariffs)).toBe(10000);
    expect(totalPrice({ 'non-resident': 2, etudiant: 1 }, visit.tariffs)).toBe(
      52000,
    );
    expect(ticketLines(booking.quantities, visit.tariffs)).toEqual([
      '2 × Résident',
      '1 × Enfant',
    ]);
    expect(formatAriary(0)).toBe('Gratuit');
    expect(formatAriary(52000).replace(/\s/g, ' ')).toBe('52 000 Ar');
  });

  it('formats the dates printed on the ticket', () => {
    expect(formatLongDay('2026-12-08')).toBe('mardi 8 décembre 2026');
    expect(formatShortDay('2026-12-08')).toBe('08.12.26');
  });

  it('issues unambiguous reservation codes', () => {
    const code = newReservationCode((bytes) => {
      bytes.set([0, 1, 2, 3, 4, 5, 6, 30]);
    });
    expect(code).toBe('LV-ABCD-EFG9');
    expect(newReservationCode()).toMatch(
      /^LV-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
    );
    expect(serialNumber(code)).toMatch(/^\d{6}$/);
    expect(serialNumber(code)).toBe(serialNumber(code));
  });

  it('encodes the reservation in the QR payload', () => {
    expect(ticketPayload(booking)).toBe(
      'LOVA|EXPO-1|LV-7K3P-29QD|2026-12-08T10:30|N3',
    );
  });

  it('exports the visit as a calendar event in UTC', () => {
    const ics = calendarEvent(booking, visit);
    expect(ics).toContain('DTSTART:20261208T073000Z');
    expect(ics).toContain('DTEND:20261208T090000Z');
    expect(ics).toContain('UID:LV-7K3P-29QD@lova');
    expect(ics).toContain(
      'LOCATION:Musée d’Art et d’Archéologie\\, 17 rue du Docteur Villette\\, Isoraka\\, Antananarivo',
    );
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
    expect(ics).toContain('2 × Résident\\, 1 × Enfant');
  });
});
