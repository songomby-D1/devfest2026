export interface FieldIssue {
  readonly field: string;
  readonly reason: string;
}

export type AuthErrorCode =
  | 'VALIDATION_FAILED'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_INVALID'
  | 'ACCOUNT_NOT_FOUND'
  | 'AUTH_BUSY';

/** Expected failures with a code and a message that is safe to show to end users. */
export abstract class AuthError extends Error {
  abstract readonly code: AuthErrorCode;
}

export class ValidationFailedError extends AuthError {
  readonly code = 'VALIDATION_FAILED';

  constructor(readonly details: readonly FieldIssue[]) {
    super('The request is invalid.');
    this.name = 'ValidationFailedError';
  }
}

export class EmailAlreadyRegisteredError extends AuthError {
  readonly code = 'EMAIL_ALREADY_REGISTERED';

  constructor() {
    super('An account already exists for this email.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends AuthError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('The email or password is incorrect.');
    this.name = 'InvalidCredentialsError';
  }
}

export class SessionInvalidError extends AuthError {
  readonly code = 'SESSION_INVALID';

  constructor() {
    super('The session is invalid or has expired.');
    this.name = 'SessionInvalidError';
  }
}

export class AccountNotFoundError extends AuthError {
  readonly code = 'ACCOUNT_NOT_FOUND';

  constructor() {
    super('No account matches this request.');
    this.name = 'AccountNotFoundError';
  }
}

export class AuthBusyError extends AuthError {
  readonly code = 'AUTH_BUSY';

  constructor() {
    super('The service is busy. Try again in a moment.');
    this.name = 'AuthBusyError';
  }
}
