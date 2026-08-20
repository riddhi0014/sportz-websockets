// check-schema.js
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query(`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_name = 'commentary'
  ORDER BY ordinal_position;
`);
console.table(result.rows);
await pool.end();