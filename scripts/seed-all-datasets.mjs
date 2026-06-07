import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const datasetRoot = path.join(projectRoot, 'Dataset');

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
const maxRowsRaw = Number.parseInt(String(process.env.MAX_ROWS || '').replace(/[^0-9]/g, ''), 10);
const maxRows = Number.isFinite(maxRowsRaw) && maxRowsRaw > 0 ? maxRowsRaw : Number.POSITIVE_INFINITY;
const batchSize = Number.parseInt(process.env.BATCH_SIZE || '64', 10);
const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const embeddingDimensions = 1536;

const ingestionJobs = [
  {
    datasetGroup: 'drugs',
    recordType: 'drug',
    sourceFile: path.join(datasetRoot, 'Drugs', 'combined_medicines.csv'),
    buildDocument: buildDrugDocument
  },
  {
    datasetGroup: 'healthcare',
    recordType: 'clinical',
    sourceFile: path.join(datasetRoot, 'Healthcare', 'combined_all_datasets.csv'),
    buildDocument: buildHealthcareDocument
  },
  {
    datasetGroup: 'qa',
    recordType: 'question_answer',
    sourceFile: path.join(datasetRoot, 'q&a', 'train.csv'),
    buildDocument: buildQaTrainDocument
  },
  {
    datasetGroup: 'qa',
    recordType: 'medical_transcript',
    sourceFile: path.join(datasetRoot, 'q&a', 'mtsamples.csv'),
    buildDocument: buildMtsamplesDocument
  }
];

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is required.');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to insert into Supabase.');
}

if (!openaiApiKey) {
  throw new Error('OPENAI_API_KEY is required to generate embeddings.');
}

const openai = new OpenAI({ apiKey: openaiApiKey });

function cleanValue(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : '';
}

function cleanHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/^"+|"+$/g, '')
    .replace(/^'+|'+$/g, '')
    .trim();
}

function firstText(row, keys) {
  for (const key of keys) {
    const value = cleanValue(row[key]);
    if (value) return value;
  }
  return '';
}

function nonEmptyFieldPairs(row, excludedKeys = []) {
  const excluded = new Set(excludedKeys.map((key) => key.toLowerCase()));
  return Object.entries(row)
    .map(([key, value]) => [cleanHeader(key), cleanValue(value)])
    .filter(([key, value]) => key && value && !excluded.has(key.toLowerCase()));
}

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
  const normalized = cleanValue(text).toLowerCase();

  if (!normalized) {
    return vector;
  }

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

function createRecord({ datasetGroup, recordType, sourceFile, recordTitle, summaryParts, contentParts, metadata, row }) {
  const relativeSourceFile = path.relative(projectRoot, sourceFile).split(path.sep).join('/');
  const summary = summaryParts.filter(Boolean).slice(0, 5).join(' | ');
  const content = contentParts.filter(Boolean).join(' | ');

  return {
    dataset_group: datasetGroup,
    record_type: recordType,
    source_file: relativeSourceFile,
    record_title: recordTitle || `${datasetGroup} record`,
    summary: summary || content.slice(0, 500),
    content: content || summary || recordTitle || 'No content available.',
    metadata: {
      dataset_group: datasetGroup,
      record_type: recordType,
      source_file: relativeSourceFile,
      record_title: recordTitle || null,
      ...metadata,
      raw: row
    }
  };
}

function buildDrugDocument(row, context) {
  const genericName = firstText(row, ['generic_name', 'generic', 'name']);
  const drugName = firstText(row, ['name', 'brand', 'generic_name']);
  const brand = firstText(row, ['brand']);
  const form = firstText(row, ['form', 'dosage']);
  const route = firstText(row, ['route']);
  const strength = firstText(row, ['strength']);
  const uses = firstText(row, ['uses', 'indications', 'meta_use1', 'meta_use2', 'meta_use3', 'meta_use4']);
  const sideEffects = firstText(row, ['side_effects', 'meta_contraindications', 'meta_sideeffect1', 'meta_sideeffect2', 'meta_sideeffect3']);
  const availability = firstText(row, ['availability']);
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
  ];

  return createRecord({
    datasetGroup: context.datasetGroup,
    recordType: context.recordType,
    sourceFile: context.sourceFile,
    recordTitle: genericName || drugName,
    summaryParts,
    contentParts: [
      genericName || drugName,
      brand && `Brand: ${brand}`,
      drugClass && `Class: ${drugClass}`,
      form && `Form: ${form}`,
      route && `Route: ${route}`,
      strength && `Strength: ${strength}`,
      uses && `Use: ${uses}`,
      sideEffects && `Side effects: ${sideEffects}`,
      interactions && `Interactions: ${interactions}`,
      storage && `Storage: ${storage}`,
      pregnancy && `Pregnancy: ${pregnancy}`,
      availability && `Availability: ${availability}`,
      reference && `Reference: ${reference}`
    ],
    metadata: {
      brand: brand || null,
      form: form || null,
      route: route || null,
      strength: strength || null,
      uses: uses || null,
      side_effects: sideEffects || null,
      availability: availability || null,
      drug_class: drugClass || null,
      interactions: interactions || null,
      storage: storage || null,
      pregnancy: pregnancy || null,
      reference: reference || null
    },
    row
  });
}

