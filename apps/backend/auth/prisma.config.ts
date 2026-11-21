import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Migrations run with the migration role (D04). `prisma generate` needs no database,
  // so the URL may be empty at build time and `migrate deploy` fails without it.
  datasource: { url: process.env['MIGRATION_DATABASE_URL'] ?? '' },
});
