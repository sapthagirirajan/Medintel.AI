const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
  /\/$/,
  ''
);
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export async function fetchMedicalPreview(limit = 12, datasetGroup) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const url = new URL(`${supabaseUrl}/rest/v1/medical_chunks`);
  url.searchParams.set(
    'select',
    'id,dataset_group,record_type,source_file,record_title,summary,content,metadata,created_at'
  );
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', String(limit));
  if (datasetGroup) {
    url.searchParams.set('dataset_group', `eq.${datasetGroup}`);
  }

  const response = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase preview request failed: ${response.status}`);
  }

  return response.json();
}

// Local embedding and RPC query for client-side retrieval (uses anon key)
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
  for (const value of vector) {
    magnitude += value * value;
  }

  if (magnitude === 0) {
    return vector;
  }

  const scale = 1 / Math.sqrt(magnitude);
  return vector.map((value) => value * scale);
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

async function getQueryEmbedding(text) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  if (apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text
        })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data[0] && result.data[0].embedding) {
          return result.data[0].embedding;
        }
      }
    } catch (err) {
      console.warn('OpenAI embedding fetch failed, using local n-gram fallback:', err);
    }
  }
  return localEmbedding(text);
}

export async function queryMedicalIndex(query, datasetGroup = null, matchCount = 6) {
  if (!isSupabaseConfigured) return [];
  try {
    const embedding = await getQueryEmbedding(query);
    const endpoint = `${supabaseUrl}/rest/v1/rpc/match_medical_chunks`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query_embedding: embedding, match_count: matchCount, dataset_group_filter: datasetGroup })
    });

    if (!response.ok) {
      throw new Error(`RPC failed: ${response.status}`);
    }

    return response.json();
  } catch (err) {
    console.warn('queryMedicalIndex failed, falling back to empty result', err.message);
    return [];
  }
}