function buildHealthcareDocument(row, context) {
  const title = firstText(row, [
    'Disease',
    'Medical Condition',
    'Name',
    'Symptoms',
    'Diagnosis',
    'Medication',
    'Patient_ID',
    'Doctor',
    'Hospital'
  ]);

  const fieldPairs = nonEmptyFieldPairs(row, ['SourceFile']);
  return createRecord({
    datasetGroup: context.datasetGroup,
    recordType: context.recordType,
    sourceFile: context.sourceFile,
    recordTitle: title,
    summaryParts: [title, firstText(row, ['Symptoms', 'Medical Condition', 'Diagnosis']), firstText(row, ['Medication'])],
    contentParts: [title, ...fieldPairs.map(([key, value]) => `${key}: ${value}`)],
    metadata: {
      source_file_hint: firstText(row, ['SourceFile']) || null
    },
    row
  });
}

function buildQaTrainDocument(row, context) {
  const question = firstText(row, ['Question']);
  const answer = firstText(row, ['Answer']);
  const qType = firstText(row, ['qtype', 'type']);

  return createRecord({
    datasetGroup: context.datasetGroup,
    recordType: context.recordType,
    sourceFile: context.sourceFile,
    recordTitle: question,
    summaryParts: [qType, question, answer],
    contentParts: [
      qType && `Type: ${qType}`,
      question && `Question: ${question}`,
      answer && `Answer: ${answer}`
    ],
    metadata: {
      qtype: qType || null,
      question: question || null
    },
    row
  });
}

function buildMtsamplesDocument(row, context) {
  const sampleName = firstText(row, ['sample_name']);
  const description = firstText(row, ['description']);
  const specialty = firstText(row, ['medical_specialty']);
  const transcription = firstText(row, ['transcription']);
  const keywords = firstText(row, ['keywords']);

  return createRecord({
    datasetGroup: context.datasetGroup,
    recordType: context.recordType,
    sourceFile: context.sourceFile,
    recordTitle: sampleName || description,
    summaryParts: [specialty, sampleName || description, keywords],
    contentParts: [
      specialty && `Specialty: ${specialty}`,
      sampleName && `Sample: ${sampleName}`,
      description && `Description: ${description}`,
      transcription && `Transcription: ${transcription}`,
      keywords && `Keywords: ${keywords}`
    ],
    metadata: {
      sample_name: sampleName || null,
      medical_specialty: specialty || null,
      keywords: keywords || null
    },
    row
  });
}

async function* readCsvRows(filePath) {
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
    yield row;
  }
}

async function createEmbeddings(texts) {
  try {
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is missing');
    }

    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: texts
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.warn(`OpenAI embeddings unavailable, using local fallback: ${error.message}`);
    return texts.map((text) => localEmbedding(text));
  }
}

async function insertBatch(records) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/medical_chunks`, {
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

function assertSourceExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset file not found: ${filePath}`);
  }
}

async function ingestJob(job, maxRowsPerJob) {
  assertSourceExists(job.sourceFile);
  console.log(`\n--- Starting Ingestion: ${job.datasetGroup} / ${job.recordType} ---`);

  const buffer = [];
  let jobProcessed = 0;
  let jobInserted = 0;
  for await (const row of readCsvRows(job.sourceFile)) {
    if (jobProcessed >= maxRowsPerJob) {
      break;
    }

    const document = job.buildDocument(row, job);
    if (!document.content) {
      continue;
    }

    buffer.push(document);
    jobProcessed += 1;

    if (buffer.length >= batchSize) {
      const embeddings = await createEmbeddings(buffer.map((item) => item.content));
      const rows = buffer.map((item, index) => ({ ...item, embedding: embeddings[index] }));
      await insertBatch(rows);
      jobInserted += rows.length;
      buffer.length = 0;
      console.log(`Inserted ${jobInserted} embedded records so far for ${job.recordType}.`);
    }
  }

  if (buffer.length > 0) {
    const embeddings = await createEmbeddings(buffer.map((item) => item.content));
    const rows = buffer.map((item, index) => ({ ...item, embedding: embeddings[index] }));
    await insertBatch(rows);
    jobInserted += rows.length;
  }

  console.log(`Finished job: ${job.recordType}. Successfully inserted ${jobInserted} records.`);
  return jobInserted;
}

async function main() {
  const maxRowsPerJob = Number.isFinite(maxRows) ? maxRows : 500;
  console.log(`=== MedIntel Dataset Ingestion Started ===`);
  console.log(`Limit: ${maxRowsPerJob} records per dataset group.`);
  
  let totalInserted = 0;

  for (const job of ingestionJobs) {
    const inserted = await ingestJob(job, maxRowsPerJob);
    totalInserted += inserted;
  }

  console.log(`\n=== Seeding Finished! Total successfully inserted: ${totalInserted} records into Supabase. ===`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});