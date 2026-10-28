import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();

const connectionUri = process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/wedding_rsvp';

// Create a connection pool for efficient query execution
export const pool = mysql.createPool(connectionUri);

// Instantiate Drizzle ORM with complete schema for relational queries
export const db = drizzle(pool, { schema, mode: 'default' });

export * from './schema';
