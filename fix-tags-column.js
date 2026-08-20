import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`ALTER TABLE "commentary" DROP COLUMN "tags";`);
await pool.query(`ALTER TABLE "commentary" ADD COLUMN "tags" text[];`);

console.log('Done — tags column recreated as text[]');
await pool.end();