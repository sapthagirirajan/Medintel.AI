import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  LayoutDashboard, 
  Sparkles, 
  Users, 
  FileText, 
  Activity, 
  ScanLine, 
  Pill, 
  Heart, 
  History as HistoryIcon, 
  Settings as SettingsIcon, 
  ArrowRight, 
  Database, 
  LoaderCircle, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Upload, 
  Trash2, 
  Calendar, 
  User, 
  Eye, 
  ArrowUpRight, 
  Search, 
  Mic, 
  Check, 
  X, 
  RefreshCw 
} from 'lucide-react';
import { drugPreview } from './data/drugPreview.js';
import { fetchMedicalPreview, isSupabaseConfigured, queryMedicalIndex } from './lib/drugStore.js';

// Import real image assets served by Vite
import logoImg from '../assets/logo.png';
import robotImg from '../assets/robot.png';
import brainImg from '../assets/brain.png';
import pyramidImg from '../assets/pyramid.png';
import diamondImg from '../assets/diamond.png';

// Lightweight pure React markdown parser to structure chatbot replies elegantly
function parseMarkdownText(text) {
  if (!text) return '';
  
  const lines = String(text).split('\n');
  let insideList = false;
  const elements = [];

  lines.forEach((line, idx) => {
    let cleanLine = line.trim();
    if (!cleanLine) {
      if (insideList) {
        insideList = false;
      }
      elements.push(<div key={`br-${idx}`} style={{ height: '6px' }} />);
      return;
    }

    // Replace ==highlight== with yellow marker highlights first
    let htmlContent = cleanLine
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/==([^=]+)==/g, '<mark class="chat-text-highlight">$1</mark>');

    // Replace specialized medical headers and warnings with premium clinical badges
    htmlContent = htmlContent
      .replace(/📁\s*<strong>Source Reference<\/strong>|📁\s*Source Reference/g, '<span class="badge-clinical badge-source">📁 Source Reference</span>')
      .replace(/🩺\s*<strong>Clinical Diagnostic Guidelines<\/strong>|🩺\s*Clinical Diagnostic Guidelines/g, '<span class="badge-clinical badge-guidelines">🩺 Clinical Diagnostic Guidelines</span>')
      .replace(/💊\s*<strong>Treatment & Dosage Protocols<\/strong>|💊\s*Treatment & Dosage Protocols/g, '<span class="badge-clinical badge-protocols">💊 Treatment & Dosage Protocols</span>')
      .replace(/⚠️\s*<strong>Critical Precautions & Contraindications<\/strong>|⚠️\s*Critical Precautions & Contraindications/g, '<span class="badge-clinical badge-precautions">⚠️ Critical Precautions</span>')
      .replace(/⚠️\s*<strong>Critical Precautions<\/strong>/g, '<span class="badge-clinical badge-precautions">⚠️ Critical Precautions</span>')
      .replace(/(CRITICAL WARNING:)/g, '<span class="badge-alert-critical">$1</span>')
      .replace(/(WARNING:)/g, '<span class="badge-alert-warning">$1</span>');

    // Parse list items
    if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
      insideList = true;
      const parsedContent = htmlContent.slice(2);
      elements.push(
        <li key={`li-${idx}`} className="chat-li-item" dangerouslySetInnerHTML={{ __html: parsedContent }} />
      );
      return;
    }

    // If we were inside a list but this line is not a list item
    if (insideList) {
      insideList = false;
    }

    // Parse headers
    if (cleanLine.startsWith('### ')) {
      const headerText = cleanLine.slice(4).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      elements.push(
        <h3 key={`h3-${idx}`} className="chat-h3-item" dangerouslySetInnerHTML={{ __html: headerText }} />
      );
      return;
    }

    if (cleanLine.startsWith('## ')) {
      const headerText = cleanLine.slice(3).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      elements.push(
        <h2 key={`h2-${idx}`} className="chat-h2-item" dangerouslySetInnerHTML={{ __html: headerText }} />
      );
      return;
    }

    // Parse basic paragraphs
    elements.push(
      <p key={`p-${idx}`} className="chat-p-item" dangerouslySetInnerHTML={{ __html: htmlContent }} />
    );
  });

  return <div className="chat-message-content">{elements}</div>;
}

// Extremely rich offline dataset for medical RAG fallbacks.
// Spans diagnoses, clinical questions, specialties, and clinical transcripts.
const offlineClinicalIndex = [
  // 1. Healthcare / Diagnoses
  {
    id: 'fever-profile',
    record_title: 'Clinical Profile: Fever (General Pyrexia) Guidelines',
    dataset_group: 'healthcare',
    record_type: 'clinical',
    summary: 'Clinical guidelines for general pyrexia assessment, fever symptoms, warning signs, and standard supportive care.',
    content: 'Fever (pyrexia) is an elevation of body temperature above the normal daily variation (>38°C or 100.4°F). Common symptoms associated with fever include chills, shivering, diaphoresis (sweating), headache, generalized myalgia, anorexia, fatigue, and mild dehydration. Assessment requires checking core body temperature, cardiovascular status, and localized focus. High-risk warning signs (red flags) include stiff neck (meningitis sign), confusion, dyspnea, petechial rash, and temperature >40°C (104°F). Treatment involves supportive care, maintaining oral hydration, and antipyretics such as acetaminophen (paracetamol) 500-1000 mg every 4-6 hours or ibuprofen 200-400 mg every 6 hours as clinically indicated.',
    source_file: 'Dataset/Healthcare/combined_all_datasets.csv',
    metadata: { author: 'WHO Clinical Protocols', specialty: 'Internal Medicine / Family Practice' }
  },
  {
    id: 'cough-respiratory',
    record_title: 'Clinical Protocol: Acute Cough & Respiratory Symptoms',
    dataset_group: 'healthcare',
    record_type: 'clinical',
    summary: 'Clinical diagnosis pathway for acute cough, bronchitis, and common respiratory infection symptoms.',
    content: 'Acute cough is a frequent clinical symptom usually caused by upper respiratory tract infections (URTIs), acute bronchitis, or allergic rhinitis. Associated symptoms include nasal congestion, rhinorrhea, sore throat, sneezing, fatigue, and low-grade fever. Standard clinical guidance: assess respiratory rate, chest auscultation for wheezing or crackles. Supportive treatment includes hydration, warm fluids, throat lozenges, and vaporizers. Pharmacological management may include cough suppressants (dextromethorphan) or expectorants (guaifenesin). Warning signs: hemoptysis, shortness of breath, prolonged high fever, or asymmetric chest expansion.',
    source_file: 'Dataset/Healthcare/combined_all_datasets.csv',
    metadata: { author: 'American College of Chest Physicians', specialty: 'Pulmonology / Family Medicine' }
  },
  {
    id: 'lcm-disease',
    record_title: 'Lymphocytic Choriomeningitis (LCM)',
    dataset_group: 'healthcare',
    record_type: 'clinical',
    summary: 'Aseptic meningitis or encephalitis clinical profile. Rodent-borne LCM virus infection.',
    content: 'Lymphocytic choriomeningitis (LCM) is a rodent-borne viral infectious disease that presents as aseptic meningitis or encephalitis. Symptoms include biphasic fever, malaise, headache, myalgia, nausea, and vomiting. Diagnosis is confirmed via detection of LCMV antibodies or PCR in CSF. Treatment is primarily supportive; ribavirin may be considered in severe neurological cases.',
    source_file: 'Dataset/Healthcare/combined_all_datasets.csv',
    metadata: { author: 'CDC Clinical Guidelines', specialty: 'Infectious Disease' }
  },
  {
    id: 'bariatric-study',
    record_title: 'Bariatric Gastric Bypass Post-Op Pathway',
    dataset_group: 'healthcare',
    record_type: 'clinical',
    summary: 'Follow-up clinical pathway for post-op gastric bypass. 42-year-old female progress.',
    content: 'Bariatric surgery clinical pathway. Follow-up study on a 42-year-old female patient after Roux-en-Y gastric bypass. 12-month post-op check shows excellent progress. Body Mass Index (BMI) reduced from 43.2 to 28.5. Metabolic markers show complete resolution of type 2 diabetes and significant improvement in essential hypertension.',
    source_file: 'Dataset/Healthcare/combined_all_datasets.csv',
    metadata: { author: 'American Society for Metabolic Surgery', specialty: 'Bariatrics' }
  },
  {
    id: 'cardiology-tte',
    record_title: 'Transthoracic Echocardiogram (TTE) Findings',
    dataset_group: 'healthcare',
    record_type: 'clinical',
    summary: 'Echocardiogram clinical study. 58% ejection fraction with mild mitral regurgitation.',
    content: 'Transthoracic Echocardiogram (TTE) clinical finding report: Left ventricular ejection fraction (LVEF) is estimated at 58% (normal range). Left ventricle is normal in size and thickness. Mild mitral valve regurgitation is noted; trace tricuspid regurgitation. Right ventricle is normal. No evidence of intracardiac thrombus or pericardial effusion.',
    source_file: 'Dataset/Healthcare/combined_all_datasets.csv',
    metadata: { author: 'Cardiology Imaging Group', specialty: 'Cardiology' }
  },

  // 2. Q&A / Clinical Questions
  {
    id: 'qa-acyclovir-dose',
    record_title: 'Q&A: Acyclovir Dosage for Herpes Simplex',
    dataset_group: 'qa',
    record_type: 'question_answer',
    summary: 'Clinical Q&A regarding adult dosing guidelines for oral acyclovir in HSV treatment.',
    content: 'Question: What is the recommended dosage for oral Acyclovir in treating herpes simplex? Answer: For initial episodes of herpes simplex virus (HSV) infections (genital or mucocutaneous), the standard adult oral dosage is 400 mg three times daily (or 200 mg five times daily while awake) for 7 to 10 days. Recurrent episodes typically require 400 mg three times daily for 5 days.',
    source_file: 'Dataset/q&a/train.csv',
    metadata: { qtype: 'Dosage', target: 'Acyclovir' }
  },
  {
    id: 'qa-statin-myalgia',
    record_title: 'Q&A: Statin-Induced Myalgia Symptoms',
    dataset_group: 'qa',
    record_type: 'question_answer',
    summary: 'Clinical Q&A outlining atorvastatin side effects, muscle pain, and liver monitoring.',
    content: 'Question: Describe common side effects of statins like Atorvastatin. Answer: Common side effects of atorvastatin include myalgia (muscle pain), headache, mild elevation in liver enzymes (ALT/AST), and gastrointestinal symptoms. In rare instances (less than 0.1%), it can cause severe rhabdomyolysis. Regular liver function testing is advised if symptoms occur.',
    source_file: 'Dataset/q&a/train.csv',
    metadata: { qtype: 'Side Effects', target: 'Atorvastatin' }
  },

  // 3. Q&A / Medical Transcripts (Specialties)
  {
    id: 'transcript-migraine',
    record_title: 'Neurology Consultation: Chronic Migraine Case',
    dataset_group: 'qa',
    record_type: 'medical_transcript',
    summary: 'Neurology clinical transcription. Migraine with aura in a 35-year-old female.',
    content: 'Specialty: Neurology. Case Sample: Chronic Migraines. Subjective: A 35-year-old female presents with throbbing headache on the left side, preceded by visual aura and photophobia. Objective: Neurological examination, including cranial nerves, motor, sensory, and cerebellar testing, is completely normal. Assessment: Migraine with aura, uncontrolled. Plan: Initiate oral sumatriptan and magnesium oxide daily.',
    source_file: 'Dataset/q&a/mtsamples.csv',
    metadata: { medical_specialty: 'Neurology', keywords: 'migraine, sumatriptan, headache' }
  },
  {
    id: 'transcript-palpitations',
    record_title: 'Cardiology Consultation: Intermittent PVCs Case',
    dataset_group: 'qa',
    record_type: 'medical_transcript',
    summary: 'Cardiology clinical transcription. 54-year-old male with PVCs EKG profile.',
    content: 'Specialty: Cardiology. Case Sample: Palpitations assessment. Subjective: A 54-year-old male complains of intermittent fluttering sensations in his chest. Objective: Heart sounds are clear. EKG shows normal sinus rhythm with occasional premature ventricular contractions (PVCs). Assessment: Intermittent PVCs, benign. Plan: Limit caffeine intake, follow up with 24-hour Holter monitor.',
    source_file: 'Dataset/q&a/mtsamples.csv',
    metadata: { medical_specialty: 'Cardiology', keywords: 'palpitations, PVCs, EKG' }
  }
];

