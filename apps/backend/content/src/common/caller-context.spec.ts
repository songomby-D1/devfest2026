import type { Request } from 'express';
import { callerContextOf, isReviewer } from './caller-context';
import { PublicError } from './public-error';

const USER_ID = '6f1c1d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f';

function requestWith(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('callerContextOf', () => {
  it('reads the user, permissions and request ID set by the gateway', () => {
    const caller = callerContextOf(
      requestWith({
        'x-caller-user-id': USER_ID.toUpperCase(),
        'x-caller-permissions': 'reviewer',
        'x-request-id': 'req-1',
      }),
    );

    expect(caller).toEqual({
      userId: USER_ID,
      permissions: ['reviewer'],
      requestId: 'req-1',
    });
    expect(isReviewer(caller)).toBe(true);
  });

  it('treats a request without a user header as a guest', () => {
    const caller = callerContextOf(requestWith({ 'x-caller-permissions': '' }));

    expect(caller.userId).toBeNull();
    expect(caller.permissions).toEqual([]);
    expect(caller.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts the x-caller-account-id name of the Auth contract', () => {
    const caller = callerContextOf(
      requestWith({ 'x-caller-account-id': USER_ID }),
    );

    expect(caller.userId).toBe(USER_ID);
  });

  it('ignores unknown and duplicate permissions', () => {
    const caller = callerContextOf(
      requestWith({ 'x-caller-permissions': ' reviewer, admin ,reviewer' }),
    );

    expect(caller.permissions).toEqual(['reviewer']);
  });

  it('rejects a malformed user ID instead of downgrading to a guest', () => {
    expect(() =>
      callerContextOf(requestWith({ 'x-caller-user-id': 'ana@example.org' })),
    ).toThrow(PublicError);
  });

  it('replaces an unsafe request ID', () => {
    const caller = callerContextOf(requestWith({ 'x-request-id': 'bad id\n' }));

    expect(caller.requestId).not.toBe('bad id\n');
  });
});
