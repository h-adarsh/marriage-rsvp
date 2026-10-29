import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, pool } from './index';
import path from 'path';

async function runMigrations() {
  console.log('[migrate] Applying database migrations...');
  const migrationsFolder = path.resolve(__dirname, './migrations');
  await migrate(db, { migrationsFolder });
  console.log('[migrate] Migrations applied successfully.');
  await pool.end();
}

runMigrations().catch((err) => {
  console.error('[migrate] Migration error:', err);
  process.exit(1);
});
