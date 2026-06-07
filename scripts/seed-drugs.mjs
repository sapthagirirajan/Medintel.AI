import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const csvPath = path.join(projectRoot, 'Dataset', 'Drugs', 'combined_medicines.csv');

dotenv.config({ path: path.join(projectRoot, '.env') });

function firstValidUrl(values) {
  for (const value of values) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return value;
      }
    } catch {
      // Ignore non-URL values.
    }
  }
  return '';
}

const supabaseUrl = firstValidUrl([
  process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL
]);
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const maxRows = Number.parseInt(String(process.env.MAX_ROWS || '1000').replace(/[^0-9]/g, ''), 10);
const batchSize = Number.parseInt(process.env.BATCH_SIZE || '64', 10);
const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is required.');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to insert into Supabase.');
}

if (!openaiApiKey) {
  throw new Error('OPENAI_API_KEY is required to generate embeddings.');
}

if (!fs.existsSync(csvPath)) {
  throw new Error(`CSV file not found: ${csvPath}`);
}

const openai = new OpenAI({ apiKey: openaiApiKey });

function cleanValue(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : '';
}

function firstText(row, keys) {
  for (const key of keys) {
    const value = cleanValue(row[key]);
    if (value) return value;
  }
  return '';
}

function buildDocument(row) {
  const genericName = firstText(row, ['generic_name', 'generic', 'name']);
  const drugName = firstText(row, ['name', 'brand', 'generic_name']);
  const brand = firstText(row, ['brand']);
  const form = firstText(row, ['form', 'dosage']);
  const route = firstText(row, ['route']);
  const strength = firstText(row, ['strength']);
  const uses = firstText(row, ['uses', 'indications', 'meta_use1', 'meta_use2', 'meta_use3', 'meta_use4']);
  const sideEffects = firstText(row, ['side_effects', 'meta_contraindications', 'meta_sideeffect1', 'meta_sideeffect2', 'meta_sideeffect3']);
  const availability = firstText(row, ['availability']);
  const sourceFile = firstText(row, ['source']) || 'Dataset/Drugs/combined_medicines.csv';
  const drugClass = firstText(row, ['meta_drug_class', 'meta_therapeutic_class', 'meta_action_class']);
  const interactions = firstText(row, ['meta_interaction_warnings_&_precautions']);
  const storage = firstText(row, ['meta_storage_conditions']);
  const pregnancy = firstText(row, ['meta_pregnancy_category']);
  const reference = firstText(row, ['meta_reference']);

  const summaryParts = [
    genericName || drugName,
    drugClass && `Class: ${drugClass}`,
    form && `Form: ${form}`,
    route && `Route: ${route}`,
    strength && `Strength: ${strength}`,
    uses && `Use: ${uses}`,
    sideEffects && `Side effects: ${sideEffects}`,
    interactions && `Interactions: ${interactions}`,
    storage && `Storage: ${storage}`,
    pregnancy && `Pregnancy: ${pregnancy}`,
    reference && `Reference: ${reference}`
  ].filter(Boolean);

  return {
    source_file: sourceFile,
    drug_name: drugName || genericName,
    generic_name: genericName || drugName,
    brand: brand || null,
    form: form || null,
    route: route || null,
    strength: strength || null,
    summary: summaryParts.slice(0, 5).join(' | '),
    content: summaryParts.join(' | '),
    uses: uses || null,
    side_effects: sideEffects || null,
    availability: availability || null,
    metadata: {
      source_file: sourceFile,
      drug_class: drugClass || null,
      interactions: interactions || null,
      storage: storage || null,
      pregnancy: pregnancy || null,
      reference: reference || null,
      raw: row
    }
  };
}

async function* readDrugRows(filePath) {
  const parser = fs
    .createReadStream(filePath)
    .pipe(
      parse({
        columns: true,
        bom: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true
      })
    );

  for await (const row of parser) {
    const document = buildDocument(row);
    if (document.generic_name || document.drug_name) {
      yield document;
    }
  }
}

async function createEmbeddings(texts) {
  const response = await openai.embeddings.create({
    model: embeddingModel,
    input: texts
  });

  return response.data.map((item) => item.embedding);
}

async function insertBatch(records) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/drug_chunks`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(records)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase insert failed: ${response.status} ${message}`);
  }
}

async function main() {
  const buffer = [];
  let processed = 0;
  let inserted = 0;

  for await (const document of readDrugRows(csvPath)) {
    buffer.push(document);
    processed += 1;

    if (processed >= maxRows) {
      break;
    }

    if (buffer.length >= batchSize) {
      const embeddings = await createEmbeddings(buffer.map((item) => item.content));
      const rows = buffer.map((item, index) => ({ ...item, embedding: embeddings[index] }));
      await insertBatch(rows);
      inserted += rows.length;
      buffer.length = 0;
      console.log(`Inserted ${inserted} drug chunks so far.`);
    }
  }

  if (buffer.length > 0) {
    const embeddings = await createEmbeddings(buffer.map((item) => item.content));
    const rows = buffer.map((item, index) => ({ ...item, embedding: embeddings[index] }));
    await insertBatch(rows);
    inserted += rows.length;
  }

  console.log(`Finished seeding ${inserted} drug-only embeddings into Supabase.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
