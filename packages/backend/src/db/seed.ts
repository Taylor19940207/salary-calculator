import dotenv from 'dotenv';
import { getDb, closeDb } from './connection.js';
import { runSeed } from './setup.js';

dotenv.config();

async function seed() {
  try {
    console.log('🌱 Seeding database...');
    await runSeed(await getDb());
    console.log('✅ Database seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

seed();
