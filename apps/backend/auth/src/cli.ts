import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AuthService } from './application/auth.service.js';
import { InvalidConfigError, loadAppConfig } from './config/app-config.js';
import { AuthError } from './domain/errors.js';
import { isPermission } from './domain/permission.js';

const USAGE = [
  'Usage:',
  '  node dist/cli.js grant-permission <email> <permission>',
  '  node dist/cli.js revoke-permission <email> <permission>',
  '  node dist/cli.js purge-sessions',
  '',
].join('\n');

class UsageError extends Error {
  constructor() {
    super(USAGE);
    this.name = 'UsageError';
  }
}

type Command = (auth: AuthService, args: readonly string[]) => Promise<string>;

const commands: Readonly<Record<string, Command>> = {
  'grant-permission': async (auth, [email, permission]) => {
    if (
      email === undefined ||
      permission === undefined ||
      !isPermission(permission)
    ) {
      throw new UsageError();
    }
    await auth.grantPermission(email, permission);
    return `Granted ${permission}.\n`;
  },
  'revoke-permission': async (auth, [email, permission]) => {
    if (
      email === undefined ||
      permission === undefined ||
      !isPermission(permission)
    ) {
      throw new UsageError();
    }
    await auth.revokePermission(email, permission);
    return `Revoked ${permission}.\n`;
  },
  'purge-sessions': async (auth) => {
    const count = await auth.purgeSessions();
    return `Purged ${String(count)} inactive sessions.\n`;
  },
};

async function main(argv: readonly string[]): Promise<void> {
  const [name, ...args] = argv;
  const command = name === undefined ? undefined : commands[name];
  if (command === undefined) throw new UsageError();

  const config = loadAppConfig(process.env);
  const app = await NestFactory.createApplicationContext(
    AppModule.register(config),
    { logger: ['error', 'warn'] },
  );
  try {
    process.stdout.write(await command(app.get(AuthService), args));
  } finally {
    await app.close();
  }
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write(error.message);
  } else if (
    error instanceof InvalidConfigError ||
    error instanceof AuthError
  ) {
    process.stderr.write(`${error.message}\n`);
  } else {
    new Logger('Cli').error(
      `Command failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
    );
  }
  process.exitCode = 1;
}
