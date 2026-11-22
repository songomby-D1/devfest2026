import type { Booking } from './booking';

const KEY = 'lova.tickets';
const MAX_KEPT = 20;

/** Bookings stay on this device: there is no booking service yet. */
export function readBookings(): Booking[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Booking[]) : [];
  } catch {
    return [];
  }
}

export function saveBooking(booking: Booking): Booking[] {
  const next = [
    booking,
    ...readBookings().filter((item) => item.code !== booking.code),
  ].slice(0, MAX_KEPT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing or full storage: the ticket still shows for this visit.
  }
  return next;
}
