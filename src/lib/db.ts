import { neon } from '@neondatabase/serverless';

/**
 * Creates a Neon SQL client for database operations.
 * Uses the serverless HTTP driver — ideal for Next.js API routes.
 */
export function getDb() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error("DATABASE_URL is not set in environment variables");
    }

    return neon(databaseUrl);
}

/**
 * Helper to generate UUID v4
 */
export function generateId(): string {
    return crypto.randomUUID();
}
