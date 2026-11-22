import type { Request } from 'express';
import { callerContextOf } from './caller-context';
import { PublicError } from './public-error';

function requestWith(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('callerContextOf', () => {
  it('reads the user, permissions and request ID from the gateway headers', () => {
    expect(
      callerContextOf(
        requestWith({
          'x-caller-user-id': '6F1C2D3E-4B5A-4C6D-8E7F-9A0B1C2D3E4F',
          'x-caller-permissions': 'reviewer, reviewer,Bad Value',
          'x-request-id': 'req-1',
        }),
      ),
    ).toEqual({
      userId: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
      permissions: ['reviewer'],
      requestId: 'req-1',
    });
  });

  it('accepts the older account header and treats no header as a guest', () => {
    expect(
      callerContextOf(
        requestWith({
          'x-caller-account-id': '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
        }),
      ).userId,
    ).toBe('6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f');
    const guest = callerContextOf(requestWith({}));
    expect(guest.userId).toBeNull();
    expect(guest.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects a malformed user ID as a gateway fault', () => {
    expect(() =>
      callerContextOf(requestWith({ 'x-caller-user-id': 'admin' })),
    ).toThrow(PublicError);
  });
});
