import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/poker';

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export * from './schema';
export { eq, and, or, desc, asc, sql, gte, lte, ne, inArray } from 'drizzle-orm';
