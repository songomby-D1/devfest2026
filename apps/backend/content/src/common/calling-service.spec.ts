import type { Request } from 'express';
import { callingServiceOf } from './calling-service';
import { PublicError } from './public-error';

function requestWith(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('callingServiceOf', () => {
  it.each(['gateway', 'nft', 'lidar'])('reads %s', (name) => {
    expect(callingServiceOf(requestWith({ 'x-service-name': name }))).toBe(
      name,
    );
  });

  it('refuses an unknown or missing name', () => {
    for (const headers of [{ 'x-service-name': 'auth' }, {}]) {
      expect(() => callingServiceOf(requestWith(headers))).toThrow(
        PublicError.serviceUnauthenticated(),
      );
    }
  });
});
