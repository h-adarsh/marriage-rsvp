import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();
const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
const connectionUri = isTestEnv
  ? (process.env.DATABASE_TEST_URL || 'mysql://root:password@localhost:3306/wedding_rsvp_test')
  : (process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/wedding_rsvp');

// Safety guard: prevent tests from ever running against development or production databases
if (isTestEnv && !connectionUri.match(/\/([^/?]+_test)(\?.*)?$/)) {
  throw new Error(
    `Test safety violation: Test suite refuses to run against non-test database: "${connectionUri}". Database name must end in '_test'.`
  );
}


// Create a connection pool with UTC timezone to match JavaScript Date objects and prevent clock drift
export const pool = mysql.createPool({
  uri: connectionUri,
  timezone: 'Z',
});

// Instantiate Drizzle ORM with complete schema for relational queries
export const db = drizzle(pool, { schema, mode: 'default' });

export * from './schema';
