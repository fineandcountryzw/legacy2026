// Script to apply database migrations
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function applyMigration() {
  try {
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_create_users_table.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon to execute statements individually
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await sql.unsafe(statement + ';');
    }
    
    console.log('✅ Migration applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

applyMigration();
