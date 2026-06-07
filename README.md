# MedIntel.AI

![Logo](https://github.com/sapthagirirajan/Medintel.AI/blob/main/LOGO/logo%20photo.png)

**MedIntel.AI** is a premium, AI-driven medical dashboard designed to assist clinicians, hospitals, and research professionals with advanced RAG (Retrieval Augmented Generation) medical features. Built with React, Chart.js, and state-of-the-art modern front-end technologies, MedIntel.AI offers clinical document analysis, intelligent symptom triage, drug-drug interaction checking, OCR medical scanning, and much more, all in a seamless web interface.

---

## Features

- **RAG Medical AI Assistant:** HIPAA-compliant chat engine for clinical case consultations powered by retrieval-augmented intelligence.
- **Interactive Medical Dashboard:** Real-time statistics for critical alerts, reports analyzed, and patient conversations.
- **Symptom Checker & Triage Wizard:** Step-by-step clinical evaluation, probability scoring, and instant recommendations for key symptoms.
- **Drug-to-Drug Interaction Evaluator:** Rapid check for molecular and pathway interactions with severity awareness, referencing common dangers like Aspirin + Warfarin.
- **Advanced Charts:** Dynamic patient health trends and risk stratification powered by Chart.js.
- **OCR Clinical Document Scanner:** Simulated pipeline for uploading, scanning, vectorizing, and summarizing lab and scan PDFs.
- **Vectorized Clinical Catalog:** Document indexing, semantic retrieval, citation visualization, and historical audit trail.
- **Premium Upgrade Flow:** Unlock advanced SaaS features (EHR sync, additional AI tools) with smooth onboarding visuals.

---

## Screenshots

| Dashboard | Symptom Checker | Drug Interaction Checker | OCR Scan |
|-----------|----------------|-------------------------|----------|
| ![dashboard](https://github.com/sapthagirirajan/Medintel.AI/blob/main/assets/brain.png) | ![checker](https://github.com/sapthagirirajan/Medintel.AI/blob/main/assets/robot.png) | ![drugs](https://github.com/sapthagirirajan/Medintel.AI/blob/main/assets/diamond.png) | ![ocr](https://github.com/sapthagirirajan/Medintel.AI/blob/main/assets/pyramid.png) |

---

## Tech Stack

- **CSS** *(65%)*: Custom dashboard, theming, and animation with pure CSS.
- **JavaScript** *(34.5%)*: Core application logic, AI simulation, custom user interactions.
- **HTML** *(0.5%)*: Landing, root, and base templating.
- **React** with Vite as the build tool.
- **Chart.js** and `react-chartjs-2` for charting.
- **Lucide Icons**, Google Fonts (Inter, Montserrat) for a modern, crisp UI.

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or newer recommended)
- **npm** (comes with Node.js)

### Installation

1. **Clone the repo:**
    ```bash
    git clone https://github.com/sapthagirirajan/Medintel.AI.git
    cd Medintel.AI
    ```

2. **Install dependencies:**
    ```bash
    npm install
    ```

3. **Start the dev server:**
    ```bash
    npm run dev
    ```
    The app runs on [http://localhost:5173](http://localhost:5173) by default (if using Vite).

---

## Project Structure

```
/
├── app.js               # Main application JS (state, logic, UI controller)
├── index.html           # Single-page root HTML file (mounts React/root)
├── styles.css           # Core CSS for entire application
├── assets/              # App images (brain.png, diamond.png, etc.)
├── LOGO/logo photo.png  # Project branding
├── package.json         # npm dependencies, scripts, entry definitions
├── vite.config.js       # Vite build config for React
└── ...
```

> **Note:** Main React entry point is likely in `src/main.jsx` (see `index.html`). If absent, core logic is implemented in `app.js`.

---

## Roadmap / To-Do

- [ ] Integrate backend for genuine RAG index/document analysis
- [ ] Implement secure user auth & patient record sync (OAuth/EHR support)
- [ ] Improve accessibility and mobile responsiveness
- [ ] Expand clinical logic for additional symptoms and drugs

---

## License

**Private/Internal Project** — For demonstration or research only.

---

## Acknowledgements

- UI icons from [Lucide](https://lucide.dev/)
- Charts powered by [Chart.js](https://www.chartjs.org/)
- Modern fonts from Google Fonts (Inter, Montserrat)

---

## Author

[Sapthagiri Rajan](https://github.com/sapthagirirajan)
