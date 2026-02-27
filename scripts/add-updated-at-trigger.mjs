import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const sql = neon(databaseUrl);

async function addTrigger() {
  try {
    // Create function to update updated_at
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `;
    console.log('✅ Function update_updated_at_column created');
    
    // Create trigger for users table
    await sql`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users
    `;
    await sql`
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `;
    console.log('✅ Trigger for users table created');
    
    console.log('\n🎉 Trigger setup complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

addTrigger();
