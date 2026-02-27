// Migration runner using Neon serverless driver
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  console.log('Connecting to database...');
  const sql = neon(databaseUrl);
  
  const migrationFile = path.join(__dirname, '..', 'migrations', '001_lakecity_accounting_suite.sql');
  
  console.log(`Reading migration file: ${migrationFile}`);
  const migrationSql = fs.readFileSync(migrationFile, 'utf8');
  
  // Split SQL into individual statements
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  console.log(`Found ${statements.length} SQL statements to execute`);
  console.log('Running migration...\n');
  
  try {
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      const shortPreview = statement.substring(0, 60).replace(/\n/g, ' ') + '...';
      process.stdout.write(`[${i + 1}/${statements.length}] ${shortPreview}`);
      
      try {
        await sql.unsafe(statement);
        console.log(' ✓');
      } catch (err) {
        console.log(' ✗');
        console.error(`\nError on statement ${i + 1}:`, err.message);
        // Continue with next statement (some may fail if objects already exist)
        if (!err.message.includes('already exists') && !err.message.includes('does not exist')) {
          throw err;
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
