import dotenv from 'dotenv';
import path from 'node:path';
import fetch from 'node-fetch';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseAnon) {
  console.error('Missing supabase URL or anon key in .env');
  process.exit(2);
}

const embeddingDimensions = 1536;
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function normalizeVector(vector) {
  let magnitude = 0;
  for (const value of vector) magnitude += value * value;
  if (magnitude === 0) return vector;
  const scale = 1 / Math.sqrt(magnitude);
  return vector.map((v) => v * scale);
}
function localEmbedding(text) {
  const vector = new Array(embeddingDimensions).fill(0);
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) return vector;
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const source = words.length > 0 ? words : [normalized];
  for (const token of source) {
    const tokenHash = hashString(token);
    const primaryIndex = tokenHash % embeddingDimensions;
    const secondaryIndex = (tokenHash >>> 8) % embeddingDimensions;
    const tertiaryIndex = (tokenHash >>> 16) % embeddingDimensions;
    vector[primaryIndex] += 1.0;
    vector[secondaryIndex] += 0.5;
    vector[tertiaryIndex] += 0.25;
  }
  for (let index = 0; index < normalized.length - 2; index += 1) {
    const trigram = normalized.slice(index, index + 3);
    const trigramHash = hashString(trigram);
    vector[trigramHash % embeddingDimensions] += 0.1;
  }
  return normalizeVector(vector);
}

async function query(q, matchCount = 3) {
  const embedding = localEmbedding(q);
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

function formatReply(query, rows) {
  if (!rows || rows.length === 0) return 'No matches found in the medical index.';
  const lines = rows.slice(0,3).map(r => `${r.record_title || 'Record'} [${r.dataset_group}/${r.record_type}]\n${r.summary || r.content || ''}`);
  return `Medical match found:\n\n${lines.join('\n\n')}`;
}

(async () => {
  try {
    const queries = process.argv.slice(2);
    if (queries.length === 0) queries.push('Acyclovir tablet uses');
    for (const q of queries) {
      console.log('\n=== User query:', q);
      const rows = await query(q, 6);
      console.log(formatReply(q, rows));
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
