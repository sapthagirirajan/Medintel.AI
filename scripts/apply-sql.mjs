import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const sqlPath = path.join(process.cwd(), 'supabase', 'medical_rag.sql');
const conn = process.argv[2] || process.env.PSQL_CONN || process.env.SUPABASE_DB_CONN;

if (!conn) {
  console.error('Usage: node scripts/apply-sql.mjs <connection-string>');
  process.exit(1);
}

if (!fs.existsSync(sqlPath)) {
  console.error('SQL file not found:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

(async () => {
  const client = new Client({ connectionString: conn });
  try {
    await client.connect();
    console.log('Connected to DB. Applying SQL...');
    await client.query(sql);
    console.log('SQL applied successfully.');
  } catch (err) {
    console.error('Failed to apply SQL:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
