/* ==========================================================================
   MEDINTEL AI - LEGACY UI (MOVED)
   This file was renamed from `app.js` to prevent the legacy static UI from
   being served by accident. The React app in `src/` is now the active UI.
   ========================================================================== */

// Legacy UI script preserved for reference.

document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  initNavigation();
  initSearch();
  initEventListeners();
});

// ... (contents preserved) ...

// To view the full legacy implementation, see the original file contents in
// the repository history or restore `app.legacy.js` to `app.js` if needed.

/* ==========================================================================
   MEDINTEL AI - CORE APPLICATION LOGIC
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  initNavigation();
  initSearch();
  initEventListeners();
});

// GLOBAL STATE
const state = {
  activeTab: "dashboard",
  criticalAlerts: 24,
  reportsAnalyzed: 892,
  conversationsCount: 2453,
  isPremium: false,
  selectedSymptoms: new Set(),
  symptomSeverity: 1, // 1: Mild, 2: Moderate, 3: Severe
  inlineSelectedSymptoms: new Set(),
  inlineSymptomSeverity: 1
};

// ==========================================================================
// NAVIGATION & INTERACTION SYSTEM
// ==========================================================================
function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  // Update nav buttons
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    if (item.getAttribute("data-tab") === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Update views
  const views = document.querySelectorAll(".view-section");
  views.forEach(view => {
    view.classList.remove("active");
  });

  const activeView = document.getElementById(`${tabId}-view`);
  if (activeView) {
    activeView.classList.add("active");
    state.activeTab = tabId;
  }

  // Focus input if entering assistant view
  if (tabId === "ai-assistant") {
    setTimeout(() => {
      document.getElementById("assistant-input-field")?.focus();
    }, 400);
  }
}

// Global Search keyboard trigger
function initSearch() {
  const searchInput = document.getElementById("global-search");
  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  searchInput?.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    // 1. Patient Cards in patients view
    document.querySelectorAll("#patients-cards-container .patient-card").forEach(card => {
      const name = card.getAttribute("data-name") || card.querySelector("h3")?.innerText.toLowerCase() || "";
      if (name.includes(query)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });

    // 2. Document Items in dashboard
    document.querySelectorAll(".documents-list .document-item").forEach(item => {
      const name = item.querySelector(".doc-name")?.innerText.toLowerCase() || "";
      if (name.includes(query)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });

    // 3. Appointment Items in dashboard
    document.querySelectorAll(".appointments-list .appointment-item").forEach(item => {
      const name = item.querySelector(".patient-name")?.innerText.toLowerCase() || "";
      if (name.includes(query)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });

    // 4. Document Items in catalog
    document.querySelectorAll("#docs-catalog-container .doc-catalog-item").forEach(item => {
      const name = item.getAttribute("data-name") || item.querySelector("h4")?.innerText.toLowerCase() || "";
      if (name.includes(query)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  });

  // Local Patient Search
  const patientSearch = document.getElementById("patients-search-input");
  patientSearch?.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll("#patients-cards-container .patient-card").forEach(card => {
      const name = card.getAttribute("data-name") || card.querySelector("h3")?.innerText.toLowerCase() || "";
      if (name.includes(query)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  });

  // Local Document Search
  const docsSearch = document.getElementById("docs-search-input");
  docsSearch?.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll("#docs-catalog-container .doc-catalog-item").forEach(item => {
      const name = item.getAttribute("data-name") || item.querySelector("h4")?.innerText.toLowerCase() || "";
      if (name.includes(query)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  });
}

// ==========================================================================
// CHARTS & DATA RENDERING (CHART.JS)
// ==========================================================================
let mainHealthChart = null;
let mainDonutChart = null;

const chartDataSets = {
  month: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
    goodHealth: [65, 75, 70, 78, 72, 70, 82],
    riskLevel: [35, 25, 30, 22, 28, 30, 18]
  },
  day: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    goodHealth: [80, 82, 75, 70, 72, 85, 88],
    riskLevel: [20, 18, 25, 30, 28, 15, 12]
  },
  week: {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    goodHealth: [70, 74, 78, 72],
    riskLevel: [30, 26, 22, 28]
  },
  year: {
    labels: ["2021", "2022", "2023", "2024", "2025", "2026"],
    goodHealth: [58, 62, 65, 70, 74, 76],
    riskLevel: [42, 38, 35, 30, 26, 24]
  }
};

function initCharts() {
  const ctxLine = document.getElementById("healthTrendChart")?.getContext("2d");
  if (ctxLine) {
    // Gradient fills
    const goodGrad = ctxLine.createLinearGradient(0, 0, 0, 200);
    goodGrad.addColorStop(0, "rgba(16, 185, 129, 0.2)");
    goodGrad.addColorStop(1, "rgba(16, 185, 129, 0)");

    const riskGrad = ctxLine.createLinearGradient(0, 0, 0, 200);
    riskGrad.addColorStop(0, "rgba(249, 115, 22, 0.2)");
    riskGrad.addColorStop(1, "rgba(249, 115, 22, 0)");

    mainHealthChart = new Chart(ctxLine, {
      type: "line",
      data: {
        labels: chartDataSets.month.labels,
        datasets: [
          {
            label: "Good Health",
            data: chartDataSets.month.goodHealth,
            borderColor: "#0d9488",
            borderWidth: 3,
            backgroundColor: goodGrad,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#0d9488",
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: "Risk Level",
            data: chartDataSets.month.riskLevel,
            borderColor: "#f97316",
            borderWidth: 3,
            backgroundColor: riskGrad,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#f97316",
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: "rgba(148, 163, 184, 0.08)" },
            ticks: { color: "#64748b", font: { size: 10 } }
          },
          x: {
            grid: { display: false },
            ticks: { color: "#64748b", font: { size: 10 } }
          }
        }
      }
    });
  }

  // Doughnut Chart Patient Distribution
  const ctxDonut = document.getElementById("healthDonutChart")?.getContext("2d");
  if (ctxDonut) {
    mainDonutChart = new Chart(ctxDonut, {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: [56, 28, 12, 4],
            backgroundColor: ["#10b981", "#eab308", "#f97316", "#ef4444"],
            borderWidth: 2,
            borderColor: "#ffffff",
            hoverOffset: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "80%",
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

function updateChartData(timeframe) {
  if (!mainHealthChart) return;
  const set = chartDataSets[timeframe];
  mainHealthChart.data.labels = set.labels;
  mainHealthChart.data.datasets[0].data = set.goodHealth;
  mainHealthChart.data.datasets[1].data = set.riskLevel;
  mainHealthChart.update();
}

// Chart Time Filter buttons listener
function initEventListeners() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tf = btn.getAttribute("data-time");
      updateChartData(tf);
    });
  });
}

// ==========================================================================
// RAG MEDICAL AI ASSISTANT CHAT ENGINE
// ==========================================================================
const chatHistoryResponses = {
  "RAG Blood Analysis": [
    { text: "Here is the summary of Rohan Mehta's Blood Report scanned on May 20, 2026. Cholesterol: 248 mg/dL (Elevated). HbA1c: 6.1% (Pre-diabetic state). BP stands at 135/85 mmHg.", bot: true, citation: "Blood Report_May2024.pdf" }
  ],
  "Drug Toxicity Check": [
    { text: "Potential risks of combining Aspirin and Ibuprofen involve stomach lining irritation and competitive NSAID pathway blockage, reducing Aspirin's anti-platelet cardio-protective efficiency.", bot: true }
  ],
  "Cardiac Vitals Summary": [
    { text: "Robert Fox's record flags ST-elevations in newly integrated anterior clinical reports. This requires immediate cardiological checkups and coronary monitoring.", bot: true, citation: "MRI Brain Report.pdf" }
  ]
};

function startNewAssistantChat() {
  const chatMessagesBox = document.getElementById("chat-messages-box");
  chatMessagesBox.innerHTML = `
    <div class="chat-message bot-msg">
      <div class="msg-avatar">🤖</div>
      <div class="msg-content">
        <p>I have opened a new medical consultation record. How can I help you today? Please ask about symptoms, patients, or report summaries.</p>
      </div>
    </div>
  `;
  showTip("Started a new HIPAA-compliant clinical consultation!");
}

function switchChatHistory(chatIndex) {
  const titles = ["RAG Blood Analysis", "Drug Toxicity Check", "Cardiac Vitals Summary"];
  const selectedTitle = titles[chatIndex - 1];
  const listItems = document.querySelectorAll(".chat-list-item");
  
  listItems.forEach((item, idx) => {
    if (idx === chatIndex - 1) item.classList.add("active");
    else item.classList.remove("active");
  });

  const chatMessagesBox = document.getElementById("chat-messages-box");
  chatMessagesBox.innerHTML = "";

  const hist = chatHistoryResponses[selectedTitle] || [];
  hist.forEach(msg => {
    appendChatMessage(msg.text, msg.bot, msg.citation);
  });
}

function handleChatEnter(e) {
  if (e.key === "Enter") {
    sendUserMessage();
  }
}

function sendUserMessage() {
  const input = document.getElementById("assistant-input-field");
  const queryText = input.value.trim();
  if (!queryText) return;

  // Append user message
  appendChatMessage(queryText, false);
  input.value = "";

  // Play RAG Processing simulation
  simulateRAGRetrieval(queryText);
}

function triggerRAGQuery(promptText) {
  switchTab("ai-assistant");
  appendChatMessage(promptText, false);
  simulateRAGRetrieval(promptText);
}

function appendChatMessage(text, isBot = true, citationFile = null) {
  const chatMessagesBox = document.getElementById("chat-messages-box");
  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-message ${isBot ? 'bot-msg' : 'user-msg'}`;

  let citationHTML = "";
  if (citationFile) {
    citationHTML = `
      <div class="citation-tag" onclick="openRAGSummary('${citationFile}')">
        📁 Citation: ${citationFile}
      </div>
    `;
  }

  msgDiv.innerHTML = `
    <div class="msg-avatar">${isBot ? '🤖' : 'DR'}</div>
    <div class="msg-content">
      <p>${text}</p>
      ${citationHTML}
    </div>
  `;

  chatMessagesBox.appendChild(msgDiv);
  chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
}

// Visual simulation of vector scanning, chunk retrieval & semantic synthesis
function simulateRAGRetrieval(userQuery) {
  const ragIndicator = document.getElementById("rag-status-indicator");
  const ragText = document.getElementById("rag-status-text");
  
  if (!ragIndicator || !ragText) return;

  // 1. Show RAG processing bar
  ragIndicator.style.display = "flex";
  ragText.innerText = "RAG: Searching clinical directories & vector database...";

  // 2. Play typing indicator in messages
  const chatMessagesBox = document.getElementById("chat-messages-box");
  const typingDiv = document.createElement("div");
  typingDiv.className = "chat-message bot-msg typing-container";
  typingDiv.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-content typing-bubble">
      <span></span><span></span><span></span>
    </div>
  `;
  chatMessagesBox.appendChild(typingDiv);
  chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;

  // RAG Pipeline flow steps
  setTimeout(() => {
    ragText.innerText = "RAG: Retrieving relevant patient document chunks...";
  }, 1000);

  setTimeout(() => {
    ragText.innerText = "RAG: Cross-referencing findings with safety manuals...";
  }, 2000);

  setTimeout(() => {
    // Remove typing bubble and indicator
    typingDiv.remove();
    ragIndicator.style.display = "none";

    // Generate intelligent responses
    generateBotAnswer(userQuery);
  }, 3000);
}

function generateBotAnswer(query) {
  const normalized = query.toLowerCase();
  let botResponse = "I have indexed your records but could not find a highly specific match for that clinical detail. Could you provide a specific patient name or diagnostic query?";
  let citation = null;

  if (normalized.includes("blood") || normalized.includes("rohan")) {
    botResponse = "Based on Rohan Mehta's clinical blood profile retrieved via semantic search: Cholesterols index is high (248 mg/dL). Vitals suggest pre-diabetic state (HbA1c 6.1%). BP stands at 135/85 mmHg. I recommend placing him on mild statins and reviewing cardiovascular metrics in 3 weeks.";
    citation = "Blood Report_May2024.pdf";
  } else if (normalized.includes("robert") || normalized.includes("mri") || normalized.includes("fox")) {
    botResponse = "Robert Fox's MRI and Cardiac reports indicate slight coronary thickening and ST-elevations. His ECG readings suggest moderate coronary arterial blocks. High priority scheduling recommended.";
    citation = "MRI Brain Report.pdf";
  } else if (normalized.includes("aspirin") || normalized.includes("ibuprofen") || normalized.includes("interaction")) {
    botResponse = "Potential clinical warning: Co-administering Aspirin and Ibuprofen inhibits the anti-platelet aggregation benefits of Aspirin. It also significantly raises gastrointestinal bleeding vulnerabilities. Use alternative non-competitive analgesics like Acetaminophen.";
  } else if (normalized.includes("symptom") || normalized.includes("chest pain")) {
    botResponse = "If a patient experiences chest pain accompanied by dyspnea (shortness of breath), clinical algorithms estimate a High Probability of Angina Pectoris or myocardial ischemia. Immediate visual ECG and coronary analysis recommended.";
  }

  appendChatMessage(botResponse, true, citation);
  state.conversationsCount += 1;
}

function toggleRAGFiles() {
  openRAGSummary("Blood Report_May2024.pdf");
}

// ==========================================================================
// HOLOGRAPHIC OCR REPORT SCANNER SIMULATION
// ==========================================================================
function triggerFileUpload() {
  document.getElementById("file-uploader")?.click();
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  openScanningModal(file.name);
}

function openScanningModal(filename = "Blood_Report_May2026.pdf") {
  const modal = document.getElementById("ocr-scanning-modal");
  const docTitle = document.getElementById("scan-doc-title");
  const loaderMsg = document.getElementById("ocr-loader-msg");
  const resultsDiv = document.getElementById("scanning-results");
  const confirmBtn = document.getElementById("scan-confirm-btn");
  const cancelBtn = document.getElementById("scan-cancel-btn");
  const highlightLine = document.querySelector(".mock-line.text-highlight");

  if (!modal) return;

  // Reset modal values
  modal.classList.add("active");
  docTitle.innerText = `Scanning: ${filename}`;
  loaderMsg.style.display = "block";
  loaderMsg.innerText = "OCR: Extracting document pixels & character layouts...";
  resultsDiv.style.display = "none";
  confirmBtn.style.display = "none";
  cancelBtn.innerText = "Cancel";
  if (highlightLine) highlightLine.style.display = "none";

  // Phase 1: character scanning
  setTimeout(() => {
    loaderMsg.innerText = "RAG: Vectorizing semantic chunks & highlighting vitals...";
  }, 1200);

  // Phase 2: results rendering
  setTimeout(() => {
    loaderMsg.style.display = "none";
    resultsDiv.style.display = "grid";
    confirmBtn.style.display = "block";
    cancelBtn.innerText = "Abort Integration";
    if (highlightLine) highlightLine.style.display = "block";
    showTip("Report fully scanned and abnormalities highlighted!");
  }, 2500);
}

function closeScanningModal() {
  document.getElementById("ocr-scanning-modal")?.classList.remove("active");
}

function integrateScannedReport() {
  closeScanningModal();
  
  // Update clinical stats
  state.reportsAnalyzed += 1;
  state.criticalAlerts += 1;
  
  // Render new dashboard document item
  const docList = document.querySelector(".documents-list");
  if (docList) {
    const newDoc = document.createElement("div");
    newDoc.className = "document-item";
    newDoc.onclick = () => openRAGSummary("Newly_Scanned_Report.pdf");
    newDoc.innerHTML = `
      <div class="doc-icon-wrapper type-pdf">
        <span class="doc-badge">PDF</span>
      </div>
      <div class="doc-details">
        <h4 class="doc-name">Newly_Scanned_Report.pdf</h4>
        <span class="doc-meta">2 pages • May 22, 2026</span>
      </div>
      <span class="doc-status status-analyzed">Analyzed</span>
      <button class="doc-menu-btn" onclick="event.stopPropagation()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
      </button>
    `;
    docList.prepend(newDoc);
    // Remove last doc item to keep it clean
    if (docList.children.length > 4) {
      docList.lastElementChild.remove();
    }
  }

  // Also render in indexed document catalog under clinical documents tab
  const docsCatalog = document.getElementById("docs-catalog-container");
  if (docsCatalog) {
    const newCatalogItem = document.createElement("div");
    newCatalogItem.className = "doc-catalog-item";
    newCatalogItem.setAttribute("data-name", "newly_scanned_report.pdf");
    newCatalogItem.innerHTML = `
      <div class="doc-file-info">
        <div class="doc-file-icon type-pdf"><span class="doc-badge">PDF</span></div>
        <div class="doc-file-meta">
          <h4>Newly_Scanned_Report.pdf</h4>
          <span>2 pages • May 22, 2026</span>
        </div>
      </div>
      <div class="doc-chunk-count">18 chunks</div>
      <div class="doc-vector-sync">✓ Vectorized</div>
      <button class="doc-delete-action" onclick="deleteIndexedDoc(this, 'Newly_Scanned_Report.pdf')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
      </button>
    `;
    docsCatalog.prepend(newCatalogItem);
  }

  // Update Stats values dynamically
  const reportsVal = document.querySelector(".stat-card:nth-child(2) .stat-value");
  if (reportsVal) reportsVal.innerText = state.reportsAnalyzed;

  const alertsVal = document.getElementById("critical-alerts-num");
  if (alertsVal) alertsVal.innerText = state.criticalAlerts;

  showTip("Scanned report integrated into vector RAG databases successfully!");
  
  // History Insertion
  addHistoryEvent("Diagnostics Scan Integrated", `Scanned file <code>Newly_Scanned_Report.pdf</code>. Generated 18 text chunks and synchronized with secure patient EHR.`);
}

// ==========================================================================
// DRUG-TO-DRUG INTERACTION CHECKER
// ==========================================================================
function openInteractionChecker() {
  switchTab("drug-interactions");
}

function closeInteractionChecker() {
  document.getElementById("drug-interactions-modal")?.classList.remove("active");
}

function runDrugCheck() {
  const d1 = document.getElementById("drug-input-1").value.trim().toLowerCase();
  const d2 = document.getElementById("drug-input-2").value.trim().toLowerCase();
  const output = document.getElementById("drug-checker-output");

  if (!d1 || !d2) {
    showTip("Please enter both drugs to evaluate!");
    return;
  }

  output.style.display = "block";

  const aspirinCombs = ["warfarin", "heparin", "ibuprofen", "naproxen"];
  
  if ((d1.includes("aspirin") && aspirinCombs.includes(d2)) || (d2.includes("aspirin") && aspirinCombs.includes(d1))) {
    const severity = (d2.includes("warfarin") || d1.includes("warfarin")) ? "CRITICAL ALERT" : "MODERATE WARNING";
    const colorClass = (severity === "CRITICAL ALERT") ? "text-red" : "text-moderate";
    
    if (severity === "CRITICAL ALERT") {
      output.innerHTML = `
        <div class="inter-severity-alert ${colorClass}">⚠️ CRITICAL INTERACTION DETECTED</div>
        <p class="inter-details"><strong>Severe internal bleeding risks!</strong> Aspirin and Warfarin both block coagulation cascades via independent pathways (anti-platelet vs vitamin-K inhibition). Co-administration triggers clinical emergency levels. Avoid combining.</p>
      `;
    } else {
      output.innerHTML = `
        <div class="inter-severity-alert ${colorClass}">⚠️ MODERATE PATHWAY BLOCKED</div>
        <p class="inter-details"><strong>Competitive binding detected!</strong> Ibuprofen blocks Aspirin's access to COX-1 pathways, decreasing the cardio-protective anti-platelet efficiency of low-dose Aspirin. Separate dose spacing by at least 8 hours.</p>
      `;
    }
  } else {
    output.innerHTML = `
      <div class="inter-severity-alert" style="color: var(--color-good);">✓ SAFE CLINICAL PATHWAY</div>
      <p class="inter-details">No severe metabolic or chemical interactions found for <strong>${d1.toUpperCase()}</strong> and <strong>${d2.toUpperCase()}</strong> inside our reference directories. Always check liver vitals.</p>
    `;
  }
}

// ==========================================================================
// INTERACTIVE SYMPTOM CHECKER & WIZARD
// ==========================================================================
function openSymptomChecker() {
  switchTab("symptom-checker");
}

function closeSymptomChecker() {
  document.getElementById("symptom-checker-modal")?.classList.remove("active");
}

function toggleSymptomPill(pillEl) {
  const sym = pillEl.getAttribute("data-symptom");
  if (state.selectedSymptoms.has(sym)) {
    state.selectedSymptoms.delete(sym);
    pillEl.classList.remove("selected");
  } else {
    state.selectedSymptoms.add(sym);
    pillEl.classList.add("selected");
  }
}

function setSeverity(level) {
  state.symptomSeverity = level;
  const bars = document.querySelectorAll(".sev-bar");
  bars.forEach((bar, idx) => {
    if (idx + 1 === level) bar.classList.add("active");
    else bar.classList.remove("active");
  });
}

function runSymptomCheck() {
  const resultsContainer = document.getElementById("symptom-results-container");
  const step1 = document.getElementById("symptom-step-1");
  
  if (state.selectedSymptoms.size === 0) {
    showTip("Please highlight at least one symptom to evaluate!");
    return;
  }

  step1.style.display = "none";
  resultsContainer.style.display = "block";

  // Compute conditions based on symptoms selection
  let condition = "General Physiological Strain";
  let probability = "45%";
  let riskColor = "var(--color-moderate)";
  let advice = "Advise patient to take rest, monitor arterial pressures, and consult in case of persistent discomfort.";

  const selectList = Array.from(state.selectedSymptoms);

  if (state.selectedSymptoms.has("chest-pain") && state.selectedSymptoms.has("shortness-breath")) {
    condition = (state.symptomSeverity === 3) ? "Acute Myocardial Infarction (Angina)" : "Stable Coronary Artery Ischemia";
    probability = (state.symptomSeverity === 3) ? "88%" : "65%";
    riskColor = (state.symptomSeverity === 3) ? "var(--color-critical)" : "var(--color-high)";
    advice = (state.symptomSeverity === 3) 
      ? "CRITICAL! Alert Emergency services. Administer Oxygen, EKG analysis, and sublingual Nitroglycerin immediately."
      : "Schedule arterial EKG scans, cardiac stress testing, and vascular blood labs within 48 hours.";
  } else if (state.selectedSymptoms.has("palpitations") || state.selectedSymptoms.has("dizziness")) {
    condition = "Cardiac Arrhythmia (Tachycardia / AFib)";
    probability = "70%";
    riskColor = "var(--color-high)";
    advice = "Review electrolyte counts (Potassium / Magnesium levels). Conduct 24-hour Holter monitoring.";
  }

  resultsContainer.innerHTML = `
    <h4>Clinical Evaluation Results</h4>
    <div style="background: rgba(148, 163, 184, 0.05); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
      <p style="margin-bottom: 8px;">Primary Predicted Condition: <strong style="color: ${riskColor};">${condition}</strong></p>
      <p style="margin-bottom: 8px;">Confidence Score: <strong>${probability}</strong></p>
      <p style="line-height: 1.4; font-size: 0.85rem;">Clinical Recommendation: <strong>${advice}</strong></p>
    </div>
    <button class="symptom-next-btn" onclick="openSymptomChecker()">Start New Evaluation</button>
  `;
}

// ==========================================================================
// VOICE ASSISTANT SIMULATOR
// ==========================================================================
function activateVoiceAssistant() {
  const modal = document.getElementById("voice-assistant-modal");
  if (!modal) return;

  modal.classList.add("active");
  
  // Simulate speaking and transcription
  setTimeout(() => {
    const transcript = document.querySelector(".voice-transcript");
    if (transcript) transcript.innerText = '"Retrieved blood records summary of Rohan Mehta..."';
  }, 2200);

  setTimeout(() => {
    closeVoiceAssistant();
    triggerRAGQuery("Summarize newly uploaded Blood Report");
  }, 4200);
}

function closeVoiceAssistant() {
  document.getElementById("voice-assistant-modal")?.classList.remove("active");
}

// ==========================================================================
// CITATION & REPORT VISUALIZER
// ==========================================================================
function openRAGSummary(filename) {
  const modal = document.getElementById("rag-citation-modal");
  const title = document.getElementById("citation-title");
  
  if (modal && title) {
    modal.classList.add("active");
    title.innerText = `${filename} Chunk Verification`;
  }
}

function closeRAGSummary() {
  document.getElementById("rag-citation-modal")?.classList.remove("active");
}

// ==========================================================================
// PREMIUM UPGRADE WIZARD & CONFETTI SHOWER
// ==========================================================================
function openPremiumModal() {
  document.getElementById("premium-upgrade-modal")?.classList.add("active");
}

function closePremiumModal() {
  document.getElementById("premium-upgrade-modal")?.classList.remove("active");
}

function simulatePremiumPurchase() {
  const loaderBtn = document.querySelector(".buy-premium-btn");
  if (loaderBtn) {
    loaderBtn.innerText = "Syncing HL7 hospital protocols...";
    loaderBtn.disabled = true;
  }

  setTimeout(() => {
    closePremiumModal();
    triggerConfettiShower();
    
    // Unlock advanced SaaS features
    state.isPremium = true;
    showTip("License activated successfully! MedIntel Premium unlocked.");

    // Update Sidebar upgrade block visual
    const upgradeBlock = document.querySelector(".upgrade-card");
    if (upgradeBlock) {
      upgradeBlock.innerHTML = `
        <div style="color: var(--text-white); font-weight: 700;">🌟 MedIntel Pro Mode Active</div>
        <p style="font-size: 0.72rem; margin-top: 6px;">Hospital EHR directory synced dynamically via clinical APIs.</p>
      `;
    }
  }, 2200);
}

// Custom-drawn CSS particle explosion simulating confetti (No external CDN dependencies)
function triggerConfettiShower() {
  const box = document.getElementById("confetti-box");
  if (!box) return;

  box.innerHTML = "";
  const colors = ["#00f2fe", "#4facfe", "#10b981", "#ff007f", "#eab308"];

  for (let i = 0; i < 80; i++) {
    const particle = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    particle.style.position = "absolute";
    particle.style.width = `${Math.random() * 8 + 4}px`;
    particle.style.height = `${Math.random() * 8 + 4}px`;
    particle.style.background = color;
    particle.style.borderRadius = "50%";
    
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.top = `-20px`;

    // Drop trajectories
    particle.style.transform = `rotate(${Math.random() * 360}deg)`;
    particle.style.animation = `confettiDropAnim ${Math.random() * 2 + 1}s linear forwards`;
    
    box.appendChild(particle);
  }
}

// Inject confetti keyframes into page
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes confettiDropAnim {
    0% { top: -20px; transform: rotate(0deg) translateX(0); opacity: 1; }
    100% { top: 100vh; transform: rotate(720deg) translateX(${Math.random() * 100 - 50}px); opacity: 0; }
  }
`;
document.head.appendChild(styleSheet);

// ==========================================================================
// TOAST INTERACTIVE UTILITIES
// ==========================================================================
let toastTimer = null;

function showTip(messageText) {
  const toast = document.getElementById("toast-tip-container");
  const toastText = document.getElementById("toast-text");
  
  if (!toast || !toastText) return;

  toastText.innerText = messageText;
  toast.classList.add("active");

  if (toastTimer) clearTimeout(toastTimer);
  
  toastTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, 4000);
}

function showAppointmentDetails(patientName) {
  showTip(`Opening electronic clinical timeline chart for Patient ${patientName}...`);
}

function toggleNotifications() {
  document.getElementById("notifications-panel")?.classList.toggle("active");
}

// ==========================================================================
// NEW INLINE VIEWS LOGIC & HISTORIES
// ==========================================================================

// Dynamic Timeline log insertion
function addHistoryEvent(title, description) {
  const historyList = document.getElementById("audit-history-list");
  if (!historyList) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const node = document.createElement("div");
  node.className = "timeline-node-item new-node";
  node.style.animation = "slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards";
  node.innerHTML = `
    <div class="timeline-node-dot"></div>
    <span class="timeline-node-time">Today, ${timeStr}</span>
    <div class="timeline-node-card">
      <h4>${title}</h4>
      <p>${description}</p>
    </div>
  `;
  
  historyList.prepend(node);
  
  // Keep timeline compact
  if (historyList.children.length > 10) {
    historyList.lastElementChild.remove();
  }
}

// Inline Drug Pathway Conflict Evaluator
function runInlineDrugCheck() {
  const d1 = document.getElementById("inline-drug-1").value.trim().toLowerCase();
  const d2 = document.getElementById("inline-drug-2").value.trim().toLowerCase();
  const output = document.getElementById("inline-drug-output");

  if (!d1 || !d2) {
    showTip("Please enter both active ingredients to evaluate!");
    return;
  }

  output.style.display = "block";
  output.style.animation = "fadeInScale 0.4s ease forwards";

  const aspirinCombs = ["warfarin", "heparin", "ibuprofen", "naproxen"];
  
  if ((d1.includes("aspirin") && aspirinCombs.includes(d2)) || (d2.includes("aspirin") && aspirinCombs.includes(d1))) {
    const severity = (d2.includes("warfarin") || d1.includes("warfarin") || d2.includes("heparin") || d1.includes("heparin")) ? "CRITICAL ALERT" : "MODERATE WARNING";
    const colorClass = (severity === "CRITICAL ALERT") ? "text-red" : "text-moderate";
    
    if (severity === "CRITICAL ALERT") {
      output.innerHTML = `
        <div class="inter-severity-alert ${colorClass}">⚠️ CRITICAL MOLECULAR CONFLICT DETECTED</div>
        <p class="inter-details"><strong>Severe internal bleeding risks!</strong> Aspirin and Warfarin/Heparin co-administration interrupts separate coagulation pathways (anti-platelet vs. active prothrombin synthesis inhibitors), causing cumulative hemorrhagic vulnerabilities. Emergency status. Avoid co-prescription.</p>
      `;
      addHistoryEvent("Severe Interaction Checked", `Aspirin + ${d2.includes("aspirin") ? d1 : d2} pathway conflict flagged under clinical alert status.`);
    } else {
      output.innerHTML = `
        <div class="inter-severity-alert ${colorClass}">⚠️ MODERATE PATHWAY WARNING</div>
        <p class="inter-details"><strong>Competitive receptor blocking!</strong> NSAIDs like Ibuprofen competitively bind to platelets' COX-1 receptor nodes, completely neutralizing the long-term cardio-protective anti-platelet effectiveness of low-dose Aspirin. Space doses by at least 8-12 hours.</p>
      `;
      addHistoryEvent("Moderate Interaction Checked", `Aspirin + ${d2.includes("aspirin") ? d1 : d2} molecular pathway competition warning analyzed.`);
    }
  } else {
    output.innerHTML = `
      <div class="inter-severity-alert" style="color: var(--color-good);">✓ SAFE CLINICAL PATHWAY APPROVED</div>
      <p class="inter-details">No severe chemical conflicts or metabolic pathway contradictions found for <strong>${d1.toUpperCase()}</strong> and <strong>${d2.toUpperCase()}</strong> inside actively indexed safety reference databases. Proceed with normal clinical dosage plans.</p>
    `;
    addHistoryEvent("Drug Safety Checked", `${d1.toUpperCase()} and ${d2.toUpperCase()} pathways verified as non-conflicting.`);
  }
}

// Inline Symptom Evaluator Wizard
function toggleInlineSymptomPill(pillEl) {
  const sym = pillEl.getAttribute("data-symptom");
  if (!state.inlineSelectedSymptoms) {
    state.inlineSelectedSymptoms = new Set();
  }
  
  if (state.inlineSelectedSymptoms.has(sym)) {
    state.inlineSelectedSymptoms.delete(sym);
    pillEl.classList.remove("selected");
  } else {
    state.inlineSelectedSymptoms.add(sym);
    pillEl.classList.add("selected");
  }
}

function setInlineSeverity(level) {
  state.inlineSymptomSeverity = level;
  
  const step1 = document.getElementById("inline-symptom-step-1");
  if (!step1) return;
  
  const pills = step1.querySelectorAll(".sev-pill");
  pills.forEach((pill, idx) => {
    if (idx + 1 === level) {
      pill.classList.add("active");
    } else {
      pill.classList.remove("active");
    }
  });
}

function runInlineSymptomCheck() {
  const resultsContainer = document.getElementById("inline-symptom-results");
  const step1 = document.getElementById("inline-symptom-step-1");
  
  if (!state.inlineSelectedSymptoms || state.inlineSelectedSymptoms.size === 0) {
    showTip("Please highlight at least one symptom to evaluate!");
    return;
  }

  step1.style.display = "none";
  resultsContainer.style.display = "block";
  resultsContainer.style.animation = "fadeInScale 0.4s ease forwards";

  let condition = "General Physiological Strain";
  let probability = "45%";
  let riskColor = "var(--color-moderate)";
  let advice = "Advise patient to take rest, monitor arterial pressures, and consult in case of persistent discomfort.";
