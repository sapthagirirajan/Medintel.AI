import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const k = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!url || !k) {
  console.error('MISSING_SUPABASE_ENV');
  process.exit(2);
}

const endpoint = `${url.replace(/\/$/, '')}/rest/v1/medical_chunks?select=id&limit=1`;

(async () => {
  try {
    const res = await fetch(endpoint, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
    console.log('status', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
    } else {
      const text = await res.text();
      console.log(text);
    }
  } catch (err) {
    console.error('err', err.message);
    process.exitCode = 1;
  }
})();
