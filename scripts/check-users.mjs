import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const sql = neon(databaseUrl);

async function checkUsers() {
  try {
    const users = await sql`SELECT id, email, clerk_id, role FROM users`;
    console.log('Current users:', users);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkUsers();
