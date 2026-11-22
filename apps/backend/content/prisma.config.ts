import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // The CLI migrates with the migration role (D04). `prisma generate` runs at
  // build time without a database, so the URL stays optional here and
  // `migrate deploy` fails if it is empty.
  datasource: { url: process.env['MIGRATION_DATABASE_URL'] ?? '' },
});
