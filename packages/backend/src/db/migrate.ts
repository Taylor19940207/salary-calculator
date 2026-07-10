import dotenv from 'dotenv';
import { getDb, closeDb } from './connection.js';
import { runMigrations } from './setup.js';

dotenv.config();

async function migrate() {
  try {
    console.log('🔄 Running database migrations...');
    await runMigrations(await getDb());
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

migrate();
