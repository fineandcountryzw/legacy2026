// Script to apply database migrations
const { getDb } = require('../src/lib/db');
const fs = require('fs');
const path = require('path');

const sql = getDb();

async function applyMigration() {
  try {
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_create_users_table.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon to execute statements individually
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      if (statement.startsWith('--')) continue;
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
