import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();
const isTest = process.env.NODE_ENV === 'test';
const defaultUri = isTest
  ? (process.env.DATABASE_TEST_URL || 'mysql://root:password@localhost:3306/wedding_rsvp_test')
  : (process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/wedding_rsvp');

const connectionUri = isTest && process.env.DATABASE_TEST_URL
  ? process.env.DATABASE_TEST_URL
  : defaultUri;

// Create a connection pool for efficient query execution
export const pool = mysql.createPool(connectionUri);

// Instantiate Drizzle ORM with complete schema for relational queries
export const db = drizzle(pool, { schema, mode: 'default' });

export * from './schema';