// Combine drug previews with general mock RAG indices
const fullFallbackCollection = [
  ...offlineClinicalIndex,
  ...drugPreview.map((item) => ({
    id: `drug-${item.id}`,
    record_title: item.generic_name,
    dataset_group: 'drugs',
    record_type: 'drug',
    summary: item.summary,
    content: `Drug Class: ${item.brand || item.name} | Form: ${item.form} | Route: ${item.route} | Strength: ${item.strength} | Use: ${item.uses} | Side effects: ${item.side_effects} | Content: ${item.content}`,
    source_file: 'Dataset/Drugs/combined_medicines.csv',
    metadata: { brand: item.brand, form: item.form, route: item.route, strength: item.strength }
  }))
];

export default function App() {
  const chatEndRef = useRef(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [statusText, setStatusText] = useState('Local preview mode');
  const [rows, setRows] = useState([]);
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [chatLoadStage, setChatLoadStage] = useState(null);

  const handleTiltMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Calculate rotation (-6 to 6 degrees for smooth tilt)
    const rotateX = ((centerY - y) / centerY) * 6;
    const rotateY = ((x - centerX) / centerX) * 6;
    card.style.setProperty('--rx', `${rotateY.toFixed(2)}`);
    card.style.setProperty('--ry', `${rotateX.toFixed(2)}`);
  };

  const handleTiltLeave = (e) => {
    const card = e.currentTarget;
    card.style.setProperty('--rx', '0');
    card.style.setProperty('--ry', '0');
  };

  // Chat/RAG State (AI Assistant)
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: 'Hello Dr. Rohan. I am your RAG Clinical AI Assistant. I can search diagnoses, medical specialties, clinical cases, and medical Q&As in the database to answer your clinical questions.',
      citations: []
    }
  ]);
  const [draft, setDraft] = useState('');
  const [citationsList, setCitationsList] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Drug Interactions State
  const [drugA, setDrugA] = useState('');
  const [drugB, setDrugB] = useState('');
  const [checkingInteractions, setCheckingInteractions] = useState(false);
  const [interactionResult, setInteractionResult] = useState(null);

  // Document Ingestion Queue State
  const [documentsQueue, setDocumentsQueue] = useState([
    { id: 1, name: 'Prescription_Scan.jpg', type: 'image', size: '2.4 MB', date: 'May 18, 2026', status: 'scanned', label: 'IMG' },
    { id: 2, name: 'MRI Brain Report.pdf', type: 'pdf', size: '14.8 MB', date: 'May 17, 2026', status: 'queue', label: 'PDF' }
  ]);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Patient Cohort Database State
  const [patients, setPatients] = useState([
    { id: 'p1', name: 'James Carter', specialty: 'Cardiology Consultation', status: 'checked', date: '28 May, 2026', time: '10:30 AM', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', age: 48, gender: 'Male', vitals: 'BP 128/82, HR 74 bpm, Temp 98.4°F', notes: 'Known history of mild coronary artery disease. Scheduled for follow-up transthoracic echocardiogram.' },
    { id: 'p2', name: 'Emma Watson', specialty: 'Neurology Consultation', status: 'checked', date: '28 May, 2026', time: '02:00 PM', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', age: 35, gender: 'Female', vitals: 'BP 116/70, HR 68 bpm, Temp 98.6°F', notes: 'Presents with chronic migraine headaches with visual aura. Non-responsive to standard ibuprofen.' },
    { id: 'p3', name: 'Robert Fox', specialty: 'General Checkup', status: 'delayed', date: '29 May, 2026', time: '11:30 AM', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', age: 54, gender: 'Male', vitals: 'BP 142/90, HR 80 bpm, Temp 98.1°F', notes: 'Checkup for type 2 diabetes management and cholesterol panel. Reports intermittent chest palpitations.' }
  ]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');

  // Symptom Checker State
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [symptomResult, setSymptomResult] = useState(null);

  // Prescription OCR Scanner State
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  // History Audit log state
  const [auditLogs, setAuditLogs] = useState([
    { id: 101, type: 'RAG Query', detail: 'Vector search for "LCM symptoms" in clinical database', date: 'June 01, 2026, 12:15 PM', status: 'Successful' },
    { id: 102, type: 'Drug Safety', detail: 'Safety interaction checked: aspirin + warfarin (drugs filter)', date: 'June 01, 2026, 11:42 AM', status: 'Interaction Flagged' },
    { id: 103, type: 'OCR Extraction', detail: 'Holographic OCR scan completed on Prescription_Scan.jpg', date: 'June 01, 2026, 09:30 AM', status: 'Completed' }
  ]);

  // Load live Supabase preview on startup
  useEffect(() => {
    let cancelled = false;

    async function loadSupabase() {
      if (!isSupabaseConfigured) {
        setStatusText('Local RAG index loaded (Supabase disconnected)');
        setRows(fullFallbackCollection);
        return;
      }

      setLoadingIndex(true);
      try {
        const previewRows = await fetchMedicalPreview(20);
        if (!cancelled) {
          if (previewRows && previewRows.length > 0) {
            setRows(previewRows);
            setStatusText('Connected to Supabase medical_chunks vector database');
          } else {
            setRows(fullFallbackCollection);
            setStatusText('Supabase empty, using premium local clinical indices');
          }
        }
      } catch (error) {
        if (!cancelled) {
          setRows(fullFallbackCollection);
          setStatusText('Supabase error, using rich local fallback datasets');
        }
      } finally {
        if (!cancelled) {
          setLoadingIndex(false);
        }
      }
    }

    loadSupabase();

    return () => {
      cancelled = true;
    };
  }, []);

  // Instant scroll to bottom prevents browser animation scroll locks
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // Add an audit log entry
  const addAuditLog = (type, detail, status) => {
    const newLog = {
      id: Date.now(),
      type,
      detail,
      date: new Date().toLocaleString(),
      status
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Chat message query to RAG (AI Assistant)
  // Restricts index to healthcare & qa datasets for diagnoses, specialties, clinical queries
  const handleChatSubmit = async (e) => {
    if (e) e.preventDefault();
    const query = draft.trim();
    if (!query) return;

    const userMsg = { id: Date.now(), role: 'user', text: query, citations: [] };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setChatLoading(true);
    setChatLoadStage('vectorizing');

    let hits = [];
    if (isSupabaseConfigured) {
      try {
        // Query the live Supabase vector index
        const supabaseHits = await queryMedicalIndex(query, null, 8);
        const safeHits = Array.isArray(supabaseHits) ? supabaseHits : [];
        // Filter out drugs from the general AI Assistant clinical search
        hits = safeHits.filter(hit => hit && hit.dataset_group !== 'drugs');
      } catch (err) {
        hits = [];
      }
    }
    setChatLoadStage('matching');
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Local semantic matching fallback
    if (hits.length === 0) {
      const normalizedQuery = query.toLowerCase().replace(/[?.!,;]/g, '');
      const stopWords = new Set(['what', 'is', 'the', 'are', 'a', 'an', 'and', 'for', 'or', 'in', 'of', 'to', 'with', 'about', 'how', 'describe', 'you', 'me', 'tell', 'show', 'check', 'any', 'disease', 'condition', 'treatment', 'symptom', 'symptoms']);
      const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
      const filteredWords = queryWords.filter(word => !stopWords.has(word));
      const wordsToUse = filteredWords.length > 0 ? filteredWords : queryWords;

      hits = fullFallbackCollection
        .filter(item => item.dataset_group !== 'drugs') // Keep healthcare & qa only
        .map(item => {
          let score = 0;
          const contentText = (item.record_title + ' ' + item.summary + ' ' + item.content).toLowerCase();
          for (const word of wordsToUse) {
            if (contentText.includes(word)) score += 5;
            if (item.record_title.toLowerCase().includes(word)) score += 10;
          }
          return { ...item, similarity: score > 0 ? Math.min(0.5 + score / 100, 0.98) : 0 };
        })
        .filter(item => item.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 4);
    }

    // Set citations in real-time
    setCitationsList(hits);

    setChatLoadStage('synthesizing');
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Dynamic Clinical Summary Generator based on semantic RAG citations (OpenAI-powered)
    let replyText = '';
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    if (apiKey && hits.length > 0) {
      try {
        const systemPrompt = `You are MedIntel Clinical AI, a world-class diagnostic medical assistant.
You are assisting Dr. Rohan. 
Your goal is to synthesize a perfectly structured, comprehensive, and highly precise clinical answer based strictly on the retrieved medical contexts.
Always structure your responses beautifully using clear medical headers:
- 📁 **Source Reference** (Mention the source file name and matched title)
- 🩺 **Clinical Diagnostic Guidelines**
- 💊 **Treatment & Dosage Protocols** (If applicable, specify standard frequencies)
- ⚠️ **Critical Precautions & Contraindications**

Use clean bullet points, scientific headers, and bold critical warnings. Use double equal signs to highlight key symptoms, active diagnostic words, or crucial numbers, e.g., ==key symptom== or ==400 mg==. Do not make up facts; use the context provided.

Retrieved Clinical Database Context:
${hits.map((h, i) => `[Context ${i+1}] (Source: ${h.source_file}):\nTitle: ${h.record_title}\nSummary: ${h.summary}\nContent: ${h.content}`).join('\n\n')}
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query }
            ],
            temperature: 0.2
          })
        });

        if (response.ok) {
          const result = await response.json();
          replyText = result.choices[0].message.content;
        } else {
          console.warn('OpenAI chat completions failed, falling back to local template');
        }
      } catch (err) {
        console.warn('OpenAI chat fetch error, falling back:', err);
      }
    }

    // Outpatient Template fallback if OpenAI fails or key is missing
    if (!replyText) {
      if (hits.length > 0) {
        const bestMatch = hits[0];
        const matchedTitle = bestMatch.record_title || 'Clinical guidelines';
        const matchedExcerpt = bestMatch.summary || bestMatch.content.slice(0, 200);
        const simScore = typeof bestMatch.similarity === 'number' ? bestMatch.similarity : 0.85;

        replyText = `### RAG Search Result for "${query}":\n\n`;
        replyText += `📁 **Source Reference**: **${matchedTitle}** (Confidence: ${(simScore * 100).toFixed(1)}%)\n`;
        replyText += `🩺 **Specialty**: **${bestMatch.metadata?.specialty || bestMatch.metadata?.medical_specialty || 'General Practice'}**\n\n`;
        
        if (bestMatch.content) {
          replyText += `**Clinical Findings & Guidance**:\n${bestMatch.content}\n\n`;
        } else {
          replyText += `**Summary of matches**:\n${matchedExcerpt}\n\n`;
        }
        
        replyText += `_Note: This data is retrieved from the indexed files: "${bestMatch.source_file}". Review patient clinical records prior to prescribing dosage regimens._`;
      } else {
        replyText = `### RAG Search Result: "${query}"\n\n`;
        replyText += `I searched the diagnoses, medical specialties, clinical cases, and Q&A indexes in the clinical reference database, but I did not find a highly specific vectorized match for your exact query.\n\n`;
        replyText += `**General Clinical Reference & Proactive Guidance**:\n`;
        
        const qLower = query.toLowerCase();
        if (qLower.includes('fever') || qLower.includes('temp') || qLower.includes('hot')) {
          replyText += `• **Pyrexia (Fever) Clinical Parameters**: Standard adult pyrexia is defined as core body temperature ==&gt;38°C (100.4°F)==. Outpatient management involves maintaining oral hydration, tracking vitals, and administering antipyretics (==acetaminophen 500-1000 mg== every 4-6 hours or ==ibuprofen 200-400 mg== every 6 hours) as clinically appropriate. Review signs of meningitis if temperature exceeds 39.5°C.\n`;
        } else if (qLower.includes('cough') || qLower.includes('throat') || qLower.includes('cold') || qLower.includes('respirat')) {
          replyText += `• **Acute Respiratory Symptoms Guidance**: Acute cough is most frequently associated with self-limiting upper respiratory viral infections. Expectorants or vaporizers are common supportive pathways. Red flags requiring imaging or specialist referral include ==dyspnea==, ==hemoptysis==, or ==prolonged high fever==.\n`;
        } else if (qLower.includes('pain') || qLower.includes('chest') || qLower.includes('heart') || qLower.includes('palpitat')) {
          replyText += `• **Chest Pain & Palpitations Warning Signals**: All presenting cardiovascular chest pain or palpitations require ==immediate baseline ECG== and ==cardiac biomarkers (troponin) assessments== to rule out acute coronary syndromes prior to proceeding with elective diagnostic pathways.\n`;
        } else {
          replyText += `• **RAG Search Suggestions**: Try refining your clinical query by focusing on specific indexed terms in our registry. For example, ask about specific diagnoses like **"LCM symptoms"**, medical specialties like **"Transthoracic echocardiogram (TTE) LVEF findings"**, or therapeutic guidelines like **"What are Sumatriptan dosages for migraines?"**.\n`;
        }
        
        replyText += `\n_Note: This dynamic summary is compiled as a clinical fallback. Review complete patient EMR records and vitals signs prior to prescribing therapeutic drug check regimens._`;
      }
    }

    const assistantMsg = {
      id: Date.now() + 1,
      role: 'assistant',
      text: replyText,
      citations: hits
    };

    setMessages((prev) => [...prev, assistantMsg]);
    setChatLoadStage(null);
    setChatLoading(false);
    addAuditLog('RAG Query', `Vector query: "${query}" (Found ${hits.length} citations)`, hits.length > 0 ? 'Successful' : 'Zero Results');
  };

  // Run restricted drug-only RAG safety interaction check
  const runInteractionCheck = async () => {
    if (!drugA.trim() || !drugB.trim()) return;
    setCheckingInteractions(true);
    setInteractionResult(null);

    // Wait a brief period to simulate active vector comparisons
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      let hitsA = [];
      let hitsB = [];

      if (isSupabaseConfigured) {
        const resA = await queryMedicalIndex(drugA, 'drugs', 6);
        const resB = await queryMedicalIndex(drugB, 'drugs', 6);
        hitsA = Array.isArray(resA) ? resA : [];
        hitsB = Array.isArray(resB) ? resB : [];
      } else {
        // Semantic filter from drug fallback previews
        const normA = drugA.toLowerCase().replace(/[?.!,;]/g, '').trim();
        const normB = drugB.toLowerCase().replace(/[?.!,;]/g, '').trim();
        hitsA = fullFallbackCollection
          .filter(x => x && x.dataset_group === 'drugs' && (x.record_title.toLowerCase().includes(normA) || x.content.toLowerCase().includes(normA)));
        hitsB = fullFallbackCollection
          .filter(x => x && x.dataset_group === 'drugs' && (x.record_title.toLowerCase().includes(normB) || x.content.toLowerCase().includes(normB)));
      }

      // Ensure safe array mappings to prevent undefined item references
      const safeHitsA = Array.isArray(hitsA) ? hitsA : [];
      const safeHitsB = Array.isArray(hitsB) ? hitsB : [];
      const contentA = safeHitsA.map((h) => `${h?.record_title || ''} ${h?.summary || ''} ${h?.content || ''}`).join(' ').toLowerCase();
      const contentB = safeHitsB.map((h) => `${h?.record_title || ''} ${h?.summary || ''} ${h?.content || ''}`).join(' ').toLowerCase();

      // Simple clinical warning logic
      const isAspirinOrWarfarin = (name) => {
        const n = name.toLowerCase();
        return n.includes('aspirin') || n.includes('warfarin') || n.includes('heparin') || n.includes('coagul') || n.includes('ibuprofen') || n.includes('advil');
      };

      let verdict = '';
      let isSevere = false;

      const hasA = isAspirinOrWarfarin(drugA);
      const hasB = isAspirinOrWarfarin(drugB);

      if (hasA && hasB) {
        verdict = `CRITICAL WARNING: Concurrent administration of "${drugA}" and "${drugB}" raises antiplatelet / anticoagulant activity. Significant elevation in risk of spontaneous internal or gastrointestinal hemorrhage. Advise monitoring INR regularly or using alternative NSAID therapeutic cohorts.`;
        isSevere = true;
      } else if (contentA.includes('contraindicat') || contentB.includes('contraindicat')) {
        verdict = `WARNING: Local index files describe potential contraindications. Review patient EMR charts and metabolic status before prescribing concurrently.`;
        isSevere = true;
      } else {
        verdict = `CLINICAL VERDICT: No severe interaction signals found in the indexed drug database for "${drugA}" and "${drugB}". Always verify clinical parameters and renal function.`;
        isSevere = false;
      }

      setInteractionResult({
        verdict,
        isSevere,
        hitsA: hitsA.slice(0, 2),
        hitsB: hitsB.slice(0, 2)
      });

      addAuditLog('Drug Safety', `Safety check: ${drugA} + ${drugB} (Drug index search)`, isSevere ? 'Interaction Flagged' : 'Passed Check');
    } catch (err) {
      setInteractionResult({ verdict: 'Database query timed out. Check Supabase REST service connection.', isSevere: false });
    } finally {
      setCheckingInteractions(false);
    }
  };

  // Handle local simulated file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            const newDoc = {
              id: Date.now(),
              name: file.name,
              type: file.name.split('.').pop() || 'pdf',
              size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
              date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              status: 'queue',
              label: (file.name.split('.').pop() || 'pdf').toUpperCase()
            };
            setDocumentsQueue((prevDocs) => [...prevDocs, newDoc]);
            setUploadProgress(null);
            addAuditLog('OCR Ingest', `Ingested clinical document: "${file.name}" to vector queue`, 'In Queue');
          }, 300);
          return 100;
        }
        return prev + 30;
      });
    }, 150);
  };

  // Remove document from queue
  const handleRemoveDoc = (id, name) => {
    setDocumentsQueue((prev) => prev.filter((d) => d.id !== id));
    addAuditLog('OCR Ingest', `Deleted document "${name}" from intake registry`, 'Removed');
  };

  // Run simulated Prescription OCR Scanner
  const runPrescriptionOCR = (docName) => {
    setOcrScanning(true);
    setOcrResult(null);
    setActiveTab('ocr');

    setTimeout(() => {
      setOcrScanning(false);
      setOcrResult({
        docName,
        genericName: 'Acyclovir',
        brandName: 'Zovirax',
        form: 'Oral Tablet',
        strength: '400 mg',
        frequency: 'Three times daily (TID)',
        duration: '7 Days',
        uses: 'Treating acute herpes simplex mucocutaneous infections',
        caution: 'Ensure clinical hydration parameters. Monitor serum creatinine in renal insufficiency.'
      });
      addAuditLog('OCR Scan', `Holographic OCR scan completed on "${docName}"`, 'Completed');
    }, 2200);
  };

  // Symptom Checker assessment
  const handleSymptomToggle = (symptom) => {
    setSelectedSymptoms((prev) => {
      const next = prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom];
      
      // Calculate clinical match based on active checkboxes
      if (next.length === 0) {
        setSymptomResult(null);
      } else {
        const containsFever = next.includes('Fever');
        const containsHeadache = next.includes('Headache');
        const containsNausea = next.includes('Nausea/Vomiting');
        const containsPalpitations = next.includes('Heart Palpitations');
        const containsFatigue = next.includes('Fatigue/Myalgia');

        if (containsFever && containsHeadache && containsNausea) {
          setSymptomResult({
            condition: 'Lymphocytic Choriomeningitis (LCM) / Viral Aseptic Meningitis',
            specialty: 'Infectious Disease / Neurology Consultation',
            advice: 'RETRIEVED GUIDELINES: Symptoms match aseptic viral encephalitis risk profile. Standard referral to Infectious Disease or Neurology is recommended. Check CSF for LCMV antibodies via RT-PCR or EMR antibody titres.'
          });
        } else if (containsPalpitations) {
          setSymptomResult({
            condition: 'Intermittent Premature Ventricular Contractions (PVCs)',
            specialty: 'Cardiology consultation',
            advice: 'RETRIEVED GUIDELINES: Intermittent chest palpitations with occasional premature contractions. ECG or Holter monitor requested. Suggest baseline electrolyte panel (magnesium, potassium) and caffeine moderation.'
          });
        } else if (containsHeadache && containsFatigue) {
          setSymptomResult({
            condition: 'Migraine with Aura / Chronic Headache Syndromes',
            specialty: 'Neurology Specialty',
            advice: 'RETRIEVED GUIDELINES: Unilateral headache preceded by visual aura. Standard migraine precautions apply. Triptans or magnesium prophylaxis are standard first-line pathway choices.'
          });
        } else {
          setSymptomResult({
            condition: 'General Non-Specific Clinical Cohort',
            specialty: 'General Internal Medicine / Outpatient Care',
            advice: 'Retrieved guidelines recommend basic vital sign observation. Schedule standard primary care visit if symptoms persist.'
          });
        }
      }
      return next;
    });
  };

  // Quick prompt triggers from Dr. Rohan Greeting card
  const handleQuickPrompt = (actionType) => {
    if (actionType === 'report') {
      setActiveTab('reports');
    } else if (actionType === 'interaction') {
      setDrugA('aspirin');
      setDrugB('warfarin');
      setActiveTab('interactions');
    } else if (actionType === 'history') {
      setActiveTab('patients');
    }
  };

  // Search filtered patients list
  const filteredPatients = useMemo(() => {
    return patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.specialty.toLowerCase().includes(patientSearch.toLowerCase()));
  }, [patients, patientSearch]);

  return (
    <div className="medintel-app-layout">
      {/* 1. Navigation Sidebar */}
      <aside className="medintel-sidebar">
        <div className="medintel-sidebar-logo" style={{ display: 'flex', justifyContent: 'center', padding: '0 0 24px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}>
          {/* Aligned Medintel AI Logo */}
          <img src={logoImg} alt="Medintel AI" style={{ maxHeight: 52, width: 'auto', objectFit: 'contain' }} />
        </div>

        <nav className="medintel-sidebar-menu">
          <button 
            className={`medintel-menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            className={`medintel-menu-item ${activeTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('assistant')}
          >
            <Sparkles size={20} />
            AI Assistant
          </button>
          <button 
            className={`medintel-menu-item ${activeTab === 'patients' ? 'active' : ''}`}
            onClick={() => setActiveTab('patients')}
          >
            <Users size={20} />
            Patients
          </button>
          <button 
            className={`medintel-menu-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={20} />
            Documents
          </button>
          <button 
            className={`medintel-menu-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <Activity size={20} />
            Reports Analyzer
          </button>
          <button 
            className={`medintel-menu-item ${activeTab === 'ocr' ? 'active' : ''}`}
            onClick={() => setActiveTab('ocr')}
          >
            <ScanLine size={20} />
            Prescription OCR
          </button>
          <button 
            className={`medintel-menu-item ${activeTab === 'interactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('interactions')}
          >
            <Pill size={20} />
            Drug Interactions
          </button>
          <button 
            className={`medintel-menu-item ${activeTab === 'symptom' ? 'active' : ''}`}
            onClick={() => setActiveTab('symptom')}
          >
            <Heart size={20} />
            Symptom Checker
          </button>
          <button 
            className={`medintel-menu-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <HistoryIcon size={20} />
            History
          </button>
          <button 
            className={`medintel-menu-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={20} />
            Settings
          </button>
        </nav>

        <div className="medintel-sidebar-footer">
          <div className="medintel-user-badge">
            <div className="medintel-user-avatar">DR</div>
            <div className="medintel-user-info">
              <h4>Dr. Rohan</h4>
              <p>Chief MD, Cardiology</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main content container */}
      <main className="medintel-main-content">
        {/* Header view metrics */}
        <div className="medintel-view-header">
          <div className="medintel-view-title">
            {activeTab === 'dashboard' && (
              <>
                <h1>Clinical Dashboard</h1>
                <p>Welcome back, Dr. Rohan. Review your patient care activities, scanned queues, and RAG stats.</p>
              </>
            )}
            {activeTab === 'assistant' && (
              <>
                <h1>RAG Clinical Assistant</h1>
                <p>Ask about diagnoses, specialties, or clinical questions (healthcare & q&a datasets).</p>
              </>
            )}
            {activeTab === 'patients' && (
              <>
                <h1>Patient Cohort Database</h1>
                <p>Manage and audit your clinic roster, patient vital signs, and diagnostic history.</p>
              </>
            )}
            {activeTab === 'documents' && (
              <>
                <h1>Document intake Registry</h1>
                <p>Upload files to queue them for vector embeddings indexing or Prescription OCR extraction.</p>
              </>
            )}
            {activeTab === 'reports' && (
              <>
                <h1>Clinical Reports Analyzer</h1>
                <p>Examine patient EMR diagnostics, anatomic images, and trigger specialized medical summaries.</p>
              </>
            )}
            {activeTab === 'ocr' && (
              <>
                <h1>Holographic Prescription OCR</h1>
                <p>Futuristic prescription scanner using advanced OCR text layout parsing.</p>
              </>
            )}
            {activeTab === 'interactions' && (
              <>
                <h1>Drug Safety & Interactions</h1>
                <p>Run interaction checks between two medication molecules (restricted to the drugs index).</p>
              </>
            )}
            {activeTab === 'symptom' && (
              <>
                <h1>Interactive Symptom Checker</h1>
                <p>Audit symptom matrices to compile clinical recommendations and specialty referrals.</p>
              </>
            )}
            {activeTab === 'history' && (
              <>
                <h1>System Audit Logs</h1>
                <p>Detailed chronological history of clinical interaction checkups and semantic database queries.</p>
              </>
            )}
            {activeTab === 'settings' && (
              <>
                <h1>System Configuration</h1>
                <p>Establish API keys, toggle vector indexes, and review active REST connections.</p>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="status-bar" style={{ marginTop: 0 }}>
              <Database size={14} style={{ color: '#38bdf8' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{statusText}</span>
              {loadingIndex && <LoaderCircle className="spin" size={14} />}
            </div>
          </div>
        </div>

        {/* Dynamic Workspace Tabs content */}

        {/* A. DASHBOARD VIEW (Exactly matches the reference image layout) */}
        {activeTab === 'dashboard' && (
          <div style={{ flex: 1 }}>
            <div className="dashboard-grid">
              
              {/* Row 1, Col 1-2: Health Status Trend Line Chart */}
              <div 
                className="medintel-card dashboard-span-2 tilt-card-3d"
                onMouseMove={handleTiltMove}
                onMouseLeave={handleTiltLeave}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Health Status Trend</h3>
                  <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>Jan – Jul 2026</span>
                </div>
                
                {/* SVG-based Line Chart */}
                <div className="chart-container">
                  <svg className="custom-svg-chart" viewBox="0 0 600 200">
                    <defs>
                      <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                    
                    {/* Grids and Axes */}
                    <line x1="40" y1="20" x2="40" y2="160" className="chart-axis-line" />
                    <line x1="40" y1="160" x2="580" y2="160" className="chart-axis-line" />
                    
                    <line x1="40" y1="125" x2="580" y2="125" className="chart-grid-line" />
                    <line x1="40" y1="90" x2="580" y2="90" className="chart-grid-line" />
                    <line x1="40" y1="55" x2="580" y2="55" className="chart-grid-line" />
                    <line x1="40" y1="20" x2="580" y2="20" className="chart-grid-line" />
                    
                    {/* Graph Line Path (representing the orange path in reference image) */}
                    {/* Data Points: Jan:34, Feb:28, Mar:32, Apr:26, May:31, Jun:33, Jul:25 */}
                    {/* Transformed coordinates: Jan: 60, Feb: 140, Mar: 220, Apr: 300, May: 380, Jun: 460, Jul: 540 */}
                    {/* Y values: 34->40, 28->70, 32->50, 26->80, 31->55, 33->45, 25->85 */}
                    <path 
                      d="M 60 40 L 140 70 L 220 50 L 300 80 L 380 55 L 460 45 L 540 85" 
                      className="chart-path" 
                    />
                    
                    {/* Data Point Markers */}
                    <circle cx="60" cy="40" r="5" className="chart-point" />
                    <circle cx="140" cy="70" r="5" className="chart-point" />
                    <circle cx="220" cy="50" r="5" className="chart-point" />
                    <circle cx="300" cy="80" r="5" className="chart-point" />
                    <circle cx="380" cy="55" r="5" className="chart-point" />
                    <circle cx="460" cy="45" r="5" className="chart-point" />
                    <circle cx="540" cy="85" r="5" className="chart-point" />
                    
                    {/* Axis Labels */}
                    <text x="60" y="180" className="chart-text">Jan</text>
                    <text x="140" y="180" className="chart-text">Feb</text>
                    <text x="220" y="180" className="chart-text">Mar</text>
                    <text x="300" y="180" className="chart-text">Apr</text>
                    <text x="380" y="180" className="chart-text">May</text>
                    <text x="460" y="180" className="chart-text">Jun</text>
                    <text x="540" y="180" className="chart-text">Jul</text>
                    
                    {/* Y Values */}
                    <text x="30" y="24" className="chart-text" textAnchor="end">40</text>
                    <text x="30" y="59" className="chart-text" textAnchor="end">30</text>
                    <text x="30" y="94" className="chart-text" textAnchor="end">20</text>
                    <text x="30" y="129" className="chart-text" textAnchor="end">10</text>
                    <text x="30" y="164" className="chart-text" textAnchor="end">0</text>
                  </svg>
                </div>
                
                {/* Metrics Row matching reference image */}
                <div className="chart-legend-row">
                  <div className="legend-badge">
                    <div className="legend-dot good"></div> Good Health <strong>72%</strong>
                  </div>
                  <div className="legend-badge">
                    <div className="legend-dot risk"></div> Risk Level <strong>28%</strong>
                  </div>
                  <div className="legend-badge">
                    <div className="legend-dot recovering"></div> Recovering <strong>46%</strong>
                  </div>
                  <div className="legend-badge">
                    <div className="legend-dot critical"></div> Critical <strong>8%</strong>
                  </div>
                </div>
              </div>

              {/* Row 1, Col 3: Documents Intake Queue */}
              <div className="medintel-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3>Intake Queue</h3>
                  <span style={{ fontSize: 12, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>OCR Registry</span>
                </div>
                
                <div className="doc-queue-list">
                  {documentsQueue.map((doc) => (
                    <div key={doc.id} className="doc-queue-item">
                      <div className="doc-item-left">
                        <div className={`doc-icon-box ${doc.type}`}>{doc.label}</div>
                        <div className="doc-item-details">
                          <h4>{doc.name}</h4>
                          <p>{doc.size} • {doc.date}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span 
                          onClick={() => runPrescriptionOCR(doc.name)}
                          className={`doc-status-badge ${doc.status}`} 
                          style={{ cursor: 'pointer' }}
                          title="Click to run OCR Analysis"
                        >
                          {doc.status === 'scanned' ? 'OCR Scanned' : 'In Queue'}
                        </span>
                        <button className="doc-delete-btn" onClick={() => handleRemoveDoc(doc.id, doc.name)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upload drag drop zone */}
                <div className="doc-drag-zone" style={{ position: 'relative' }}>
                  <input 
                    type="file" 
                    onChange={handleFileUpload} 
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                  />
                  <Upload size={20} style={{ color: 'var(--muted)', marginBottom: 6 }} />
                  <p>{uploadProgress ? `Ingesting (${uploadProgress}%)…` : 'Drop clinical files to queue'}</p>
                </div>
              </div>
            </div>

            {/* Row 2 Grid */}
            <div className="dashboard-grid">
              
              {/* Row 2, Col 1: Stacked Columns (Appointments + Patient Distribution) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Card 1: Upcoming Appointments */}
                <div className="medintel-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Upcoming Appointments</h3>
                    <button 
                      onClick={() => setActiveTab('patients')}
                      style={{ fontSize: '13px', color: '#00b0ff', fontWeight: 700, background: 'transparent' }}
                    >
                      View Calendar
                    </button>
                  </div>

                  <div className="appointment-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {patients.map((p) => (
                      <div key={p.id} className="appointment-item" style={{ padding: '12px' }}>
                        <div className="appointment-info">
                          <img className="appointment-avatar" src={p.avatar} alt={p.name} style={{ width: '40px', height: '40px' }} />
                          <div className="appointment-meta">
                            <h4 style={{ fontSize: '13px' }}>
                              {p.name}
                              <span className={`appointment-status ${p.status}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                                {p.status === 'checked' ? 'Checked In' : 'Delayed'}
                              </span>
                            </h4>
                            <p style={{ fontSize: '11px' }}>{p.specialty}</p>
                          </div>
                        </div>
                        <div className="appointment-time-box">
                          <div className="appointment-date" style={{ fontSize: '10px' }}>{p.date}</div>
                          <div className="appointment-time" style={{ fontSize: '12px' }}>{p.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 2: Patient Health Distribution */}
                <div className="medintel-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Patient Health Distribution</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 95px', gap: '14px', alignItems: 'center' }}>
                    {/* Concentric Donut chart */}
                    <div className="distribution-chart-wrapper" style={{ width: '120px', height: '120px' }}>
                      <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
                        
                        {/* Good Health segment (56%): stroke-dasharray="301.6 * 0.56 = 168.9" */}
                        <circle 
                          cx="60" cy="60" r="48" 
                          className="donut-segment" 
                          stroke={varColor('--good-health')} 
                          strokeWidth="10"
                          strokeDasharray="168.9 301.6"
                          transform="rotate(-90 60 60)"
                        />
                        
                        {/* Moderate Risk (28%): stroke-dasharray="84.4" offset="168.9" */}
                        <circle 
                          cx="60" cy="60" r="48" 
                          className="donut-segment" 
                          stroke={varColor('--risk-level')} 
                          strokeWidth="10"
                          strokeDasharray="84.4 301.6"
                          strokeDashoffset="-168.9"
                          transform="rotate(-90 60 60)"
                        />
                        
                        {/* High Risk (12%): stroke-dasharray="36.2" offset="253.3" */}
                        <circle 
                          cx="60" cy="60" r="48" 
                          className="donut-segment" 
                          stroke="#ef4444" 
                          strokeWidth="10"
                          strokeDasharray="36.2 301.6"
                          strokeDashoffset="-253.3"
                          transform="rotate(-90 60 60)"
                        />
                        
                        {/* Critical (4%): stroke-dasharray="12.1" offset="289.5" */}
                        <circle 
                          cx="60" cy="60" r="48" 
                          className="donut-segment" 
                          stroke="#9b0e2b" 
                          strokeWidth="10"
                          strokeDasharray="12.1 301.6"
                          strokeDashoffset="-289.5"
                          transform="rotate(-90 60 60)"
                        />
                      </svg>
                      
                      <div className="donut-inner-label">
                        <div className="donut-inner-val" style={{ fontSize: '18px' }}>1,248</div>
                        <div className="donut-inner-lbl" style={{ fontSize: '8px' }}>Patients</div>
                      </div>
                    </div>

                    <div className="distribution-stats" style={{ gap: '6px' }}>
                      <div className="dist-stat-row" style={{ fontSize: '12px' }}>
                        <div className="dist-stat-left good">
                          <div className="legend-dot good"></div>
                          <span>Good Health</span>
                        </div>
                        <span className="dist-stat-pct">56%</span>
                      </div>
                      <div className="dist-stat-row" style={{ fontSize: '12px' }}>
                        <div className="dist-stat-left mod">
                          <div className="legend-dot risk"></div>
                          <span>Moderate Risk</span>
                        </div>
                        <span className="dist-stat-pct">28%</span>
                      </div>
                      <div className="dist-stat-row" style={{ fontSize: '12px' }}>
                        <div className="dist-stat-left high">
                          <div className="legend-dot risk" style={{ backgroundColor: '#ef4444' }}></div>
                          <span>High Risk</span>
                        </div>
                        <span className="dist-stat-pct">12%</span>
                      </div>
                      <div className="dist-stat-row" style={{ fontSize: '12px' }}>
                        <div className="dist-stat-left crit">
                          <div className="legend-dot critical" style={{ backgroundColor: '#9b0e2b' }}></div>
                          <span>Critical</span>
                        </div>
                        <span className="dist-stat-pct">4%</span>
                      </div>
                    </div>

                    {/* Integrated pyramid.png asset from assets folder */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={pyramidImg} alt="Patient Cohort" style={{ maxHeight: '85px', width: 'auto', objectFit: 'contain' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2, Col 2: Dr. Rohan Hello Greeting Card */}
              <div 
                className="medintel-card robot-greeting-card tilt-card-3d" 
                onMouseMove={handleTiltMove}
                onMouseLeave={handleTiltLeave}
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}
              >
                <div className="robot-illustration-container" style={{ width: '120px', height: '120px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 8px auto' }}>
                  {/* Integrated robot.png asset from assets folder */}
                  <img src={robotImg} alt="AI Assistant" className="robot-illustration" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>

                <div style={{ margin: '8px 0' }}>
                  <h2>Hello Dr. Rohan!</h2>
                  <p style={{ fontSize: '13px', margin: '4px 0 12px 0' }}>How can I help you today?</p>
                </div>

                <div className="robot-quick-prompts" style={{ gap: '8px', marginBottom: '14px' }}>
                  <button className="quick-prompt-item" onClick={() => handleQuickPrompt('report')} style={{ padding: '10px 14px' }}>
                    <span className="quick-prompt-icon" style={{ color: '#00b0ff' }}>📝</span>
                    Analyze Rohan's report
                  </button>
                  <button className="quick-prompt-item" onClick={() => handleQuickPrompt('interaction')} style={{ padding: '10px 14px' }}>
                    <span className="quick-prompt-icon" style={{ color: '#00b0ff' }}>❌</span>
                    Check drug interactions
                  </button>
                  <button className="quick-prompt-item" onClick={() => handleQuickPrompt('history')} style={{ padding: '10px 14px' }}>
                    <span className="quick-prompt-icon" style={{ color: '#00b0ff' }}>✍️</span>
                    Summarize patient history
                  </button>
                </div>

                <button 
                  className="primary-accent-btn" 
                  onClick={() => {
                    setMessages([
                      {
                        id: Date.now(),
                        role: 'assistant',
                        text: 'Starting a fresh clinical analysis session. How can I assist you with clinical cases, patient diagnoses, or therapeutic safety checking?',
                        citations: []
                      }
                    ]);
                    setActiveTab('assistant');
                  }}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Start New Chat <ArrowRight size={16} />
                </button>
              </div>

              {/* Row 2, Col 3: AI Insights & Quick Actions (Stacked columns) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div 
                  className="medintel-card insights-glow-card tilt-card-3d" 
                  onMouseMove={handleTiltMove}
                  onMouseLeave={handleTiltLeave}
                  style={{ margin: 0, padding: '20px' }}
                >
                  <div className="insights-brain-box" style={{ width: '70px', height: '70px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'transparent' }}>
                    {/* Integrated brain.png asset from assets folder */}
                    <img src={brainImg} alt="Brain Prediction" className="insights-brain-icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div className="insights-content">
                    <span style={{ fontSize: '9px', color: '#00b0ff', fontWeight: 800 }}>AI HEALTH INSIGHTS</span>
                    <h3 style={{ fontSize: '14px', margin: '2px 0' }}>Predictions & Trends</h3>
                    <p style={{ fontSize: '11px', lineHeight: 1.4, margin: '2px 0 8px 0' }}>Get intelligent insights & predictions for better patient care.</p>
                    <a className="insights-link" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('symptom'); }} style={{ fontSize: '12px' }}>
                      View Insights <ArrowRight size={12} />
                    </a>
                  </div>
                </div>

                <div className="medintel-card quick-actions-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>Quick Actions</h3>
                  
                  <div className="quick-actions-grid" style={{ gap: '12px' }}>
                    <button className="quick-action-button upload" onClick={() => setActiveTab('documents')} style={{ padding: '12px 8px' }}>
                      <div className="quick-action-circle" style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                        <Upload size={16} />
                      </div>
                      <span className="quick-action-label" style={{ fontSize: '12px' }}>Upload Document</span>
                    </button>

                    <button className="quick-action-button voice" onClick={() => { alert('Voice clinical dictation helper initialized. Waiting for medical microphone input...'); }} style={{ padding: '12px 8px' }}>
                      <div className="quick-action-circle" style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                        <Mic size={16} />
                      </div>
                      <span className="quick-action-label" style={{ fontSize: '12px' }}>Voice Assistant</span>
                    </button>

                    <button className="quick-action-button symptom" onClick={() => setActiveTab('symptom')} style={{ padding: '12px 8px' }}>
                      <div className="quick-action-circle" style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                        <Heart size={16} />
                      </div>
                      <span className="quick-action-label" style={{ fontSize: '12px' }}>Symptom Checker</span>
                    </button>

                    <button className="quick-action-button drugs" onClick={() => setActiveTab('interactions')} style={{ padding: '12px 8px' }}>
                      <div className="quick-action-circle" style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                        <Pill size={16} />
                      </div>
                      <span className="quick-action-label" style={{ fontSize: '12px' }}>Drug Interactions</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* B. AI CLINICAL RAG CHAT ASSISTANT */}
        {activeTab === 'assistant' && (
          <div className="medintel-card rag-assistant-workspace">
            {/* Left Hand: The Main Chat Panel */}
            <div className="chat-panel-container">
              
              {/* Chat Message List */}
              <div className="chat-messages-box">
                {messages.map((m) => (
                  <div key={m.id} className={`chat-bubble ${m.role}`}>
                    <span className="chat-role-label">
                      {m.role === 'assistant' ? '🤖 Medintel Clinical AI' : '👨‍⚕️ Dr. Rohan'}
                    </span>
                    {parseMarkdownText(m.text)}
                    
                    {/* Citations Pill list inline in the message */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="chat-citations-bar">
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Retrieved Sources:</span>
                        {m.citations.map((hit, idx) => (
                          <span key={hit.id || idx} className="citation-pill-btn">
                            📁 {hit.record_title || 'File Chunk'} [{(hit.similarity * 100).toFixed(0)}%]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {chatLoading && (
                  <div className="chat-bubble assistant rag-loader-bubble">
                    <span className="chat-role-label">🤖 Medintel RAG Pipeline</span>
                    
                    <div className="rag-pipeline-container">
                      <div className={`rag-pipeline-step ${chatLoadStage === 'vectorizing' ? 'active' : 'completed'}`}>
                        <div className="step-indicator">
                          {chatLoadStage === 'vectorizing' ? <LoaderCircle className="spin" size={16} /> : <Check size={14} style={{ color: 'var(--good-health)' }} />}
                        </div>
                        <div className="step-text">
                          <h4>Vectorizing Query</h4>
                          <p>Generating OpenAI text-embedding-3-small vectors...</p>
                        </div>
                      </div>
                      
                      <div className={`rag-pipeline-step ${chatLoadStage === 'matching' ? 'active' : chatLoadStage === 'synthesizing' ? 'completed' : 'pending'}`}>
                        <div className="step-indicator">
                          {chatLoadStage === 'matching' ? <LoaderCircle className="spin" size={16} /> : chatLoadStage === 'synthesizing' ? <Check size={14} style={{ color: 'var(--good-health)' }} /> : <div className="dot"></div>}
                        </div>
                        <div className="step-text">
                          <h4>Vector Node Matching</h4>
                          <p>Querying Supabase index for clinical chunks...</p>
                        </div>
                      </div>
                      
                      <div className={`rag-pipeline-step ${chatLoadStage === 'synthesizing' ? 'active' : 'pending'}`}>
                        <div className="step-indicator">
                          {chatLoadStage === 'synthesizing' ? <LoaderCircle className="spin" size={16} /> : <div className="dot"></div>}
                        </div>
                        <div className="step-text">
                          <h4>Clinical AI Synthesis</h4>
                          <p>Calling gpt-4o-mini to build aligned response...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Suggestions bar */}
              <div className="chip-row" style={{ marginTop: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', alignSelf: 'center' }}>Try RAG queries:</span>
                {[
                  'What are LCM symptoms?', 
                  'Echocardiogram findings LVEF', 
                  'Sumatriptan dosage for migraines',
                  'Post-Op gastric bypass case study'
                ].map((s) => (
                  <button 
                    key={s} 
                    className="chip" 
                    onClick={() => { setDraft(s); }}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Form Input Composer */}
              <div className="chat-composer-box">
                <form className="chat-composer-form" onSubmit={handleChatSubmit}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="chat-composer-input"
                    placeholder="Enter diagnostic queries, specialty questions, or symptoms to search vector RAG..."
                  />
                  <button type="submit" className="chat-send-btn" disabled={chatLoading}>
                    Query RAG <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            </div>

            {/* Right Hand: Interactive Sources and Citations sidebar */}
            <div className="citations-sidebar-panel">
              <div className="citations-panel-head">
                <h3>RAG Retrieval Vector Nodes</h3>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>Shows top similarity matches extracted from active datasets</p>
              </div>

              <div className="citations-scroll-list">
                {citationsList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--muted)' }}>
                    <Database size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <p style={{ fontSize: 13 }}>No active vector citations retrieved. Submit a query to see semantically matched database chunks.</p>
                  </div>
                ) : (
                  citationsList.map((hit, idx) => (
                    <div key={hit.id || idx} className="citation-card">
                      <div className="citation-card-header">
                        <span className={`citation-grp-chip ${hit.dataset_group}`}>
                          {hit.dataset_group} / {hit.record_type}
                        </span>
                        <span className="citation-score">
                          {((hit.similarity || 0) * 100).toFixed(0)}% Match
                        </span>
                      </div>
                      <h4>{hit.record_title}</h4>
                      <p>{hit.content || hit.summary}</p>
                      <div style={{ fontSize: 10, color: 'var(--primary-light)', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📄 {hit.source_file}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* C. PATIENTS TAB COHORT DATABASE */}
        {activeTab === 'patients' && (
          <div className="medintel-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
              <h3>Clinic Intake Roster</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '8px 14px', width: 320 }}>
                <Search size={18} style={{ color: 'var(--muted)' }} />
                <input 
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patient names, diagnoses, or symptoms..." 
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <table className="patients-list-table">
              <thead>
                <tr>
                  <th>Patient Profile</th>
                  <th>Age/Gender</th>
                  <th>Clinical Referral</th>
                  <th>Intake Status</th>
                  <th>Scheduled Session</th>
                  <th>EMR Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => (
                  <tr key={p.id} onClick={() => setSelectedPatient(p)}>
                    <td>
                      <div className="patient-profile-inline">
                        <img className="patient-avatar-inline" src={p.avatar} alt={p.name} />
                        <span className="patient-name-inline">{p.name}</span>
                      </div>
                    </td>
                    <td>{p.age} y/o • {p.gender}</td>
                    <td>{p.specialty}</td>
                    <td>
                      <span className={`appointment-status ${p.status}`}>
                        {p.status === 'checked' ? 'Checked In' : 'Delayed'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{p.date} • {p.time}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          className="citation-pill-btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPatient(p);
                          }}
                          style={{ margin: 0 }}
                        >
                          <Eye size={12} /> View File
                        </button>
                        <button 
                          className="citation-pill-btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraft(`Summarize clinical EMR history for ${p.name}`);
                            setActiveTab('assistant');
                          }}
                          style={{ margin: 0, color: 'var(--good-health)', borderColor: 'rgba(16,185,129,0.2)' }}
                        >
                          <Sparkles size={12} /> RAG Audit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Selected Patient details modal overlay */}
            {selectedPatient && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyItems: 'center', zIndex: 200, padding: 32 }}>
                <div className="medintel-card" style={{ maxWidth: 640, margin: 'auto', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: 14, marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <img src={selectedPatient.avatar} style={{ width: 50, height: 50, borderRadius: '50%', border: '2px solid #38bdf8' }} />
                      <div>
                        <h3 style={{ margin: 0 }}>{selectedPatient.name}</h3>
                        <p style={{ fontSize: 13, color: 'var(--muted)' }}>{selectedPatient.gender} • {selectedPatient.age} years old</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 16 }}>
                    <div className="detail-row-item">
                      <span>Clinic Specialties Referral</span>
                      <p style={{ fontWeight: 700, color: '#38bdf8' }}>{selectedPatient.specialty}</p>
                    </div>

                    <div className="detail-row-item">
                      <span>Baseline Vitals Signs Log</span>
                      <p style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: 10, borderRadius: 8, color: 'var(--text)' }}>{selectedPatient.vitals}</p>
                    </div>

                    <div className="detail-row-item">
                      <span>Clinical Narrative & Intake Notes</span>
                      <p style={{ color: 'var(--text)', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)' }}>{selectedPatient.notes}</p>
                    </div>
                  </div>

                  <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="citation-pill-btn" onClick={() => setSelectedPatient(null)} style={{ padding: '8px 16px' }}>
                      Close EMR Chart
                    </button>
                    <button 
                      className="primary-accent-btn" 
                      onClick={() => {
                        setDraft(`What are the symptoms and diagnoses references for ${selectedPatient.name}?`);
                        setSelectedPatient(null);
                        setActiveTab('assistant');
                      }}
                      style={{ padding: '8px 16px', fontSize: 13 }}
                    >
                      Audit Patient with RAG
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* D. DOCUMENTS TAB FILE MANAGER */}
        {activeTab === 'documents' && (
          <div className="medintel-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignSelf: 'center', marginBottom: 20 }}>
              <h3>Vectorized Source Files</h3>
              <div style={{ position: 'relative' }}>
                <input 
                  type="file" 
                  onChange={handleFileUpload} 
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                />
                <button className="primary-accent-btn" style={{ padding: '10px 20px', fontSize: 13 }}>
                  <Upload size={16} /> Ingest New Document
                </button>
              </div>
            </div>

            <div className="docs-grid-layout">
              {/* Document 1 */}
              <div className="doc-grid-card">
                <span className="doc-grid-card-icon">📄</span>
                <h4>combined_medicines.csv</h4>
                <p>Dataset/Drugs • 840 records</p>
                <div className="doc-status-badge scanned" style={{ display: 'inline-block' }}>Embedded (drugs)</div>
              </div>

              {/* Document 2 */}
              <div className="doc-grid-card">
                <span className="doc-grid-card-icon">📄</span>
                <h4>combined_all_datasets.csv</h4>
                <p>Dataset/Healthcare • 1,220 records</p>
                <div className="doc-status-badge scanned" style={{ display: 'inline-block' }}>Embedded (healthcare)</div>
              </div>

              {/* Document 3 */}
              <div className="doc-grid-card">
                <span className="doc-grid-card-icon">📄</span>
                <h4>train.csv</h4>
                <p>Dataset/q&a • 3,400 records</p>
                <div className="doc-status-badge scanned" style={{ display: 'inline-block' }}>Embedded (qa)</div>
              </div>

              {/* Document 4 */}
              <div className="doc-grid-card">
                <span className="doc-grid-card-icon">📄</span>
                <h4>mtsamples.csv</h4>
                <p>Dataset/q&a • 540 records</p>
                <div className="doc-status-badge scanned" style={{ display: 'inline-block' }}>Embedded (qa)</div>
              </div>
            </div>

            <div style={{ marginTop: 32, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid var(--border-light)' }}>
              <h4>RAG Embeddings Registry Stats</h4>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>We use semantic vector matrices generated client-side via locally configured n-gram hash vectorizers, fallback to text-embedding-3-small on live Supabase projects.</p>
              
              <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Indexed Vectors</span>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#38bdf8' }}>6,000 Chunks</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>RAG Ingestion Status</span>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--good-health)' }}>Operational</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Database Space</span>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>34.2 MB</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* E. CLINICAL REPORTS ANALYZER CASE STUDY */}
        {activeTab === 'reports' && (
          <div className="medintel-card report-study-layout">
            {/* Left study details */}
            <div>
              <h3>MRI Brain Case Study Analysis</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>Dissecting loaded: <strong>MRI Brain Report.pdf</strong></p>

              {/* Glow SVG Anatomy graph */}
              <div className="report-anatomy-box" style={{ marginBottom: 20 }}>
                <svg className="anatomy-svg-glowing" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="3" />
                  {/* Brain Profile silhouette */}
                  <path 
                    d="M 50 15 C 30 15, 20 28, 20 45 C 20 54, 25 58, 22 64 C 18 72, 28 85, 42 85 C 45 85, 48 82, 50 82 C 52 82, 55 85, 58 85 C 72 85, 82 72, 78 64 C 75 58, 80 54, 80 45 C 80 28, 70 15, 50 15 Z" 
                    fill="rgba(56, 189, 248, 0.04)" 
                    stroke="#38bdf8" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                  />
                  {/* Glowing hotspot */}
                  <circle cx="36" cy="42" r="8" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" strokeWidth="1.5">
                    <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <text x="36" y="44" fill="#fff" fontSize="6" fontWeight="bold" textAnchor="middle">Warning</text>
                  
                  {/* Ventricles */}
                  <path d="M 45 42 C 45 35, 55 35, 55 42 C 55 48, 45 48, 45 42 Z" stroke="#38bdf8" strokeWidth="1" fill="none" />
                </svg>
              </div>

              <div className="finding-alert-badge">
                ⚠️ DETECTED PATHOLOGY: Primary focus localized in left temporoparietal lobe. Findings describe minor lesion or demyelination plaques. Contrast enhancement checks requested.
              </div>

              <div style={{ marginTop: 24 }}>
                <h4>Automated Clinical Diagnostic Breakdown</h4>
                <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid var(--border-light)', color: 'var(--text)' }}>
                    <strong>Cerebral Ventricles Status:</strong> Normal size and volume. No evidence of obstructive hydrocephalus.
                  </div>
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid var(--border-light)', color: 'var(--text)' }}>
                    <strong>Symmetry / Midline Shift:</strong> Completely symmetric. Midline structures are within normal biological alignment parameters.
                  </div>
                </div>
              </div>
            </div>

            {/* Right Chat sidebar customized to study */}
            <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h4>Query MRI Report</h4>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>Ask specialized questions regarding the pathology of this specific MRI report.</p>

              <div style={{ flex: 1, background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--text)', height: 280, overflowY: 'auto' }}>
                <div style={{ marginBottom: 10 }}>
                  <strong style={{ color: '#0288d1' }}>AI Assistant:</strong> Loaded MRI report metrics.
                </div>
                <div style={{ marginBottom: 10, color: 'var(--muted)' }}>
                  <strong>Suggested Query:</strong> "Explain the demyelination plaque risk markers."
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <input 
                  placeholder="Ask report questions..." 
                  style={{ width: '100%', background: '#f8fafc', border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, color: 'var(--text)' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      alert('RAG Case study chat: Searching local pdf vectors for: ' + e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* F. HOLOGRAPHIC PRESCRIPTION OCR */}
        {activeTab === 'ocr' && (
          <div className="medintel-card ocr-scan-container">
            <h3>Holographic OCR Scanning</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>Extracts generic molecules, brand names, formulations, and caution details from prescription forms.</p>

            <div className="ocr-scanner-lens">
              {ocrScanning && <div className="ocr-hologram-line"></div>}
              
              {ocrScanning ? (
                <div style={{ textAlign: 'center' }}>
                  <LoaderCircle className="spin" size={36} style={{ color: '#38bdf8', marginBottom: 12 }} />
                  <h4 style={{ fontFamily: 'monospace' }}>SCANNING PRESCRIPTION_SCAN.JPG…</h4>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>Resolving contrast, character margins, and clinical molecules...</p>
                </div>
              ) : ocrResult ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <CheckCircle2 size={36} style={{ color: 'var(--good-health)', marginBottom: 12 }} />
                  <h4>EXTRACTION COMPLETELY SUCCESSFUL</h4>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>Compiled layout parsed from file: "{ocrResult.docName}"</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <FileText size={42} style={{ color: 'var(--muted)', marginBottom: 14, opacity: 0.4 }} />
                  <p>Intake scanned files list is ready for OCR extraction.</p>
                  <button 
                    className="primary-accent-btn" 
                    onClick={() => runPrescriptionOCR('Prescription_Scan.jpg')}
                    style={{ marginTop: 14, padding: '8px 18px', fontSize: 13 }}
                  >
                    Start OCR Extraction
                  </button>
                </div>
              )}
            </div>

            {/* OCR Scanned Sheet results */}
            {ocrResult && (
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 16, padding: 20, animation: 'fadeIn 0.3s ease' }}>
                <h4 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 8, marginBottom: 14, color: '#0288d1' }}>Scanned Medication Record</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="detail-row-item">
                    <span>Generic Molecule Name</span>
                    <p style={{ fontWeight: 700 }}>{ocrResult.genericName}</p>
                  </div>
                  <div className="detail-row-item">
                    <span>Identified Brand Name</span>
                    <p>{ocrResult.brandName}</p>
                  </div>
                  <div className="detail-row-item">
                    <span>Formulation & Strength</span>
                    <p>{ocrResult.form} • {ocrResult.strength}</p>
                  </div>
                  <div className="detail-row-item">
                    <span>Dosage Frequency</span>
                    <p style={{ color: 'var(--risk-level)', fontWeight: 700 }}>{ocrResult.frequency}</p>
                  </div>
                </div>

                <div className="detail-row-item" style={{ marginTop: 14 }}>
                  <span>Diagnostic Indications / Uses</span>
                  <p>{ocrResult.uses}</p>
                </div>

                <div className="detail-row-item" style={{ marginTop: 14 }}>
                  <span>Precautions / Cautions</span>
                  <p style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', padding: 10, borderRadius: 8, color: 'var(--risk-level)' }}>
                    ⚠️ {ocrResult.caution}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button className="citation-pill-btn" onClick={() => setOcrResult(null)}>
                    Clear Scanner Sheet
                  </button>
                  <button 
                    className="primary-accent-btn"
                    onClick={() => {
                      setDrugA(ocrResult.genericName);
                      setActiveTab('interactions');
                    }}
                    style={{ padding: '8px 16px', fontSize: 13 }}
                  >
                    Check Drug Interactions <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* G. DRUG SAFETY & INTERACTIONS (DRUG-ONLY vector querying filter) */}
        {activeTab === 'interactions' && (
          <div className="medintel-card">
            <h3>Check two drugs (drug-only index)</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>This utility restricts RAG searches strictly to the <strong>drugs</strong> index, matching safety contraindications.</p>

            <div className="drug-interaction-form-grid">
              <div className="interaction-input-box">
                <label>Molecule A (e.g. aspirin)</label>
                <div className="interaction-input-wrapper">
                  <Pill size={16} className="interaction-field-icon" />
                  <input 
                    value={drugA} 
                    onChange={(e) => setDrugA(e.target.value)}
                    className="interaction-field" 
                    placeholder="Enter Drug A molecule name..." 
                  />
                </div>
              </div>

              <div className="interaction-input-box">
                <label>Molecule B (e.g. warfarin)</label>
                <div className="interaction-input-wrapper">
                  <Pill size={16} className="interaction-field-icon" />
                  <input 
                    value={drugB} 
                    onChange={(e) => setDrugB(e.target.value)}
                    className="interaction-field" 
                    placeholder="Enter Drug B molecule name..." 
                  />
                </div>
              </div>
            </div>

            <div className="interaction-run-row">
              <button 
                onClick={runInteractionCheck}
                className="primary-accent-btn" 
                disabled={checkingInteractions || !drugA.trim() || !drugB.trim()}
              >
                {checkingInteractions ? (
                  <>
                    <LoaderCircle className="spin" size={16} /> Checking drug safety indices…
                  </>
                ) : (
                  <>
                    Run Interaction Check <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>

            {/* Interaction Result sheet */}
            {interactionResult && (
              <div className="interaction-results-panel" style={{ animation: 'fadeIn 0.3s ease' }}>
                <div className={`verdict-banner-card ${interactionResult.isSevere ? 'warning' : 'neutral'}`}>
                  <div className="verdict-icon-box">
                    {interactionResult.isSevere ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                  </div>
                  <div className="verdict-meta">
                    <h3>{interactionResult.isSevere ? 'HIGH RISK DETECTED' : 'NO SIGNIFICANT DETECTED RISKS'}</h3>
                    <p>{interactionResult.verdict}</p>
                  </div>
                </div>

                <div className="drug-comparison-grid">
                  {/* Drug A details retrieved */}
                  <div className="drug-details-sheet">
                    <h3>{drugA.toUpperCase()} Retrieved Data</h3>
                    
                    {interactionResult.hitsA && interactionResult.hitsA.length > 0 ? (
                      interactionResult.hitsA.map((h, i) => (
                        <div key={h.id || i} style={{ marginBottom: 12 }}>
                          <div className="detail-row-item">
                            <span>Reference title</span>
                            <p style={{ fontWeight: 700 }}>{h.record_title || h.generic_name}</p>
                          </div>
                          <div className="detail-row-item">
                            <span>Uses / Indications</span>
                            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{h.summary || h.content}</p>
                          </div>
                          {h.metadata?.side_effects && (
                            <div className="detail-row-item">
                              <span>Common Side Effects</span>
                              <p style={{ fontSize: 13, color: 'var(--critical)' }}>{h.metadata.side_effects}</p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--muted)', fontSize: 13 }}>No safety files indexed for "{drugA}". Ensure correct generic molecule spellings.</p>
                    )}
                  </div>

                  {/* Drug B details retrieved */}
                  <div className="drug-details-sheet">
                    <h3>{drugB.toUpperCase()} Retrieved Data</h3>

                    {interactionResult.hitsB && interactionResult.hitsB.length > 0 ? (
                      interactionResult.hitsB.map((h, i) => (
                        <div key={h.id || i} style={{ marginBottom: 12 }}>
                          <div className="detail-row-item">
                            <span>Reference title</span>
                            <p style={{ fontWeight: 700 }}>{h.record_title || h.generic_name}</p>
                          </div>
                          <div className="detail-row-item">
                            <span>Uses / Indications</span>
                            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{h.summary || h.content}</p>
                          </div>
                          {h.metadata?.side_effects && (
                            <div className="detail-row-item">
                              <span>Common Side Effects</span>
                              <p style={{ fontSize: 13, color: 'var(--critical)' }}>{h.metadata.side_effects}</p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--muted)', fontSize: 13 }}>No safety files indexed for "{drugB}". Ensure correct generic molecule spellings.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* H. INTERACTIVE SYMPTOM CHECKER */}
        {activeTab === 'symptom' && (
          <div className="medintel-card">
            <h3>Symptom-Specialty Mapping</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>Select presenting patient symptoms below to query matching clinical databases and referral requirements.</p>

            <div className="symptom-selection-grid">
              {['Fever', 'Headache', 'Nausea/Vomiting', 'Heart Palpitations', 'Fatigue/Myalgia', 'Joint stiffness'].map((sym) => {
                const isSelected = selectedSymptoms.includes(sym);
                return (
                  <label key={sym} className={`symptom-checkbox-label ${isSelected ? 'selected' : ''}`}>
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => handleSymptomToggle(sym)} 
                    />
                    {isSelected ? <Check size={16} style={{ color: 'var(--good-health)' }} /> : <div style={{ width: 16 }}></div>}
                    {sym}
                  </label>
                );
              })}
            </div>

            {/* Diagnostic recommendation result card */}
            {symptomResult && (
              <div style={{ marginTop: 28, background: '#f8fafc', border: '1px solid var(--border-light)', padding: 24, borderRadius: 20, animation: 'fadeIn 0.25s ease' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                  <Activity size={24} style={{ color: '#38bdf8' }} />
                  <h4 style={{ fontSize: 16, fontWeight: 700 }}>CLINICAL REFERRAL ESTIMATE</h4>
                </div>

                <div className="detail-row-item">
                  <span>Suspected Cohort Condition</span>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>{symptomResult.condition}</p>
                </div>

                <div className="detail-row-item" style={{ marginTop: 12 }}>
                  <span>Recommended Medical Specialty</span>
                  <p style={{ fontWeight: 600, color: 'var(--text)' }}>{symptomResult.specialty}</p>
                </div>

                <div className="detail-row-item" style={{ marginTop: 12 }}>
                  <span>RAG Guidelines Recommendation Details</span>
                  <p style={{ color: 'var(--text)', background: '#f1f5f9', padding: 14, borderRadius: 8 }}>{symptomResult.advice}</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                  <button 
                    className="primary-accent-btn"
                    onClick={() => {
                      setDraft(`What are the clinical pathways and diagnoses for: ${symptomResult.condition}?`);
                      setActiveTab('assistant');
                    }}
                    style={{ padding: '8px 18px', fontSize: 13 }}
                  >
                    Run Detailed RAG Search <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* I. SYSTEM HISTORY AUDIT LOGS */}
        {activeTab === 'history' && (
          <div className="medintel-card">
            <h3>Clinical Interaction Ledger</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>A ledger detailing past medication interaction scans and medical RAG query logs.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {auditLogs.map((log) => (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 6px', borderRadius: 4 }}>
                        {log.type}
                      </span>
                      <strong style={{ fontSize: 14 }}>{log.detail}</strong>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 4 }}>Time logged: {log.date}</span>
                  </div>
                  
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 700, 
                    color: log.status.includes('Flagged') ? 'var(--critical)' : 'var(--good-health)',
                    background: log.status.includes('Flagged') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    padding: '4px 10px',
                    borderRadius: 6
                  }}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* J. SYSTEM SETTINGS & PARAMETERS */}
        {activeTab === 'settings' && (
          <div className="medintel-card">
            <h3>Configuration Parameters</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Toggle active database environments and review REST services status.</p>

            <div style={{ display: 'grid', gap: 20, maxWidth: 540 }}>
              <div className="interaction-input-box">
                <label>Supabase REST Endpoint (VITE_SUPABASE_URL)</label>
                <input 
                  defaultValue={import.meta.env.VITE_SUPABASE_URL || 'https://vnltlcdtlklbatmoedae.supabase.co'} 
                  readOnly 
                  style={{ width: '100%', background: '#f8fafc', border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, fontFamily: 'monospace', color: 'var(--text)' }} 
                />
              </div>

              <div className="interaction-input-box">
                <label>RAG Embedding Model</label>
                <input 
                  defaultValue="text-embedding-3-small (1536 dims)" 
                  readOnly 
                  style={{ width: '100%', background: '#f8fafc', border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, color: 'var(--text)' }} 
                />
              </div>

              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: 14, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                <CheckCircle2 size={20} style={{ color: 'var(--good-health)' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: 14, color: '#065f46' }}>SYSTEM IS FULLY ONLINE</strong>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Local n-gram vector matcher active. Supabase queries operational when online.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Helper to resolve CSS variables in inline styles
function varColor(variableName) {
  return `var(${variableName})`;
}
