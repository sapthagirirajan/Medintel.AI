import dotenv from 'dotenv';
import path from 'node:path';
import fetch from 'node-fetch';
import OpenAI from 'openai';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseAnon || !openaiApiKey) {
  console.error('Please set SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and OPENAI_API_KEY in .env');
  process.exit(2);
}

const openai = new OpenAI({ apiKey: openaiApiKey });

async function getOpenAIEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
}

async function query(queryText, matchCount = 6) {
  const embedding = await getOpenAIEmbedding(queryText);
  const endpoint = `${supabaseUrl}/rest/v1/rpc/match_medical_chunks`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${supabaseAnon}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query_embedding: embedding, match_count: matchCount })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RPC call failed: ${res.status} ${text}`);
  }
  return res.json();
}

(async () => {
  try {
    const queries = ['Acyclovir tablet uses', 'What are LCM symptoms?', 'echocardiogram findings'];
    for (const q of queries) {
      console.log('\n=== Query with OpenAI Embedding:', q);
      const results = await query(q, 3);
      console.log(JSON.stringify(results, null, 2));
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
